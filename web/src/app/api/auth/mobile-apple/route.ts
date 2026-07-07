import { startMobileOAuth } from "@/lib/mobileOAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/mobile-apple?role=cliente&callbackUrl=/auth/callback/cliente?platform=mobile
 *
 * Gera a URL de autorização do Sign in with Apple via NextAuth sem exigir CSRF
 * do cliente — mesmo proxy do /api/auth/mobile-google. O callback da Apple
 * (form_post) entra em /api/auth/callback/apple e segue o fluxo padrão:
 * /auth/callback/[role] → /api/auth/mobile-token → deep link dular://.
 */
export async function GET(request: Request) {
  return startMobileOAuth(request, "apple");
}
