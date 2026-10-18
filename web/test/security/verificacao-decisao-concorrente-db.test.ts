import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Aprovação/reprovação de documentos com pedidos simultâneos (duplo clique,
 * duas abas, dois admins): para a mesma verificação, UMA transição de estado,
 * UM evento KYC no SafeScore e UM aviso. A decisão é um UPDATE condicional no
 * banco; o aviso é gravado na mesma transação; o push vem depois, best-effort.
 *
 * Postgres real (SAFESCORE_DB_URL local). Os pedidos correm em paralelo: cada
 * transação interativa ocupa a sua própria conexão do pool.
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";
const PARALELOS = 8;

describe("decisão de verificação com pedidos simultâneos (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let aprovar: (r: Request) => Promise<Response>;
  let reprovar: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_decisao_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let admin = "";
  let ip = 0;
  const fetchOriginal = globalThis.fetch;
  const envOriginal = { ...process.env };

  async function usuario(sufixo: string, role: string, extra: Record<string, unknown> = {}) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status: "ATIVO", ...extra } });
    ids.push(id);
    return id;
  }

  async function diaristaComDocumento(sufixo: string, extra: Record<string, unknown> = {}) {
    const u = await usuario(sufixo, "DIARISTA", extra);
    await prisma.diaristaProfile.create({ data: { userId: u, precoLeve: 100, precoPesada: 200 } });
    const v = await prisma.documentVerification.create({ data: { userId: u, docType: "KYC_DOCS", docUrl: "{}" } });
    return { u, v: v.id };
  }

  // IP diferente por pedido: o limite de 30/min por IP do painel não entra no teste.
  const pedido = (verificationId: string, motivo = "teste de concorrência") =>
    new Request("http://test/api/admin/verificacoes/x", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.9.${Math.floor(++ip / 250)}.${ip % 250}`,
        ...makeAuthHeaders(admin, "ADMIN"),
      },
      body: JSON.stringify({ verificationId, motivo }),
    });

  async function emParalelo(rota: (r: Request) => Promise<Response>, verificationId: string) {
    const respostas = await Promise.all(Array.from({ length: PARALELOS }, () => rota(pedido(verificationId))));
    for (const r of respostas) assert.equal(r.status, 200, "todo pedido conclui");
  }

  const avisos = (userId: string, type: string) => prisma.notification.count({ where: { userId, type } });
  const eventosKyc = async (userId: string, tipo: "KYC_APROVADO" | "KYC_REJEITADO") => ({
    v2: await prisma.safeScoreEvent.count({ where: { userId, eventType: tipo === "KYC_APROVADO" ? "kyc_aprovado" : "kyc_rejeitado" } }),
    legado: await prisma.scoreEvento.count({ where: { tipo, safeScore: { userId } } }),
  });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    delete process.env.VERCEL_ENV;
    ({ prisma } = await import("../../src/lib/prisma"));
    aprovar = (await import("../../src/app/api/admin/verificacoes/approve/route")).POST;
    reprovar = (await import("../../src/app/api/admin/verificacoes/reprove/route")).POST;
    ({ makeAuthHeaders } = await import("./_helpers"));
    admin = await usuario("admin", "ADMIN");
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    for (const k of ["VERCEL_ENV", "DULAR_PUSH_PREVIEW", "DULAR_PUSH_PREVIEW_BLOQUEADOS"]) {
      if (envOriginal[k] === undefined) delete process.env[k];
      else process.env[k] = envOriginal[k];
    }
  });

  after(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.documentVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.scoreEvento.deleteMany({ where: { safeScore: { userId: { in: ids } } } });
    await prisma.safeScore.deleteMany({ where: { userId: { in: ids } } });
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it(`${PARALELOS} aprovações simultâneas: uma transição, um evento KYC, um aviso`, async () => {
    const { u, v } = await diaristaComDocumento("aprova");
    await emParalelo(aprovar, v);
    assert.equal((await prisma.documentVerification.findUnique({ where: { id: v } })).status, "APPROVED");
    assert.equal((await prisma.diaristaProfile.findUnique({ where: { userId: u } })).verificacao, "VERIFICADO");
    assert.equal(await avisos(u, "VERIFICACAO_APROVADA"), 1, "um aviso");
    assert.deepEqual(await eventosKyc(u, "KYC_APROVADO"), { v2: 1, legado: 1 }, "um evento KYC");
  });

  it("reprovar e aprovar de novo, cada um em paralelo: um aviso por transição; o KYC continua idempotente", async () => {
    const { u, v } = await diaristaComDocumento("vaivem");
    await emParalelo(aprovar, v);
    await emParalelo(reprovar, v);
    assert.equal((await prisma.documentVerification.findUnique({ where: { id: v } })).status, "REJECTED");
    assert.equal(await avisos(u, "VERIFICACAO_REPROVADA"), 1);
    await emParalelo(aprovar, v);
    assert.equal(await avisos(u, "VERIFICACAO_APROVADA"), 2, "nova transição, novo aviso");
    assert.equal(await avisos(u, "VERIFICACAO_REPROVADA"), 1);
    assert.deepEqual(await eventosKyc(u, "KYC_APROVADO"), { v2: 1, legado: 1 }, "a mesma verificação não pontua duas vezes");
    assert.deepEqual(await eventosKyc(u, "KYC_REJEITADO"), { v2: 1, legado: 1 });
  });

  it("falha no envio do push: decisão e aviso gravados uma vez; push tentado uma vez; nada do token no log", async () => {
    const token = "ExponentPushToken[TOKEN-DE-TESTE-NAO-ENVIAR]";
    const { u, v } = await diaristaComDocumento("pushfalha", { pushToken: token });
    let tentativas = 0;
    globalThis.fetch = (async () => { tentativas++; throw new Error(`rede caiu ${token}`); }) as typeof fetch;
    const linhas: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error };
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { linhas.push(a.map(String).join(" ")); };
    try {
      await emParalelo(reprovar, v);
    } finally {
      Object.assign(console, orig);
    }
    assert.equal((await prisma.documentVerification.findUnique({ where: { id: v } })).status, "REJECTED");
    assert.equal(await avisos(u, "VERIFICACAO_REPROVADA"), 1, "o aviso persiste mesmo sem push");
    assert.equal(tentativas, 1, "push tentado só pela transição");
    assert.doesNotMatch(linhas.join("\n"), /TOKEN-DE-TESTE|ExponentPushToken/);
  });

  it("preview com push liberado: conta testadora bloqueada não recebe push, mas o aviso é gravado; outra conta recebe", async () => {
    const token = "ExponentPushToken[TOKEN-DE-TESTE-PREVIEW]";
    const bloqueada = await diaristaComDocumento("bloqueada", { pushToken: token });
    const livre = await diaristaComDocumento("livre", { pushToken: token });
    Object.assign(process.env, { VERCEL_ENV: "preview", DULAR_PUSH_PREVIEW: "ligado", DULAR_PUSH_PREVIEW_BLOQUEADOS: ` outra-conta , ${bloqueada.u} ` });
    const destinos: string[] = [];
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      destinos.push(String(JSON.parse(init?.body ?? "{}").data?.destinatarioId));
      return new Response(JSON.stringify({ data: { status: "ok" } }));
    }) as typeof fetch;
    const linhas: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => { linhas.push(a.map(String).join(" ")); };
    try {
      await aprovar(pedido(bloqueada.v));
      await aprovar(pedido(livre.v));
    } finally {
      console.log = orig;
    }
    assert.equal(await avisos(bloqueada.u, "VERIFICACAO_APROVADA"), 1, "aviso gravado para a conta bloqueada");
    assert.deepEqual(destinos, [livre.u], "push só para a conta não bloqueada");
    const log = linhas.join("\n");
    assert.match(log, /\[push\] preview: conta sem push \(teste\) conta=[0-9a-f]{12}/);
    assert.doesNotMatch(log, new RegExp(`${bloqueada.u}|ExponentPushToken`), "log sem id nem token");
  });

  it("a lista de bloqueio é ignorada fora do Preview", async () => {
    const { pushBloqueadoNoPreview } = await import("../../src/lib/ambientePreview");
    assert.equal(pushBloqueadoNoPreview("u1", { VERCEL_ENV: "production", DULAR_PUSH_PREVIEW_BLOQUEADOS: "u1" }), false);
    assert.equal(pushBloqueadoNoPreview("u1", { DULAR_PUSH_PREVIEW_BLOQUEADOS: "u1" }), false);
    assert.equal(pushBloqueadoNoPreview("u1", { VERCEL_ENV: "preview", DULAR_PUSH_PREVIEW_BLOQUEADOS: "u2,u1" }), true);
    assert.equal(pushBloqueadoNoPreview("u1", { VERCEL_ENV: "preview" }), false);
  });
});
