import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/mobile-google?role=cliente&callbackUrl=/auth/callback/cliente?platform=mobile
 *
 * Gera a URL de autorização do Google via NextAuth sem exigir CSRF do cliente.
 * Internamente: busca o CSRF token, faz POST para /api/auth/signin/google e
 * repassa os cookies de estado + redirect para o browser mobile.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") ?? "cliente";
  const callbackUrl =
    searchParams.get("callbackUrl") ??
    `/auth/callback/${role}?platform=mobile`;

  const BASE =
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  // ── 1. Obter CSRF token do NextAuth ─────────────────────────────────────────
  let csrfToken: string;
  let csrfCookies: string[];
  try {
    const csrfResp = await fetch(`${BASE}/api/auth/csrf`, {
      cache: "no-store",
    });
    const json = (await csrfResp.json()) as { csrfToken?: string };
    csrfToken = json.csrfToken ?? "";
    csrfCookies = csrfResp.headers.getSetCookie?.() ?? [];
  } catch {
    return new Response("Falha ao obter CSRF token", { status: 502 });
  }

  // ── 2. POST para NextAuth signin/google (sem seguir redirect) ───────────────
  let googleUrl: string | null = null;
  let signinCookies: string[] = [];
  try {
    const body = new URLSearchParams({ csrfToken, callbackUrl });
    const signinResp = await fetch(`${BASE}/api/auth/signin/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Envia apenas o valor do cookie CSRF, sem atributos (Secure; HttpOnly…)
        Cookie: csrfCookies.map((c) => c.split(";")[0]).join("; "),
      },
      body,
      redirect: "manual",
    });

    signinCookies = signinResp.headers.getSetCookie?.() ?? [];

    // NextAuth v5 pode retornar redirect ou JSON { url }
    const location = signinResp.headers.get("location");
    if (location) {
      googleUrl = location;
    } else {
      try {
        const json = (await signinResp.json()) as { url?: string };
        googleUrl = json.url ?? null;
      } catch {
        googleUrl = null;
      }
    }
  } catch {
    return new Response("Falha ao iniciar OAuth com Google", { status: 502 });
  }

  if (!googleUrl) {
    return new Response("URL do Google OAuth não encontrada", { status: 502 });
  }

  // ── 3. Redirecionar mobile para o Google, repassando cookies de estado ──────
  const res = NextResponse.redirect(googleUrl, { status: 302 });

  for (const cookie of [...csrfCookies, ...signinCookies]) {
    res.headers.append("set-cookie", cookie);
  }

  return res;
}
