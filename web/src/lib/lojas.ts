import { createHash } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import { PLANS, type PlanDef } from "@/lib/stripe";
import { conferirBancoDoAmbiente } from "@/lib/ambientePreview";

/**
 * Verificação e consulta de assinatura na App Store e no Google Play.
 *
 * Por que verificar no servidor: o app manda um recibo, e recibo é dado que
 * vem do cliente. Confiar nele é entregar plano PREMIUM a quem souber montar
 * um JSON. Quem decide se a compra existe — e se ainda vale — é a loja, e é
 * ela que respondemos.
 *
 * A verificação e a consulta reais ainda NÃO existem (issue #359: falta a
 * integração com a App Store Server API e a Play Developer API, as
 * notificações das lojas e a compra dentro do app). Até lá as duas falham:
 * sem credencial, `CREDENCIAIS_AUSENTES`; com ela, `LOJA_INDISPONIVEL`. A rota
 * traduz em 503 — "ainda não disponível", não "compra inválida" — e
 * `lojasProntas()` segue falso mesmo com credencial: o app não é mandado para
 * uma compra que o servidor não confirma.
 */

export type LojaProvedor = "APPLE" | "GOOGLE";

/** O que a loja responde sobre uma compra de assinatura, no momento da consulta. */
export type SituacaoNaLoja = {
  /** Identidade estável da compra: `originalTransactionId` (Apple), `purchaseToken` (Google). */
  externalId: string;
  /** Id do produto na loja, que o catálogo traduz em plano. */
  storeProductId: string;
  /** Início desta compra na loja (Apple `originalPurchaseDate`, Google `startTime`). */
  compradaEm: Date;
  /** Período pago em curso. */
  vigente: boolean;
  /** Renovação automática ligada: a loja ainda vai cobrar. */
  renova: boolean;
  /** Fim do período pago. */
  expiraEm: Date | null;
  /**
   * Conta que comprou: `appAccountToken` (Apple) ou `obfuscatedExternalAccountId`
   * (Google), que o app grava na compra com `tokenDaConta()`. Nulo: a compra não
   * diz de quem é, e nada é feito com ela.
   */
  dono: string | null;
  /** Google: plano base confirmado (`offerDetails.basePlanId`). */
  planoBase?: string | null;
  /** Estado bruto da loja (ex.: SUBSCRIPTION_STATE_ON_HOLD). */
  estadoLoja?: string | null;
  /** A loja já registrou o reconhecimento da compra. */
  reconhecida?: boolean;
  /** Compra de teste (testador de licença). */
  teste?: boolean;
  /** Compra anterior que esta substitui (Google `linkedPurchaseToken`). */
  substitui?: string | null;
  /** Encerrada de vez na loja: não volta (Google: vencida ou cancelada antes do pagamento). */
  final?: boolean;
  /** Reassinatura fora do app (Google `outOfAppPurchaseContext`): a compra vencida anterior e o token da conta dela. */
  compraAnteriorVencida?: string | null;
  donoAnterior?: string | null;
};

const dataValida = (v: unknown) => v instanceof Date && !Number.isNaN(v.getTime());

/**
 * A resposta da loja traz TODOS os campos, com o tipo certo? Faltou um (a
 * renovação, a vigência, o produto), ou veio de outro tipo: a situação é
 * DESCONHECIDA — nunca "renovação desligada" nem "fora do período".
 */
export function situacaoCompleta(s: unknown): s is SituacaoNaLoja {
  if (typeof s !== "object" || s === null) return false;
  const x = s as Record<string, unknown>;
  return (
    typeof x.externalId === "string" &&
    x.externalId !== "" &&
    typeof x.storeProductId === "string" &&
    x.storeProductId !== "" &&
    dataValida(x.compradaEm) &&
    typeof x.vigente === "boolean" &&
    typeof x.renova === "boolean" &&
    (x.expiraEm === null || dataValida(x.expiraEm)) &&
    (x.dono === null || typeof x.dono === "string")
  );
}

export class ErroDeLoja extends Error {
  constructor(
    readonly codigo: "CREDENCIAIS_AUSENTES" | "COMPRA_INVALIDA" | "COMPRA_PENDENTE" | "LOJA_INDISPONIVEL",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

// ── Apple ───────────────────────────────────────────────────────────────────
// A App Store Server API v2 responde JWS assinado. A verificação exige a chave
// privada (.p8) + issuer + keyId do App Store Connect.
const APPLE_ENV = {
  keyId: process.env.APPLE_IAP_KEY_ID,
  issuerId: process.env.APPLE_IAP_ISSUER_ID,
  privateKey: process.env.APPLE_IAP_PRIVATE_KEY,
  bundleId: process.env.APPLE_IAP_BUNDLE_ID,
};

export function credenciaisApleProntas(): boolean {
  return Boolean(APPLE_ENV.keyId && APPLE_ENV.issuerId && APPLE_ENV.privateKey && APPLE_ENV.bundleId);
}

// ── Google ──────────────────────────────────────────────────────────────────
// A Play Developer API pede uma conta de serviço com acesso ao app. O pacote
// vem da configuração (GOOGLE_PLAY_PACKAGE_NAME) e é exigido EXATO em toda
// chamada e em toda notificação: compra de outro app nunca é aceita.

/** Formato de pacote Android: segmentos de letras minúsculas, dígitos e `_`, separados por ponto. */
const FORMATO_DO_PACOTE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/** Pacote Android configurado, ou nulo se ausente ou fora do formato. */
export function pacoteGooglePlay(): string | null {
  const pacote = (process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "").trim();
  return FORMATO_DO_PACOTE.test(pacote) ? pacote : null;
}

export function credenciaisGoogleProntas(): boolean {
  return Boolean(pacoteGooglePlay() && process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

function semIntegracao(provider: LojaProvedor): never {
  if (provider === "APPLE" && !credenciaisApleProntas()) {
    throw new ErroDeLoja(
      "CREDENCIAIS_AUSENTES",
      "APPLE_IAP_* não configurado. Cadastre os produtos no App Store Connect e gere a chave da App Store Server API.",
    );
  }
  if (provider === "GOOGLE" && !credenciaisGoogleProntas()) {
    throw new ErroDeLoja(
      "CREDENCIAIS_AUSENTES",
      "GOOGLE_PLAY_* não configurado. Cadastre os produtos no Play Console e crie a conta de serviço.",
    );
  }
  // Apple: GET /inApps/v1/subscriptions/{transactionId}, JWS validado com as
  // chaves da Apple. Google: purchases.subscriptionsv2.get. Os dois devolvem
  // produto, identidade, início, fim, renovação e o token da conta.
  throw new ErroDeLoja("LOJA_INDISPONIVEL", `Verificação ${provider === "APPLE" ? "Apple" : "Google"} ainda não implementada.`);
}

/**
 * Quem responde pela loja. `verificar` recebe o comprovante que o app mandou
 * (`transactionId` no iOS, `purchaseToken` no Android); `consultar`, a
 * identidade de uma compra já registrada. As duas devolvem a situação ATUAL na
 * loja ou lançam ErroDeLoja — nunca um palpite. Os testes trocam as funções por
 * uma loja simulada; `implementada` só vira verdadeiro com a integração real.
 */
export const loja = {
  verificar: async (provider: LojaProvedor, comprovante: string, _produtoId: string): Promise<SituacaoNaLoja> =>
    provider === "GOOGLE" && googlePlayLigado() ? consultarAssinaturaGoogle(comprovante) : semIntegracao(provider),
  consultar: async (provider: LojaProvedor, externalId: string): Promise<SituacaoNaLoja> =>
    provider === "GOOGLE" && googlePlayLigado() ? consultarAssinaturaGoogle(externalId) : semIntegracao(provider),
  /** Integração ligada. Só vira verdadeiro com a homologação real (issue #359). */
  implementada: { APPLE: false, GOOGLE: false } as Record<LojaProvedor, boolean>,
};

/**
 * Google Play ligado? Pelo código (`loja.implementada.GOOGLE`, homologação
 * concluída) ou, para homologar, por `DULAR_GOOGLE_PLAY_PREVIEW=ligado` — que
 * só vale num Preview da Vercel com o banco de staging validado
 * (lib/ambientePreview). Em produção, local ou com o banco errado, a variável
 * é ignorada e as compras seguem desligadas.
 */
export function googlePlayLigado(env: Record<string, string | undefined> = process.env): boolean {
  if (loja.implementada.GOOGLE) return true;
  if (env.VERCEL_ENV !== "preview" || env.DULAR_GOOGLE_PLAY_PREVIEW !== "ligado") return false;
  try {
    conferirBancoDoAmbiente(env);
    return true;
  } catch {
    return false;
  }
}

/** As lojas estão prontas para receber compra? Usado pelo app para escolher o caminho. */
export function lojasProntas() {
  return {
    apple: loja.implementada.APPLE && credenciaisApleProntas(),
    google: googlePlayLigado() && credenciaisGoogleProntas(),
  };
}

/**
 * Token da conta para a loja: um UUID fixo por usuário, que o app grava na
 * compra (`appAccountToken` / `obfuscatedExternalAccountId`). A verificação só
 * aceita a compra se a loja devolver este mesmo token.
 */
export function tokenDaConta(userId: string): string {
  const h = createHash("sha256").update(`dular-loja:${userId}`).digest("hex");
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Plano do catálogo para a compra que a LOJA confirmou: o produto e, no
 * Google, o plano base. Nunca o que o app pediu. Fora do catálogo: nulo.
 */
export function planoDaSituacao(provider: LojaProvedor, s: SituacaoNaLoja): PlanDef | null {
  const plano = Object.values(PLANS).find((p) => p.storeProductId === s.storeProductId) ?? null;
  if (!plano) return null;
  if (provider === "GOOGLE" && s.planoBase !== plano.storeBasePlanId) return null;
  return plano;
}

// ── Google Play Developer API ───────────────────────────────────────────────

const API_GOOGLE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const ESCOPO = "https://www.googleapis.com/auth/androidpublisher";
const TOKEN_URI = "https://oauth2.googleapis.com/token";

/** Rede do Google. Os testes trocam por um servidor simulado. */
export const googlePlay = {
  buscar: (url: string, init?: RequestInit): Promise<Response> => fetch(url, init),
};

let acessoGoogle: { token: string; valeAte: number; conta: string } | null = null;

function configGoogle(): { pacote: string; email: string; chave: string } {
  const pacote = pacoteGooglePlay();
  let conta: { client_email?: unknown; private_key?: unknown } | null = null;
  try {
    conta = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? "");
  } catch {
    conta = null;
  }
  if (!pacote || typeof conta?.client_email !== "string" || typeof conta?.private_key !== "string") {
    throw new ErroDeLoja("CREDENCIAIS_AUSENTES", "GOOGLE_PLAY_PACKAGE_NAME ou GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ausente ou inválido.");
  }
  return { pacote, email: conta.client_email, chave: conta.private_key };
}

/** Token de acesso da conta de serviço (JWT assinado → OAuth), reaproveitado até perto de vencer. */
async function tokenDeAcessoGoogle(): Promise<string> {
  const { email, chave } = configGoogle();
  if (acessoGoogle && acessoGoogle.conta === email && acessoGoogle.valeAte > Date.now() + 60_000) return acessoGoogle.token;
  const agora = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: ESCOPO })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience(TOKEN_URI)
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(await importPKCS8(chave, "RS256"));
  const res = await googlePlay.buscar(TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const corpo = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  if (!res.ok || typeof corpo?.access_token !== "string") {
    registrarErroGoogle("oauth", res.status, corpo);
    throw new ErroDeLoja("LOJA_INDISPONIVEL", `Google OAuth respondeu ${res.status}.`);
  }
  const validade = typeof corpo.expires_in === "number" ? corpo.expires_in : 3600;
  acessoGoogle = { token: corpo.access_token, valeAte: Date.now() + validade * 1000, conta: email };
  return acessoGoogle.token;
}

async function chamarGoogle(caminho: string, init: RequestInit = {}): Promise<Response> {
  const { pacote } = configGoogle();
  const token = await tokenDeAcessoGoogle();
  return googlePlay.buscar(`${API_GOOGLE}/${encodeURIComponent(pacote)}${caminho}`, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, accept: "application/json" },
  });
}

/** Situação ATUAL de uma assinatura no Google Play (`purchases.subscriptionsv2.get`). */
export async function consultarAssinaturaGoogle(purchaseToken: string): Promise<SituacaoNaLoja> {
  if (!purchaseToken) throw new ErroDeLoja("COMPRA_INVALIDA", "Comprovante vazio.");
  let res: Response;
  try {
    res = await chamarGoogle(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  } catch (err) {
    if (err instanceof ErroDeLoja) throw err;
    throw new ErroDeLoja("LOJA_INDISPONIVEL", "Google Play fora do ar.");
  }
  if (!res.ok) {
    const erro = registrarErroGoogle("consulta", res.status, await res.json().catch(() => null));
    // O Google não enxerga o APP (conta de serviço sem acesso, app sem pacote
    // enviado): é configuração nossa, não comprovante ruim. Indisponível, para
    // o app tentar de novo — nunca "compra inválida" para quem pagou.
    if (erro.reason === "applicationNotFound") throw new ErroDeLoja("LOJA_INDISPONIVEL", `Google respondeu ${res.status} (app não encontrado).`);
    // Token de outro app, inexistente ou malformado: compra inválida, nunca "indisponível".
    if (res.status === 400 || res.status === 404 || res.status === 410) throw new ErroDeLoja("COMPRA_INVALIDA", `Google respondeu ${res.status}.`);
    throw new ErroDeLoja("LOJA_INDISPONIVEL", `Google respondeu ${res.status}.`);
  }
  return situacaoDoGoogle(await res.json(), purchaseToken, Date.now());
}

/** Reconhece a compra (`purchases.subscriptions.acknowledge`). Sem isso em 3 dias, o Google reembolsa e revoga. */
export async function reconhecerCompraGoogle(storeProductId: string, purchaseToken: string): Promise<void> {
  const res = await chamarGoogle(
    `/purchases/subscriptions/${encodeURIComponent(storeProductId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
  );
  if (!res.ok) {
    registrarErroGoogle("reconhecimento", res.status, await res.json().catch(() => null));
    throw new ErroDeLoja("LOJA_INDISPONIVEL", `Google acknowledge respondeu ${res.status}.`);
  }
}

// ── Diagnóstico dos erros do Google ─────────────────────────────────────────
// No log vão só o código HTTP e dois campos do erro, cada um conferido contra
// uma lista fechada: valor fora dela vira "OUTRO", campo ausente vira
// "AUSENTE". Nunca a mensagem, o corpo, o token de acesso, o comprovante ou a
// conta de serviço — a mensagem do Google pode citar qualquer um deles.

/** `error.status` da API (códigos canônicos do Google). No OAuth, o campo `error`. */
const STATUS_DO_GOOGLE = new Set([
  "INVALID_ARGUMENT",
  "FAILED_PRECONDITION",
  "OUT_OF_RANGE",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "ABORTED",
  "RESOURCE_EXHAUSTED",
  "CANCELLED",
  "DATA_LOSS",
  "UNKNOWN",
  "INTERNAL",
  "NOT_IMPLEMENTED",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
  // OAuth (oauth2.googleapis.com/token)
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
  "invalid_request",
  "invalid_scope",
  "access_denied",
]);

/** `error.errors[0].reason` da Play Developer API. */
const MOTIVOS_DO_GOOGLE = new Set([
  "invalid",
  "required",
  "notFound",
  "purchaseTokenNoLongerValid",
  "subscriptionPurchaseNoLongerAvailable",
  "permissionDenied",
  "forbidden",
  "insufficientPermissions",
  "authError",
  "unauthorized",
  "applicationNotFound",
  "packageNameNotFound",
  "accessNotConfigured",
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "quotaExceeded",
  "backendError",
  "internalError",
]);

export type DiagnosticoGoogle = {
  etapa: "oauth" | "consulta" | "reconhecimento";
  http: number;
  status: string;
  reason: string;
};

function permitido(valor: unknown, lista: Set<string>): string {
  if (valor === undefined || valor === null) return "AUSENTE";
  return typeof valor === "string" && lista.has(valor) ? valor : "OUTRO";
}

/** O que do erro do Google pode ir para o log. Puro, para o teste conferir. */
export function diagnosticoDoErroGoogle(etapa: DiagnosticoGoogle["etapa"], http: number, corpo: unknown): DiagnosticoGoogle {
  const c = (typeof corpo === "object" && corpo !== null ? corpo : {}) as Record<string, unknown>;
  const codigoHttp = Number.isInteger(http) && http >= 100 && http <= 599 ? http : 0;
  if (etapa === "oauth") return { etapa, http: codigoHttp, status: permitido(c.error, STATUS_DO_GOOGLE), reason: "AUSENTE" };
  const erro = (typeof c.error === "object" && c.error !== null ? c.error : {}) as {
    status?: unknown;
    errors?: { reason?: unknown }[];
  };
  const motivo = Array.isArray(erro.errors) ? erro.errors[0]?.reason : undefined;
  return { etapa, http: codigoHttp, status: permitido(erro.status, STATUS_DO_GOOGLE), reason: permitido(motivo, MOTIVOS_DO_GOOGLE) };
}

function registrarErroGoogle(etapa: DiagnosticoGoogle["etapa"], http: number, corpo: unknown): DiagnosticoGoogle {
  const diagnostico = diagnosticoDoErroGoogle(etapa, http, corpo);
  console.warn("[google-play] erro do Google", JSON.stringify(diagnostico));
  return diagnostico;
}

/** Estados em que o período pago está em curso (com `expiryTime` no futuro). */
const ESTADOS_EM_PERIODO = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_CANCELED", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"]);
/** Estados em que o Google ainda vai cobrar, se a renovação estiver ligada. */
const ESTADOS_QUE_RENOVAM = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_ON_HOLD",
  "SUBSCRIPTION_STATE_PAUSED",
]);
/** Estados finais: o token nunca volta (reassinatura gera token novo). */
const ESTADOS_FINAIS = new Set(["SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"]);
const ESTADOS_CONHECIDOS = new Set([...ESTADOS_EM_PERIODO, ...ESTADOS_QUE_RENOVAM, ...ESTADOS_FINAIS, "SUBSCRIPTION_STATE_PENDING"]);

const dataDoGoogle = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * `SubscriptionPurchaseV2` → situação na loja. Pura. Resposta fora do esperado
 * nunca vira "renovação desligada": estado desconhecido ou campo faltando →
 * LOJA_INDISPONIVEL (desconhecida); mais de um item (complemento, que o Dular
 * não vende) → COMPRA_INVALIDA; pagamento pendente → COMPRA_PENDENTE.
 */
export function situacaoDoGoogle(recurso: unknown, purchaseToken: string, agora: number): SituacaoNaLoja {
  const r = (typeof recurso === "object" && recurso !== null ? recurso : {}) as Record<string, any>;
  const estado = typeof r.subscriptionState === "string" ? r.subscriptionState : "";
  if (!ESTADOS_CONHECIDOS.has(estado)) throw new ErroDeLoja("LOJA_INDISPONIVEL", `Estado do Google desconhecido: ${estado || "(vazio)"}.`);
  if (estado === "SUBSCRIPTION_STATE_PENDING") throw new ErroDeLoja("COMPRA_PENDENTE", "Pagamento pendente no Google Play.");
  const itens = Array.isArray(r.lineItems) ? r.lineItems : [];
  if (itens.length !== 1) throw new ErroDeLoja("COMPRA_INVALIDA", `A compra tem ${itens.length} itens; o Dular vende uma assinatura por compra.`);
  const item = itens[0] ?? {};
  const compradaEm = dataDoGoogle(r.startTime);
  const expiraEm = dataDoGoogle(item.expiryTime);
  // Renovação automática (não confundir com acesso, que segue estado e fim):
  // - autoRenewingPlan presente: autoRenewEnabled. A API omite booleanos
  //   falsos, e com a renovação desligada (CANCELED, EXPIRED) o campo some —
  //   ausente, dentro do plano, é false. Medido no staging; o Google documenta
  //   autoRenewEnabled=false para CANCELED.
  // - prepaidPlan (pré-pago): não renova.
  // - nenhum dos dois: desconhecido, e a resposta é recusada.
  const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  const renovacao: unknown = objeto(item.autoRenewingPlan)
    ? (item.autoRenewingPlan.autoRenewEnabled ?? false)
    : objeto(item.prepaidPlan)
      ? false
      : undefined;
  if (!compradaEm || !expiraEm || typeof item.productId !== "string" || typeof renovacao !== "boolean") {
    // Diagnóstico: só NOMES dos campos e a ESTRUTURA do item (presença e
    // tipo), nunca valores — o recurso traz token, conta e preço.
    const faltando = [
      !compradaEm && "startTime",
      !expiraEm && "lineItems[0].expiryTime",
      typeof item.productId !== "string" && "lineItems[0].productId",
      typeof renovacao !== "boolean" && "lineItems[0].autoRenewingPlan|prepaidPlan",
    ].filter(Boolean);
    const tipo = (v: unknown) => (v === undefined ? "ausente" : v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
    throw new ErroDeLoja(
      "LOJA_INDISPONIVEL",
      `Resposta do Google incompleta: falta ${faltando.join(", ")}; estado=${estado}; ` +
        `item{autoRenewingPlan=${tipo(item.autoRenewingPlan)}, autoRenewEnabled=${tipo(item.autoRenewingPlan?.autoRenewEnabled)}, ` +
        `prepaidPlan=${tipo(item.prepaidPlan)}, expiryTime=${tipo(item.expiryTime)}}; startTime=${tipo(r.startTime)}.`,
    );
  }
  const contexto = r.outOfAppPurchaseContext ?? r.outofAppPurchaseContext ?? null;
  return {
    externalId: purchaseToken,
    storeProductId: item.productId,
    compradaEm,
    vigente: ESTADOS_EM_PERIODO.has(estado) && expiraEm.getTime() > agora,
    renova: renovacao && ESTADOS_QUE_RENOVAM.has(estado),
    expiraEm,
    dono: textoOuNulo(r.externalAccountIdentifiers?.obfuscatedExternalAccountId),
    planoBase: textoOuNulo(item.offerDetails?.basePlanId),
    estadoLoja: estado,
    reconhecida: r.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    teste: r.testPurchase != null,
    substitui: textoOuNulo(r.linkedPurchaseToken),
    final: ESTADOS_FINAIS.has(estado),
    compraAnteriorVencida: textoOuNulo(contexto?.expiredPurchaseToken),
    donoAnterior: textoOuNulo(contexto?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId),
  };
}
