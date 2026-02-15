import { NextRequest, NextResponse } from "next/server";

// Redireciona qualquer rota /admin* para /admin/login se não houver cookie de sessão.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permite a rota pública de login sem checagem.
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("dular_token")?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
