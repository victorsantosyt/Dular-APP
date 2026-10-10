import { createHash } from "node:crypto";

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
    readonly codigo: "CREDENCIAIS_AUSENTES" | "COMPRA_INVALIDA" | "LOJA_INDISPONIVEL",
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
// A Play Developer API pede uma conta de serviço com acesso ao app.
const GOOGLE_ENV = {
  packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME,
  serviceAccount: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
};

export function credenciaisGoogleProntas(): boolean {
  return Boolean(GOOGLE_ENV.packageName && GOOGLE_ENV.serviceAccount);
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
  verificar: async (provider: LojaProvedor, _comprovante: string, _produtoId: string): Promise<SituacaoNaLoja> => semIntegracao(provider),
  consultar: async (provider: LojaProvedor, _externalId: string): Promise<SituacaoNaLoja> => semIntegracao(provider),
  implementada: { APPLE: false, GOOGLE: false } as Record<LojaProvedor, boolean>,
};

/** As lojas estão prontas para receber compra? Usado pelo app para escolher o caminho. */
export function lojasProntas() {
  return {
    apple: loja.implementada.APPLE && credenciaisApleProntas(),
    google: loja.implementada.GOOGLE && credenciaisGoogleProntas(),
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
