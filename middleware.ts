import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}

const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET);

function redirectToLogin(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.delete("dular_token");
  return response;
}

// Redireciona qualquer rota /admin* para /login se não houver sessão JWT válida.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permite a rota pública de login sem checagem.
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("dular_token")?.value;
    if (!token) {
      return redirectToLogin(req);
    }

    try {
      await jwtVerify(token, JWT_SECRET_BYTES);
    } catch {
      return redirectToLogin(req);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
