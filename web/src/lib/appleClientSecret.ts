import jwt from "jsonwebtoken";

/**
 * Client secret do Sign in with Apple.
 *
 * A Apple não emite um secret estático: o "client secret" é um JWT ES256
 * assinado com a private key (.p8) da conta Apple Developer, com validade
 * máxima de 6 meses (https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret).
 *
 * Caminho recomendado — gerar dinamicamente no boot a partir de:
 *   APPLE_CLIENT_ID  → Service ID (client web), ex.: com.dular.web
 *   APPLE_TEAM_ID    → Team ID da conta (Membership)
 *   APPLE_KEY_ID     → Key ID da chave "Sign in with Apple"
 *   APPLE_PRIVATE_KEY→ conteúdo PEM do arquivo .p8 (aceita \n escapados)
 *
 * Alternativa (legado): APPLE_ID + APPLE_SECRET com o JWT pré-assinado —
 * funciona, mas exige rotação manual a cada 6 meses.
 */

const SECRET_TTL_S = 180 * 24 * 60 * 60; // ~6 meses, teto da Apple

export function appleClientId(): string | undefined {
  return (
    process.env.APPLE_CLIENT_ID?.trim() ||
    process.env.APPLE_ID?.trim() ||
    undefined
  );
}

let cached: string | undefined;

export function appleClientSecret(): string | undefined {
  if (cached) return cached;

  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const clientId = appleClientId();

  if (teamId && keyId && privateKey && clientId) {
    try {
      cached = jwt.sign({}, privateKey, {
        algorithm: "ES256",
        keyid: keyId,
        issuer: teamId,
        audience: "https://appleid.apple.com",
        subject: clientId,
        expiresIn: SECRET_TTL_S,
      });
      return cached;
    } catch (error) {
      // Chave malformada não pode derrubar o boot do NextAuth (Google incluso);
      // o login Apple falha isolado e o erro fica visível no log do servidor.
      console.error("[apple] falha ao assinar client secret dinâmico:", error);
    }
  }

  return process.env.APPLE_SECRET?.trim() || undefined;
}
