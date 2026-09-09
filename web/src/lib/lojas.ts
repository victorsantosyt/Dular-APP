/**
 * Verificação de compra na App Store e no Google Play.
 *
 * Por que verificar no servidor: o app manda um recibo, e recibo é dado que
 * vem do cliente. Confiar nele é entregar plano PREMIUM a quem souber montar
 * um JSON. Quem decide se a compra existe é a loja, e é ela que respondemos.
 *
 * As credenciais ainda NÃO existem — falta cadastrar os produtos e gerar as
 * chaves. Até lá, cada verificador falha com `CREDENCIAIS_AUSENTES`, que a
 * rota traduz em 503: "ainda não disponível", não "compra inválida". A
 * diferença importa — dizer que a compra é inválida para quem pagou de
 * verdade é o pior desfecho possível.
 */

export type CompraVerificada = {
  /** Id do produto na loja, que o catálogo traduz em plano. */
  storeProductId: string;
  /**
   * Identidade estável da assinatura, para renovações caírem no mesmo
   * registro: `originalTransactionId` na Apple, `purchaseToken` no Google.
   */
  externalId: string;
  /** Fim do período pago, informado pela loja. */
  expiraEm: Date | null;
};

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

export async function verificarCompraApple(_transactionId: string): Promise<CompraVerificada> {
  if (!credenciaisApleProntas()) {
    throw new ErroDeLoja(
      "CREDENCIAIS_AUSENTES",
      "APPLE_IAP_* não configurado. Cadastre os produtos no App Store Connect e gere a chave da App Store Server API.",
    );
  }
  // Implementar com a App Store Server API assim que houver credencial:
  // GET /inApps/v1/subscriptions/{transactionId}, validar o JWS com as chaves
  // da Apple e ler `productId`, `originalTransactionId` e `expiresDate`.
  throw new ErroDeLoja("LOJA_INDISPONIVEL", "Verificação Apple ainda não implementada.");
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

export async function verificarCompraGoogle(
  _storeProductId: string,
  _purchaseToken: string,
): Promise<CompraVerificada> {
  if (!credenciaisGoogleProntas()) {
    throw new ErroDeLoja(
      "CREDENCIAIS_AUSENTES",
      "GOOGLE_PLAY_* não configurado. Cadastre os produtos no Play Console e crie a conta de serviço.",
    );
  }
  // Implementar com purchases.subscriptionsv2.get assim que houver credencial:
  // ler `lineItems[].productId`, `lineItems[].expiryTime` e o estado da
  // assinatura.
  throw new ErroDeLoja("LOJA_INDISPONIVEL", "Verificação Google ainda não implementada.");
}

/** As lojas estão prontas para receber compra? Usado pelo app para escolher o caminho. */
export function lojasProntas() {
  return { apple: credenciaisApleProntas(), google: credenciaisGoogleProntas() };
}
