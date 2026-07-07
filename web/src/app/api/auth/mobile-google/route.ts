import { startMobileOAuth } from "@/lib/mobileOAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/mobile-google?role=cliente&callbackUrl=/auth/callback/cliente?platform=mobile
 *
 * Gera a URL de autorização do Google via NextAuth sem exigir CSRF do cliente.
 * Internamente (lib/mobileOAuth): busca o CSRF token, faz POST para
 * /api/auth/signin/google e repassa os cookies de estado + redirect para o
 * browser mobile.
 */
export async function GET(request: Request) {
  return startMobileOAuth(request, "google");
}
