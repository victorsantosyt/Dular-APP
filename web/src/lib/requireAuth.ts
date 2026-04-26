import { verifyToken } from "@/lib/auth";

function getTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith("dular_token=")) {
      return decodeURIComponent(p.replace("dular_token=", ""));
    }
  }
  return null;
}

export function requireAuth(req: Request) {
  // Tenta Authorization: Bearer
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    try {
      return verifyToken(token);
    } catch {
      throw new Error("Unauthorized");
    }
  }

  // Fallback: cookie HttpOnly
  const cookieToken = getTokenFromCookie(req.headers.get("cookie"));
  if (cookieToken) {
    try {
      return verifyToken(cookieToken);
    } catch {
      throw new Error("Unauthorized");
    }
  }

  throw new Error("Unauthorized");
}
