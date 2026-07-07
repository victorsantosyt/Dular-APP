import { NextResponse } from "next/server";

export type MobileOAuthProvider = "google" | "apple";

const PROVIDER_LABEL: Record<MobileOAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

/**
 * Início de OAuth para o app mobile, sem exigir CSRF do cliente.
 *
 * NextAuth v5 só inicia o fluxo com POST autenticado por CSRF token em
 * /api/auth/signin/:provider — cookies que o app não possui. Este proxy
 * obtém o CSRF token, faz o POST server-side e responde 302 para a URL de
 * autorização do provider, repassando os cookies de estado ao browser mobile
 * (expo-web-browser openAuthSessionAsync).
 */
export async function startMobileOAuth(
  request: Request,
  provider: MobileOAuthProvider,
) {
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
      // ngrok free serve uma página HTML de aviso sem este header; sem ele o
      // .json() abaixo quebra e cai em "Falha ao obter CSRF token".
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    const json = (await csrfResp.json()) as { csrfToken?: string };
    csrfToken = json.csrfToken ?? "";
    csrfCookies = csrfResp.headers.getSetCookie?.() ?? [];
  } catch {
    return new Response("Falha ao obter CSRF token", { status: 502 });
  }

  // ── 2. POST para NextAuth signin/:provider (sem seguir redirect) ────────────
  let authorizationUrl: string | null = null;
  let signinCookies: string[] = [];
  try {
    const body = new URLSearchParams({ csrfToken, callbackUrl });
    const signinResp = await fetch(`${BASE}/api/auth/signin/${provider}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Mesmo motivo do fetch do CSRF: pular o aviso do ngrok free.
        "ngrok-skip-browser-warning": "true",
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
      authorizationUrl = location;
    } else {
      try {
        const json = (await signinResp.json()) as { url?: string };
        authorizationUrl = json.url ?? null;
      } catch {
        authorizationUrl = null;
      }
    }
  } catch {
    return new Response(
      `Falha ao iniciar OAuth com ${PROVIDER_LABEL[provider]}`,
      { status: 502 },
    );
  }

  if (!authorizationUrl) {
    return new Response(
      `URL do ${PROVIDER_LABEL[provider]} OAuth não encontrada`,
      { status: 502 },
    );
  }

  // ── 3. Redirecionar mobile para o provider, repassando cookies de estado ────
  const res = NextResponse.redirect(authorizationUrl, { status: 302 });

  for (const cookie of [...csrfCookies, ...signinCookies]) {
    res.headers.append("set-cookie", cookie);
  }

  return res;
}
