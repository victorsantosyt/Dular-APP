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

// Redireciona qualquer rota /admin* para /admin/login se não houver sessão JWT válida.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
