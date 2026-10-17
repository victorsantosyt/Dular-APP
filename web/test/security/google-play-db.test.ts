import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, jwtVerify, type CryptoKey } from "jose";
import { criarStripeFalso, type StripeFalso } from "./_stripeFalso";

/**
 * Google Play (issue #359) contra Postgres REAL, com o GOOGLE SIMULADO
 * (`googlePlay.buscar`: OAuth, subscriptionsv2.get, acknowledge) e a Stripe
 * simulada. Nada aqui fala com o Google: prova a tradução dos estados, a
 * titularidade, o reconhecimento, as notificações (Pub/Sub com OIDC) e a
 * idempotência. O pacote é FICTÍCIO (configurável): a definição do pacote real
 * está pendente no Play Console.
 *
 * Mesmo protocolo das outras suítes de banco: SAFESCORE_DB_URL local;
 * obrigatório no CI (SAFESCORE_DB_REQUIRED=1).
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";
const DIA = 86_400_000;
const PACOTE = "br.com.teste.ficticio";
const AUDIENCIA = "https://dular.teste/api/webhooks/google-play";
const CONTA_PUSH = "push-rtdn@projeto-teste.iam.gserviceaccount.com";
const CONTA_API = "api-play@projeto-teste.iam.gserviceaccount.com";

type Recurso = Record<string, any>;

describe("Google Play contra Postgres real (#359)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let PLANS: any;
  let lojas: any;
  let compras: any;
  let stripeCliente: any;
  let postLoja: (r: Request) => Promise<Response>;
  let postRtdn: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  let checkFeatureAccess: (u: string, f: string) => Promise<{ plan: string }>;
  let falso: StripeFalso;
  let chaveApi: { publicKey: CryptoKey; privateKey: CryptoKey };
  let chavePush: { publicKey: CryptoKey; privateKey: CryptoKey };
  let buscarOriginal: unknown;
  const RUN = `t_gplay_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  let seqMsg = 0;

  /** O Google simulado: assinaturas por token, chamadas recebidas e falhas sob comando. */
  const google = {
    assinaturas: new Map<string, Recurso>(),
    chamadas: [] as string[],
    /** Toda chamada ao subscriptionsv2.get, inclusive as que falham. */
    tentativas: [] as string[],
    reconhecidas: [] as string[],
    foraDoAr: false,
    reconhecimentoFora: false,
    /** O Google não enxerga o app (sem acesso da conta de serviço ou sem pacote enviado). */
    appNaoEncontrado: false,
  };

  async function usuario(sufixo: string, role = "DIARISTA") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste gplay ${sufixo}`, role } });
    usuarios.push(id);
    return id;
  }
  /** Assinatura no Google como `subscriptionsv2.get` a devolve. */
  function recurso(dono: string | null, o: Partial<Recurso> & { produto?: string; base?: string; fim?: number; renova?: boolean } = {}): Recurso {
    const { produto = PLANS.pro_mensal.storeProductId, base = "mensal", fim = Date.now() + 30 * DIA, renova = true, ...resto } = o;
    return {
      kind: "androidpublisher#subscriptionPurchaseV2",
      startTime: new Date(Date.now() - 1000).toISOString(),
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      ...(dono ? { externalAccountIdentifiers: { obfuscatedExternalAccountId: dono } } : {}),
      lineItems: [{ productId: produto, expiryTime: new Date(fim).toISOString(), autoRenewingPlan: { autoRenewEnabled: renova }, offerDetails: { basePlanId: base } }],
      ...resto,
    };
  }
  function compraNoGoogle(token: string, r: Recurso) {
    google.assinaturas.set(token, r);
    return token;
  }
  const token = (s: string) => `${RUN}.token.${s}`;

  async function apresentar(userId: string, purchaseToken: string, role = "DIARISTA") {
    const res = await postLoja(
      new Request("http://test/api/billing/loja", {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(userId, role) },
        body: JSON.stringify({ plataforma: "android", produtoId: PLANS.pro_mensal.storeProductId, comprovante: purchaseToken }),
      }),
    );
    return { status: res.status, corpo: await res.json() };
  }
  async function jwtPush(o: { aud?: string; email?: string; verificado?: boolean; iss?: string; exp?: number } = {}) {
    const agora = Math.floor(Date.now() / 1000);
    return new SignJWT({ email: o.email ?? CONTA_PUSH, email_verified: o.verificado ?? true })
      .setProtectedHeader({ alg: "RS256", kid: "chave-push" })
      .setIssuer(o.iss ?? "https://accounts.google.com")
      .setAudience(o.aud ?? AUDIENCIA)
      .setIssuedAt(agora)
      .setExpirationTime(o.exp ?? agora + 600)
      .sign(chavePush.privateKey);
  }
  async function notificar(notificacao: Recurso, o: { jwt?: string | null; messageId?: string } = {}) {
    const autorizacao: Record<string, string> = o.jwt === null ? {} : { authorization: `Bearer ${o.jwt ?? (await jwtPush())}` };
    const res = await postRtdn(
      new Request("http://test/api/webhooks/google-play", {
        method: "POST",
        headers: { "content-type": "application/json", ...autorizacao },
        body: JSON.stringify({
          message: { messageId: o.messageId ?? `${RUN}-msg-${++seqMsg}`, data: Buffer.from(JSON.stringify(notificacao)).toString("base64") },
          subscription: "projects/teste/subscriptions/rtdn",
        }),
      }),
    );
    return { status: res.status, corpo: await res.json() };
  }
  const notificacaoDeAssinatura = (purchaseToken: string, tipo = 4, pacote = PACOTE) => ({
    version: "1.0",
    packageName: pacote,
    eventTimeMillis: String(Date.now()),
    subscriptionNotification: { version: "1.0", notificationType: tipo, purchaseToken },
  });
  const linhaDaCompra = (externalId: string) => prisma.assinaturaLoja.findUnique({ where: { provider_externalId: { provider: "GOOGLE", externalId } } });
  const acesso = async (userId: string) => (await checkFeatureAccess(userId, "SOLICITACOES_MES")).plan;
  const gets = (purchaseToken: string) => google.chamadas.filter((c) => c === `get ${purchaseToken}`).length;

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    chaveApi = await generateKeyPair("RS256", { extractable: true });
    chavePush = await generateKeyPair("RS256", { extractable: true });
    Object.assign(process.env, {
      DATABASE_URL: URL_BANCO,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_ficticio_sem_uso_de_rede",
      GOOGLE_PLAY_PACKAGE_NAME: PACOTE,
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: CONTA_API, private_key: await exportPKCS8(chaveApi.privateKey) }),
      GOOGLE_PLAY_PUSH_AUDIENCE: AUDIENCIA,
      GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT: CONTA_PUSH,
    });
    ({ prisma } = await import("../../src/lib/prisma"));
    const modStripe = await import("../../src/lib/stripe");
    PLANS = modStripe.PLANS;
    stripeCliente = modStripe.stripe;
    lojas = await import("../../src/lib/lojas");
    compras = await import("../../src/lib/googlePlayCompras");
    postLoja = (await import("../../src/app/api/billing/loja/route")).POST;
    postRtdn = (await import("../../src/app/api/webhooks/google-play/route")).POST;
    ({ makeAuthHeaders } = await import("./_helpers"));
    ({ checkFeatureAccess } = (await import("../../src/lib/featureGate")) as any);
    const { limitesPresenca } = await import("../../src/lib/origemDoCheckout");
    limitesPresenca.intervaloMs = Number.MAX_SAFE_INTEGER;

    const jwk = { ...(await exportJWK(chavePush.publicKey)), kid: "chave-push", alg: "RS256", use: "sig" };
    compras.notificacoesGoogle.chaves = createLocalJWKSet({ keys: [jwk] });

    buscarOriginal = lojas.googlePlay.buscar;
    lojas.googlePlay.buscar = async (url: string, init: RequestInit = {}) => {
      if (url === "https://oauth2.googleapis.com/token") {
        const assertion = new URLSearchParams(String(init.body)).get("assertion") ?? "";
        const { payload } = await jwtVerify(assertion, chaveApi.publicKey, { audience: "https://oauth2.googleapis.com/token", issuer: CONTA_API });
        assert.equal(payload.scope, "https://www.googleapis.com/auth/androidpublisher");
        google.chamadas.push("oauth");
        return Response.json({ access_token: "acesso-ficticio", expires_in: 3600 });
      }
      const prefixo = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACOTE}/purchases/`;
      // Pacote diferente do configurado: o Google simulado nem responde a ele.
      assert.ok(url.startsWith(prefixo), `chamada fora do pacote configurado: ${url}`);
      assert.equal((init.headers as Record<string, string>).authorization, "Bearer acesso-ficticio");
      const tentativa = /subscriptionsv2\/tokens\/(.+)$/.exec(decodeURIComponent(url));
      if (tentativa) google.tentativas.push(tentativa[1]);
      if (google.foraDoAr) return new Response("indisponível", { status: 503 });
      const resto = decodeURIComponent(url.slice(prefixo.length));
      const ack = /^subscriptions\/([^/]+)\/tokens\/(.+):acknowledge$/.exec(resto);
      if (ack && init.method === "POST") {
        if (google.reconhecimentoFora) return new Response("indisponível", { status: 503 });
        const r = google.assinaturas.get(ack[2]);
        if (!r) return new Response("não encontrada", { status: 404 });
        r.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
        google.reconhecidas.push(ack[2]);
        return new Response(null, { status: 200 });
      }
      const get = /^subscriptionsv2\/tokens\/(.+)$/.exec(resto);
      if (get) {
        google.chamadas.push(`get ${get[1]}`);
        if (google.appNaoEncontrado) {
          return Response.json(
            { error: { code: 404, message: "No application was found for the given package name.", errors: [{ reason: "applicationNotFound" }] } },
            { status: 404 },
          );
        }
        const r = google.assinaturas.get(get[1]);
        return r ? Response.json(r) : new Response("não encontrada", { status: 404 });
      }
      return new Response("rota desconhecida", { status: 404 });
    };
    lojas.loja.implementada.GOOGLE = true;
  });

  beforeEach(() => {
    falso?.restaurar();
    falso = criarStripeFalso(Math.floor(Date.now() / 1000) - 3600);
    falso.instalar(stripeCliente);
    google.foraDoAr = false;
    google.reconhecimentoFora = false;
  });

  after(async () => {
    falso?.restaurar();
    if (lojas) {
      lojas.loja.implementada.GOOGLE = false;
      lojas.googlePlay.buscar = buscarOriginal;
    }
    if (!prisma) return;
    await prisma.notificacaoLoja.deleteMany({ where: { mensagemId: { startsWith: RUN } } });
    await prisma.stripeOperacao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.stripeRevisao.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.assinaturaLoja.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
  });

  // ── Tradução dos estados (pura) ───────────────────────────────────────────

  it("estados do Google → período e renovação; nunca \"renovação desligada\" por falta de dado", () => {
    const agora = Date.now();
    const s = (estado: string, o: Partial<Recurso> & { fim?: number; renova?: boolean } = {}) =>
      lojas.situacaoDoGoogle(recurso("dono-x", { subscriptionState: estado, ...o }), "tk", agora);
    const ativa = s("SUBSCRIPTION_STATE_ACTIVE");
    assert.deepEqual([ativa.vigente, ativa.renova, ativa.dono, ativa.planoBase, ativa.reconhecida, ativa.final], [true, true, "dono-x", "mensal", false, false]);
    assert.deepEqual([s("SUBSCRIPTION_STATE_CANCELED", { renova: false }).vigente, s("SUBSCRIPTION_STATE_CANCELED", { renova: false }).renova], [true, false]);
    assert.equal(s("SUBSCRIPTION_STATE_CANCELED", { renova: false, fim: agora - 1 }).vigente, false, "cancelada vale até o fim");
    assert.deepEqual([s("SUBSCRIPTION_STATE_IN_GRACE_PERIOD").vigente, s("SUBSCRIPTION_STATE_IN_GRACE_PERIOD").renova], [true, true]);
    for (const estado of ["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED"]) {
      assert.deepEqual([s(estado).vigente, s(estado).renova], [false, true], `${estado}: sem acesso, ainda vai cobrar`);
    }
    const vencida = s("SUBSCRIPTION_STATE_EXPIRED", { renova: false, fim: agora - DIA });
    assert.deepEqual([vencida.vigente, vencida.renova, vencida.final], [false, false, true]);
    assert.equal(s("SUBSCRIPTION_STATE_ACTIVE", { testPurchase: {} }).teste, true);
    assert.equal(s("SUBSCRIPTION_STATE_ACTIVE", { linkedPurchaseToken: "antigo" }).substitui, "antigo");

    const erro = (r: Recurso) => {
      try {
        lojas.situacaoDoGoogle(r, "tk", agora);
        return "nenhum";
      } catch (e: any) {
        return e.codigo;
      }
    };
    assert.equal(erro(recurso("d", { subscriptionState: "SUBSCRIPTION_STATE_PENDING" })), "COMPRA_PENDENTE");
    assert.equal(erro(recurso("d", { subscriptionState: "SUBSCRIPTION_STATE_NOVO_QUALQUER" })), "LOJA_INDISPONIVEL");
    const semRenovacao = recurso("d");
    delete semRenovacao.lineItems[0].autoRenewingPlan;
    assert.equal(erro(semRenovacao), "LOJA_INDISPONIVEL", "sem o campo de renovação: desconhecida");
    const doisItens = recurso("d");
    doisItens.lineItems.push({ ...doisItens.lineItems[0], productId: "complemento" });
    assert.equal(erro(doisItens), "COMPRA_INVALIDA");
    const semInicio = recurso("d");
    delete semInicio.startTime;
    assert.equal(erro(semInicio), "LOJA_INDISPONIVEL");
  });

  it("pacote configurável e validado: ausente ou fora do formato não conta como credencial", () => {
    const original = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    try {
      for (const invalido of ["", "semponto", "Com.Maiuscula.app", "br.com.dular.app; DROP", "../outro"]) {
        process.env.GOOGLE_PLAY_PACKAGE_NAME = invalido;
        assert.equal(lojas.pacoteGooglePlay(), null, invalido);
        assert.equal(lojas.credenciaisGoogleProntas(), false);
      }
      process.env.GOOGLE_PLAY_PACKAGE_NAME = PACOTE;
      assert.equal(lojas.pacoteGooglePlay(), PACOTE);
    } finally {
      process.env.GOOGLE_PLAY_PACKAGE_NAME = original;
    }
  });

  // ── Compra apresentada pelo app ───────────────────────────────────────────

  it("integração desligada: a rota responde 503 e nada é consultado nem gravado", async () => {
    const userId = await usuario("desligada");
    const tk = compraNoGoogle(token("desligada"), recurso(lojas.tokenDaConta(userId)));
    lojas.loja.implementada.GOOGLE = false;
    try {
      const r = await apresentar(userId, tk);
      assert.equal(r.status, 503);
      assert.equal(gets(tk), 0);
      assert.deepEqual(lojas.lojasProntas(), { apple: false, google: false });
      const rtdn = await notificar(notificacaoDeAssinatura(tk));
      assert.equal(rtdn.status, 503);
    } finally {
      lojas.loja.implementada.GOOGLE = true;
    }
    assert.equal(await linhaDaCompra(tk), null);
  });

  it("compra válida: concedida pelo produto e plano base verificados, reconhecida uma vez só", async () => {
    const userId = await usuario("compra");
    const tk = compraNoGoogle(token("compra"), recurso(lojas.tokenDaConta(userId)));
    const r = await apresentar(userId, tk);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.plan, "PREMIUM");
    const linha = await linhaDaCompra(tk);
    assert.deepEqual([linha.userId, linha.plan, linha.planoBase, linha.estadoLoja, linha.vigente], [userId, "PREMIUM", "mensal", "SUBSCRIPTION_STATE_ACTIVE", true]);
    assert.ok(linha.reconhecidaEm, "reconhecida no Google");
    assert.equal((await apresentar(userId, tk)).status, 200, "reapresentada (restauração)");
    assert.deepEqual(google.reconhecidas.filter((t) => t === tk), [tk], "reconhecida uma vez");
    assert.equal(await acesso(userId), "PREMIUM");
  });

  it("pagamento pendente: 202, nada gravado nem reconhecido", async () => {
    const userId = await usuario("pendente");
    const tk = compraNoGoogle(token("pendente"), recurso(lojas.tokenDaConta(userId), { subscriptionState: "SUBSCRIPTION_STATE_PENDING" }));
    const r = await apresentar(userId, tk);
    assert.equal(r.status, 202);
    assert.equal(r.corpo.pendente, true);
    assert.equal(await linhaDaCompra(tk), null);
    assert.equal(google.reconhecidas.includes(tk), false);
  });

  it("Montador Pro Anual: só o plano base anual-v2 vale; o anual antigo é recusado; o anual do Profissional de Casa segue \"anual\"", async () => {
    assert.equal(PLANS.montador_pro_anual.storeBasePlanId, "anual-v2");
    assert.equal(PLANS.montador_pro_anual.priceInCents, 35900);
    assert.equal(PLANS.montador_pro_anual.interval, "year");
    assert.equal(PLANS.pro_anual.storeBasePlanId, "anual", "Profissional de Casa não muda");

    const getPlans = (await import("../../src/app/api/billing/plans/route")).GET;
    const montador = await usuario("anual_v2", "MONTADOR");
    const res = await getPlans(new Request("http://test/api/billing/plans", { headers: makeAuthHeaders(montador, "MONTADOR") }));
    const anual = (await res.json()).plans.find((p: any) => p.id === "montador_pro_anual");
    assert.deepEqual([anual.storeProductId, anual.storeBasePlanId, anual.interval, anual.priceInCents], ["br.com.dular.montador.pro.anual", "anual-v2", "year", 35900]);

    const produto = PLANS.montador_pro_anual.storeProductId;
    const nova = compraNoGoogle(token("anual_v2"), recurso(lojas.tokenDaConta(montador), { produto, base: "anual-v2" }));
    const ok = await apresentar(montador, nova, "MONTADOR");
    assert.equal(ok.status, 200);
    assert.equal((await linhaDaCompra(nova)).planoBase, "anual-v2");

    const outro = await usuario("anual_antigo", "MONTADOR");
    const antiga = compraNoGoogle(token("anual_antigo"), recurso(lojas.tokenDaConta(outro), { produto, base: "anual" }));
    const recusada = await apresentar(outro, antiga, "MONTADOR");
    assert.deepEqual([recusada.status, recusada.corpo.error.code], [409, "PRODUTO_DESCONHECIDO"]);
    assert.equal(await linhaDaCompra(antiga), null);
  });

  it("outro plano base ou produto fora do catálogo: 409, nada gravado nem reconhecido", async () => {
    const userId = await usuario("plano_base");
    const outroBase = compraNoGoogle(token("outro_base"), recurso(lojas.tokenDaConta(userId), { base: "promocional" }));
    const fora = compraNoGoogle(token("fora"), recurso(lojas.tokenDaConta(userId), { produto: "com.outro.app.produto" }));
    for (const tk of [outroBase, fora]) {
      const r = await apresentar(userId, tk);
      assert.equal(r.status, 409);
      assert.equal(r.corpo.error.code, "PRODUTO_DESCONHECIDO");
      assert.equal(await linhaDaCompra(tk), null);
    }
  });

  it("titularidade: compra de outra conta (ou sem conta) 403; token de outro app 400; nada gravado", async () => {
    const userId = await usuario("dono");
    const outro = await usuario("dono_outro");
    const alheia = compraNoGoogle(token("alheia"), recurso(lojas.tokenDaConta(outro)));
    const semDono = compraNoGoogle(token("sem_dono"), recurso(null));
    for (const tk of [alheia, semDono]) {
      const r = await apresentar(userId, tk);
      assert.equal(r.status, 403);
      assert.equal(r.corpo.error.code, "COMPRA_SEM_TITULARIDADE");
    }
    const r = await apresentar(userId, `${RUN}.token.de-outro-app`);
    assert.equal(r.status, 400);
    assert.equal(r.corpo.error.code, "COMPRA_INVALIDA");
    assert.equal(await prisma.assinaturaLoja.count({ where: { userId } }), 0);
  });

  it("app não encontrado no Google (applicationNotFound): 503 LOJA_INDISPONIVEL, nada gravado; comprovante inexistente segue 400", async () => {
    const userId = await usuario("app_nao_encontrado");
    const tk = compraNoGoogle(token("app_nao_encontrado"), recurso(lojas.tokenDaConta(userId)));
    google.appNaoEncontrado = true;
    try {
      for (const comprovante of [tk, `${RUN}.token.inexistente`]) {
        const r = await apresentar(userId, comprovante);
        assert.equal(r.status, 503);
        assert.equal(r.corpo.error.code, "LOJA_INDISPONIVEL");
      }
      // RTDN: a falha é transitória (500), para o Pub/Sub reenviar.
      await assert.rejects(compras.sincronizarCompraGoogle(tk), (e: any) => e instanceof lojas.ErroDeLoja && e.codigo === "LOJA_INDISPONIVEL");
    } finally {
      google.appNaoEncontrado = false;
    }
    assert.equal(await prisma.assinaturaLoja.count({ where: { userId } }), 0);
    assert.equal(await acesso(userId), "FREE");
    // Controle: com o app visível, o comprovante inexistente volta a ser compra inválida.
    const r = await apresentar(userId, `${RUN}.token.inexistente`);
    assert.equal(r.status, 400);
    assert.equal(r.corpo.error.code, "COMPRA_INVALIDA");
  });

  it("reconhecimento falhou na hora: a compra vale e o cron reconhece dentro do prazo", async () => {
    const userId = await usuario("reconhecer_depois");
    const tk = compraNoGoogle(token("reconhecer_depois"), recurso(lojas.tokenDaConta(userId)));
    google.reconhecimentoFora = true;
    assert.equal((await apresentar(userId, tk)).status, 200);
    assert.equal((await linhaDaCompra(tk)).reconhecidaEm, null);
    google.reconhecimentoFora = false;
    const r = await compras.reconhecerPendentesGoogle();
    assert.ok(r.reconhecidas >= 1);
    assert.ok((await linhaDaCompra(tk)).reconhecidaEm);
  });

  it("troca de plano (linkedPurchaseToken): a compra anterior é substituída e o acesso segue a nova", async () => {
    const userId = await usuario("troca");
    const antiga = compraNoGoogle(token("troca_antiga"), recurso(lojas.tokenDaConta(userId), { produto: PLANS.basico_mensal.storeProductId }));
    assert.equal((await apresentar(userId, antiga)).status, 200);
    assert.equal(await acesso(userId), "BASIC");
    google.assinaturas.get(antiga)!.subscriptionState = "SUBSCRIPTION_STATE_EXPIRED";
    const nova = compraNoGoogle(token("troca_nova"), recurso(lojas.tokenDaConta(userId), { linkedPurchaseToken: antiga }));
    assert.equal((await apresentar(userId, nova)).status, 200);
    const a = await linhaDaCompra(antiga);
    assert.deepEqual([a.vigente, a.substituidaPor, Boolean(a.encerradaEm)], [false, nova, true]);
    assert.equal(await acesso(userId), "PREMIUM");
  });

  it("linkedPurchaseToken de compra de OUTRA conta: recusado, nada transferido", async () => {
    const dono = await usuario("ligada_dono");
    const outro = await usuario("ligada_outro");
    const antiga = compraNoGoogle(token("ligada_antiga"), recurso(lojas.tokenDaConta(dono)));
    assert.equal((await apresentar(dono, antiga)).status, 200);
    const nova = compraNoGoogle(token("ligada_nova"), recurso(lojas.tokenDaConta(outro), { linkedPurchaseToken: antiga }));
    const r = await apresentar(outro, nova);
    assert.equal(r.status, 409);
    assert.equal(r.corpo.error.code, "COMPRA_DE_OUTRA_CONTA");
    assert.equal(await linhaDaCompra(nova), null);
    assert.equal((await linhaDaCompra(antiga)).vigente, true);
  });

  it("compra no Google de quem assina pela Stripe: a regra 1 encerra a Stripe no fim do período", async () => {
    const userId = await usuario("stripe");
    const sub = falso.criarAssinatura({ metadata: { userId, planId: "basico_mensal", subscriptionPlan: "BASIC" }, plano: PLANS.basico_mensal });
    await prisma.subscription.create({
      data: { userId, plan: "BASIC", status: "ACTIVE", provider: "STRIPE", externalId: sub, startedAt: new Date(Date.now() - DIA), expiresAt: new Date(Date.now() + 20 * DIA) },
    });
    const tk = compraNoGoogle(token("stripe"), recurso(lojas.tokenDaConta(userId)));
    assert.equal((await apresentar(userId, tk)).status, 200);
    assert.equal(falso.retrato(sub).cancel_at_period_end, true);
    assert.equal(falso.retrato(sub).status, "active");
  });

  // ── Notificações (Pub/Sub push) ───────────────────────────────────────────

  it("push sem OIDC válido: 401 e nada é lido", async () => {
    const tk = compraNoGoogle(token("push_invalido"), recurso("qualquer"));
    const agora = Math.floor(Date.now() / 1000);
    const invalidos = [
      null,
      await jwtPush({ aud: "https://outra.audiencia" }),
      await jwtPush({ email: "outra@projeto.iam.gserviceaccount.com" }),
      await jwtPush({ verificado: false }),
      await jwtPush({ iss: "https://emissor.falso" }),
      await jwtPush({ exp: agora - 60 }),
      await new SignJWT({ email: CONTA_PUSH, email_verified: true })
        .setProtectedHeader({ alg: "RS256", kid: "chave-push" })
        .setIssuer("https://accounts.google.com")
        .setAudience(AUDIENCIA)
        .setExpirationTime(agora + 600)
        .sign((await generateKeyPair("RS256")).privateKey),
    ];
    for (const jwt of invalidos) {
      const r = await notificar(notificacaoDeAssinatura(tk), { jwt });
      assert.equal(r.status, 401);
    }
    assert.equal(gets(tk), 0);
  });

  it("pacote da notificação diferente do configurado: registrada e ignorada, o Google nem é consultado", async () => {
    const tk = compraNoGoogle(token("pacote"), recurso("qualquer"));
    const r = await notificar(notificacaoDeAssinatura(tk, 4, "com.outro.app"));
    assert.equal(r.status, 200);
    assert.equal(r.corpo.resultado, "ignorada");
    assert.equal(gets(tk), 0);
  });

  it("mensagem repetida: processada uma vez", async () => {
    const userId = await usuario("repetida");
    await compras.garantirTokenDaConta(userId);
    const tk = compraNoGoogle(token("repetida"), recurso(lojas.tokenDaConta(userId)));
    const messageId = `${RUN}-repetida`;
    const resultados = [];
    for (let i = 0; i < 3; i++) resultados.push((await notificar(notificacaoDeAssinatura(tk), { messageId })).corpo.resultado);
    assert.deepEqual(resultados, ["processada", "repetida", "repetida"]);
    assert.equal(gets(tk), 1);
  });

  it("compra que o app não apresentou: a notificação acha a conta pelo token gravado e reconhece; sem token gravado, nada", async () => {
    const userId = await usuario("so_rtdn");
    await compras.garantirTokenDaConta(userId);
    const tk = compraNoGoogle(token("so_rtdn"), recurso(lojas.tokenDaConta(userId)));
    assert.equal((await notificar(notificacaoDeAssinatura(tk))).status, 200);
    const linha = await linhaDaCompra(tk);
    assert.equal(linha.userId, userId);
    assert.ok(linha.reconhecidaEm);
    assert.equal(await acesso(userId), "PREMIUM");

    const semToken = await usuario("so_rtdn_sem_token"); // nunca pediu o token
    const tk2 = compraNoGoogle(token("so_rtdn_sem_token"), recurso(lojas.tokenDaConta(semToken)));
    assert.equal((await notificar(notificacaoDeAssinatura(tk2))).status, 200);
    assert.equal(await linhaDaCompra(tk2), null);
    assert.equal(google.reconhecidas.includes(tk2), false);
    const n = await prisma.notificacaoLoja.findFirst({ where: { externalId: tk2 } });
    assert.equal(n.erro, "sem_dono");
  });

  it("reassinatura fora do app (outOfAppPurchaseContext): vai para a conta da compra vencida; conta divergente, nada", async () => {
    const userId = await usuario("reassinatura");
    const vencida = compraNoGoogle(token("reassinatura_vencida"), recurso(lojas.tokenDaConta(userId)));
    assert.equal((await apresentar(userId, vencida)).status, 200);
    Object.assign(google.assinaturas.get(vencida)!, { subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" });
    google.assinaturas.get(vencida)!.lineItems[0].expiryTime = new Date(Date.now() - DIA).toISOString();
    const nova = compraNoGoogle(
      token("reassinatura_nova"),
      recurso(null, { outOfAppPurchaseContext: { expiredPurchaseToken: vencida, expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: lojas.tokenDaConta(userId) } } }),
    );
    assert.equal((await notificar(notificacaoDeAssinatura(nova))).status, 200);
    assert.equal((await linhaDaCompra(nova)).userId, userId);
    assert.ok(google.reconhecidas.includes(nova), "reconhecida pelo servidor, sem o app aberto");

    const divergente = compraNoGoogle(
      token("reassinatura_divergente"),
      recurso(null, { outOfAppPurchaseContext: { expiredPurchaseToken: vencida, expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: "outra-conta" } } }),
    );
    await notificar(notificacaoDeAssinatura(divergente));
    assert.equal(await linhaDaCompra(divergente), null);
  });

  it("notificação de compra ligada a uma conta mas comprada por OUTRA conta: nada é concedido", async () => {
    const dono = await usuario("rtdn_ligada_dono");
    const outro = await usuario("rtdn_ligada_outro"); // nunca gravou o token
    const antiga = compraNoGoogle(token("rtdn_ligada_antiga"), recurso(lojas.tokenDaConta(dono)));
    assert.equal((await apresentar(dono, antiga)).status, 200);
    const nova = compraNoGoogle(token("rtdn_ligada_nova"), recurso(lojas.tokenDaConta(outro), { linkedPurchaseToken: antiga }));
    assert.equal((await notificar(notificacaoDeAssinatura(nova))).status, 200);
    assert.equal(await linhaDaCompra(nova), null);
    assert.equal((await prisma.notificacaoLoja.findFirst({ where: { externalId: nova } })).erro, "dono_divergente");
    assert.equal((await linhaDaCompra(antiga)).vigente, true);
  });

  it("transições pela notificação: suspensão tira o acesso, recuperação devolve, vencida encerra de vez e não é mais consultada", async () => {
    const userId = await usuario("transicoes");
    const tk = compraNoGoogle(token("transicoes"), recurso(lojas.tokenDaConta(userId)));
    assert.equal((await apresentar(userId, tk)).status, 200);
    const r = google.assinaturas.get(tk)!;

    r.subscriptionState = "SUBSCRIPTION_STATE_ON_HOLD";
    await notificar(notificacaoDeAssinatura(tk, 5));
    assert.equal(await acesso(userId), "FREE");
    r.subscriptionState = "SUBSCRIPTION_STATE_ACTIVE";
    await notificar(notificacaoDeAssinatura(tk, 1));
    assert.equal(await acesso(userId), "PREMIUM");

    r.subscriptionState = "SUBSCRIPTION_STATE_EXPIRED";
    r.lineItems[0].expiryTime = new Date(Date.now() - 1000).toISOString();
    r.lineItems[0].autoRenewingPlan.autoRenewEnabled = false;
    await notificar(notificacaoDeAssinatura(tk, 13));
    const linha = await linhaDaCompra(tk);
    assert.ok(linha.encerradaEm, "o Google disse que terminou de vez");
    assert.equal(await acesso(userId), "FREE");

    const { consultarLojasDoUsuario } = await import("../../src/lib/trocaDePlano");
    const antes = gets(tk);
    const s = await consultarLojasDoUsuario(userId);
    assert.deepEqual([s.compras, s.vigente, s.renova, s.desconhecida], [0, false, false, false]);
    assert.equal(gets(tk), antes, "compra encerrada de vez não é consultada");
  });

  it("reembolso com revogação (voidedPurchaseNotification): relê o Google e tira o acesso", async () => {
    const userId = await usuario("anulada");
    const tk = compraNoGoogle(token("anulada"), recurso(lojas.tokenDaConta(userId)));
    assert.equal((await apresentar(userId, tk)).status, 200);
    Object.assign(google.assinaturas.get(tk)!, { subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" });
    google.assinaturas.get(tk)!.lineItems[0].autoRenewingPlan.autoRenewEnabled = false;
    const r = await notificar({ version: "1.0", packageName: PACOTE, eventTimeMillis: String(Date.now()), voidedPurchaseNotification: { purchaseToken: tk, orderId: "GPA.1", productType: 1, refundType: 1 } });
    assert.equal(r.status, 200);
    assert.equal(await acesso(userId), "FREE");
  });

  it("autoRenewEnabled omitido (como o Google manda): cancelada mantém o acesso até o fim; revogada, anulada e vencida tiram; repetida e fora de ordem não mudam nada", async () => {
    const semFlag = (r: Recurso) => {
      delete r.lineItems[0].autoRenewingPlan.autoRenewEnabled;
      r.lineItems[0].autoRenewingPlan.recurringPrice = { units: "1" };
    };

    // Cancelada (3), período em curso: renovação desligada, acesso mantido.
    const cancelada = await usuario("omitido_cancelada");
    const tkC = compraNoGoogle(token("omitido_cancelada"), recurso(lojas.tokenDaConta(cancelada)));
    assert.equal((await apresentar(cancelada, tkC)).status, 200);
    Object.assign(google.assinaturas.get(tkC)!, { subscriptionState: "SUBSCRIPTION_STATE_CANCELED" });
    semFlag(google.assinaturas.get(tkC)!);
    const msgC = `${RUN}-omitido-cancelada`;
    assert.equal((await notificar(notificacaoDeAssinatura(tkC, 3), { messageId: msgC })).status, 200);
    let linha = await linhaDaCompra(tkC);
    assert.deepEqual([linha.vigente, linha.renova, linha.encerradaEm], [true, false, null]);
    assert.equal(await acesso(cancelada), "PREMIUM", "cancelar a renovação não encerra o período pago");
    assert.equal((await prisma.notificacaoLoja.findFirst({ where: { mensagemId: msgC } })).erro, null);

    // Mesma mensagem de novo: repetida, sem nova consulta.
    const antes = gets(tkC);
    const rep = await notificar(notificacaoDeAssinatura(tkC, 3), { messageId: msgC });
    assert.deepEqual([rep.status, rep.corpo.resultado], [200, "repetida"]);
    assert.equal(gets(tkC), antes);

    // Vencida (13): sem acesso, encerrada de vez.
    const r = google.assinaturas.get(tkC)!;
    r.subscriptionState = "SUBSCRIPTION_STATE_EXPIRED";
    r.lineItems[0].expiryTime = new Date(Date.now() - 1000).toISOString();
    await notificar(notificacaoDeAssinatura(tkC, 13));
    linha = await linhaDaCompra(tkC);
    assert.ok(linha.encerradaEm);
    assert.equal(await acesso(cancelada), "FREE");

    // Fora de ordem: uma "compra" (4) atrasada chega depois — relê o Google e nada volta.
    assert.equal((await notificar(notificacaoDeAssinatura(tkC, 4))).status, 200);
    assert.equal(await acesso(cancelada), "FREE");
    assert.ok((await linhaDaCompra(tkC)).encerradaEm);

    // Revogada (12): o Google devolve EXPIRED ainda com fim no futuro — acesso sai na hora.
    const revogada = await usuario("omitido_revogada");
    const tkR = compraNoGoogle(token("omitido_revogada"), recurso(lojas.tokenDaConta(revogada)));
    assert.equal((await apresentar(revogada, tkR)).status, 200);
    Object.assign(google.assinaturas.get(tkR)!, { subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" });
    semFlag(google.assinaturas.get(tkR)!);
    assert.equal((await notificar(notificacaoDeAssinatura(tkR, 12))).status, 200);
    assert.equal(await acesso(revogada), "FREE");
    assert.ok((await linhaDaCompra(tkR)).encerradaEm);

    // Anulada (reembolso): relê o Google (EXPIRED) — acesso sai.
    const anulada = await usuario("omitido_anulada");
    const tkA = compraNoGoogle(token("omitido_anulada"), recurso(lojas.tokenDaConta(anulada)));
    assert.equal((await apresentar(anulada, tkA)).status, 200);
    Object.assign(google.assinaturas.get(tkA)!, { subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" });
    semFlag(google.assinaturas.get(tkA)!);
    const v = await notificar({ version: "1.0", packageName: PACOTE, eventTimeMillis: String(Date.now()), voidedPurchaseNotification: { purchaseToken: tkA, orderId: "GPA.2", productType: 1, refundType: 1 } });
    assert.equal(v.status, 200);
    assert.equal(await acesso(anulada), "FREE");
  });

  it("Google fora do ar ao processar: 500 (o Pub/Sub reenvia) e a reentrega processa", async () => {
    const userId = await usuario("reentrega");
    await compras.garantirTokenDaConta(userId);
    const tk = compraNoGoogle(token("reentrega"), recurso(lojas.tokenDaConta(userId)));
    const messageId = `${RUN}-reentrega`;
    google.foraDoAr = true;
    assert.equal((await notificar(notificacaoDeAssinatura(tk), { messageId })).status, 500);
    assert.equal(await linhaDaCompra(tk), null);
    google.foraDoAr = false;
    const r = await notificar(notificacaoDeAssinatura(tk), { messageId });
    assert.deepEqual([r.status, r.corpo.resultado], [200, "processada"]);
    assert.equal((await linhaDaCompra(tk)).userId, userId);
  });

  it("renovação sem notificação (app fechado, aviso perdido ou atrasado): a consulta relê o Google; falha não vira expiração nem concede", async () => {
    const getSub = (await import("../../src/app/api/me/subscription/route")).GET;
    const consultar = async (userId: string) => {
      const res = await getSub(new Request("http://test/api/me/subscription", { headers: makeAuthHeaders(userId, "DIARISTA") }));
      const corpo = await res.json();
      return { plano: corpo.data?.plan ?? corpo.plan, verificacao: corpo.data?.verificacaoLoja ?? corpo.verificacaoLoja };
    };
    /** O tempo passa: o fim gravado e a última leitura ficam no passado. */
    const vencerLocalmente = (tk: string) =>
      prisma.assinaturaLoja.update({
        where: { provider_externalId: { provider: "GOOGLE", externalId: tk } },
        data: { expiraEm: new Date(Date.now() - 5_000), updatedAt: new Date(Date.now() - 60_000) },
      });
    const tentativas = (tk: string) => google.tentativas.filter((t) => t === tk).length;

    const userId = await usuario("renovacao_atrasada");
    const tk = compraNoGoogle(token("renovacao_atrasada"), recurso(lojas.tokenDaConta(userId), { fim: Date.now() + 300_000 }));
    assert.equal((await apresentar(userId, tk)).status, 200);
    assert.deepEqual(await consultar(userId), { plano: "PREMIUM", verificacao: null });
    const r = google.assinaturas.get(tk)!;

    // Google fora do ar: sem acesso (nada comprovado), mas também não "expirou".
    await vencerLocalmente(tk);
    google.foraDoAr = true;
    assert.deepEqual(await consultar(userId), { plano: "FREE", verificacao: "pendente" });
    // Releitura limitada também na falha: a próxima consulta não chama o Google de novo.
    const chamadas = tentativas(tk);
    assert.ok(chamadas >= 1);
    assert.deepEqual(await consultar(userId), { plano: "FREE", verificacao: "pendente" });
    assert.equal(tentativas(tk), chamadas);

    // Consultas simultâneas: uma só releitura; todas respondem pendente, nenhuma concede.
    await vencerLocalmente(tk);
    const antesDasSimultaneas = tentativas(tk);
    const respostas = await Promise.all(Array.from({ length: 6 }, () => consultar(userId)));
    assert.equal(tentativas(tk) - antesDasSimultaneas, 1);
    for (const resposta of respostas) assert.deepEqual(resposta, { plano: "FREE", verificacao: "pendente" });

    // A reserva está no banco, não no processo: gravada por "outra instância"
    // (escrita direta no banco), esta não chama o Google.
    await vencerLocalmente(tk);
    await prisma.$executeRawUnsafe(`UPDATE "AssinaturaLoja" SET "updatedAt" = (now() AT TIME ZONE 'UTC') WHERE "externalId" = $1`, tk);
    const antesDaOutra = tentativas(tk);
    assert.deepEqual(await consultar(userId), { plano: "FREE", verificacao: "pendente" });
    assert.equal(tentativas(tk), antesDaOutra);

    // Renovação ainda em processamento: ACTIVE com o fim já passado.
    google.foraDoAr = false;
    await vencerLocalmente(tk);
    r.lineItems[0].expiryTime = new Date(Date.now() - 2_000).toISOString();
    assert.deepEqual(await consultar(userId), { plano: "FREE", verificacao: "pendente" });

    // O Google renovou, sem notificação nenhuma: a consulta recupera o plano.
    await vencerLocalmente(tk);
    r.lineItems[0].expiryTime = new Date(Date.now() + 300_000).toISOString();
    assert.deepEqual(await consultar(userId), { plano: "PREMIUM", verificacao: null });
    assert.equal((await linhaDaCompra(tk)).userId, userId, "a compra não muda de dono");

    // Notificação atrasada e repetida depois da recuperação: nada muda.
    const messageId = `${RUN}-renovacao-atrasada`;
    for (let i = 0; i < 2; i++) assert.equal((await notificar(notificacaoDeAssinatura(tk, 2), { messageId })).status, 200);
    assert.deepEqual(await consultar(userId), { plano: "PREMIUM", verificacao: null });
    assert.equal(await prisma.assinaturaLoja.count({ where: { userId } }), 1);

    // Cancelada na loja: mantém até o fim; passado o fim, não relê nem fica pendente.
    r.subscriptionState = "SUBSCRIPTION_STATE_CANCELED";
    r.lineItems[0].autoRenewingPlan.autoRenewEnabled = false;
    await notificar(notificacaoDeAssinatura(tk, 3));
    assert.deepEqual(await consultar(userId), { plano: "PREMIUM", verificacao: null });
    await vencerLocalmente(tk);
    const antes = gets(tk);
    assert.deepEqual(await consultar(userId), { plano: "FREE", verificacao: null });
    assert.equal(gets(tk), antes, "sem renovação, o fim do período é a expiração");

    // Vencida no Google (renovação ligada até então): a releitura encerra de vez.
    const outro = await usuario("renovacao_vencida");
    const tkV = compraNoGoogle(token("renovacao_vencida"), recurso(lojas.tokenDaConta(outro)));
    assert.equal((await apresentar(outro, tkV)).status, 200);
    await vencerLocalmente(tkV);
    Object.assign(google.assinaturas.get(tkV)!, { subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" });
    google.assinaturas.get(tkV)!.lineItems[0].expiryTime = new Date(Date.now() - 5_000).toISOString();
    assert.deepEqual(await consultar(outro), { plano: "FREE", verificacao: null });
    assert.ok((await linhaDaCompra(tkV)).encerradaEm);
  });

  it("varredura do cron: renova as atrasadas de todas as contas e conta as falhas", async () => {
    const a = await usuario("varredura_a");
    const tkA = compraNoGoogle(token("varredura_a"), recurso(lojas.tokenDaConta(a)));
    assert.equal((await apresentar(a, tkA)).status, 200);
    await prisma.assinaturaLoja.update({
      where: { provider_externalId: { provider: "GOOGLE", externalId: tkA } },
      data: { expiraEm: new Date(Date.now() - 5_000), updatedAt: new Date(Date.now() - 60_000) },
    });
    google.foraDoAr = true;
    const falhou = await compras.sincronizarRenovacoesAtrasadas();
    assert.ok(falhou.falhas >= 1 && falhou.pendente);
    assert.equal(await acesso(a), "FREE");
    google.foraDoAr = false;
    await prisma.assinaturaLoja.update({ where: { provider_externalId: { provider: "GOOGLE", externalId: tkA } }, data: { updatedAt: new Date(Date.now() - 60_000) } });
    const ok = await compras.sincronizarRenovacoesAtrasadas();
    assert.ok(ok.sincronizadas >= 1);
    assert.equal(await acesso(a), "PREMIUM");
  });

  it("notificação de teste do Play Console: 200, nada consultado", async () => {
    const antes = google.chamadas.length;
    const r = await notificar({ version: "1.0", packageName: PACOTE, eventTimeMillis: String(Date.now()), testNotification: { version: "1.0" } });
    assert.deepEqual([r.status, r.corpo.resultado], [200, "teste"]);
    assert.equal(google.chamadas.filter((c) => c !== "oauth").length, google.chamadas.slice(0, antes).filter((c) => c !== "oauth").length);
  });
});
