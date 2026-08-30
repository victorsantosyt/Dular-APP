import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Lido em RUNTIME (não no import): o throw no topo do módulo derrubava o
// `next build` quando a env não estava presente no ambiente de build.
let jwtSecretBytes: Uint8Array | null = null;
function getJwtSecretBytes(): Uint8Array {
  if (!jwtSecretBytes) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET env var is required");
    }
    jwtSecretBytes = new TextEncoder().encode(secret);
  }
  return jwtSecretBytes;
}

function redirectToLogin(req: NextRequest) {
  // Alvo = login do PAINEL (/admin/login), não o login do app (/login). Já está
  // na allowlist do próprio middleware (startsWith("/admin/login") → next()),
  // então não há loop de redirect.
  const response = NextResponse.redirect(new URL("/admin/login", req.url));
  response.cookies.delete("dular_token");
  return response;
}

// V1 sai só por mobile (TestFlight) + admin web. O app web consumidor
// (raiz, /login/[role], /cliente, /diarista, /montador, /billing, /servicos,
// /onboarding, /escolher-perfil, /auth) continua no repo, só não fica
// público agora — qualquer rota fora de /admin e /api cai no login do painel.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Assets estáticos servidos direto de /public (ex.: /brand/dular-login.png
  // usado na própria tela de login do admin) — nunca gatear, senão a página
  // de login fica sem os próprios recursos.
  const isStaticAsset = pathname.startsWith("/_next") || /\.[a-zA-Z0-9]+$/.test(pathname);
  if (isStaticAsset) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("dular_token")?.value;
    if (!token) {
      return redirectToLogin(req);
    }

    try {
      await jwtVerify(token, getJwtSecretBytes());
    } catch {
      return redirectToLogin(req);
    }

    return NextResponse.next();
  }

  // Fora de /admin e /api: app web consumidor, desativado pro launch v1.
  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = {
  matcher: ["/:path*"],
};
