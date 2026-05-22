import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { JwtPayload } from "@/lib/auth";

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

export type AuthRole = JwtPayload["role"];

export type ServiceParticipantLike = {
  clientId: string;
  diaristaId?: string | null;
  montadorId?: string | null;
};

function isRequest(value: Request | JwtPayload): value is Request {
  return typeof (value as Request).headers?.get === "function";
}

export function requireRole(
  reqOrAuth: Request | JwtPayload,
  allowedRoles: readonly AuthRole[]
) {
  const auth = isRequest(reqOrAuth) ? requireAuth(reqOrAuth) : reqOrAuth;
  if (!allowedRoles.includes(auth.role)) {
    throw new Error("Forbidden");
  }
  return auth;
}

export async function requireAdmin(reqOrAuth: Request | JwtPayload) {
  const auth = isRequest(reqOrAuth) ? requireAuth(reqOrAuth) : reqOrAuth;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return { ...auth, role: "ADMIN" as const };
}

export function isServiceParticipant(
  userId: string,
  service: ServiceParticipantLike | null | undefined
) {
  if (!service) return false;
  // userId precisa ser uma string não-vazia. Defesa em profundidade contra
  // caller que repasse null/undefined/"" — sem isto, null === null casaria
  // com clientId/diaristaId/montadorId também null.
  if (typeof userId !== "string" || userId.length === 0) return false;
  // Cada campo do serviço só libera acesso se também for string não-vazia.
  return (
    (typeof service.clientId === "string" && service.clientId.length > 0 && service.clientId === userId) ||
    (typeof service.diaristaId === "string" && service.diaristaId.length > 0 && service.diaristaId === userId) ||
    (typeof service.montadorId === "string" && service.montadorId.length > 0 && service.montadorId === userId)
  );
}

export async function requireServiceParticipant(
  userId: string,
  serviceId: string,
  opts: { allowAdmin?: boolean; role?: AuthRole } = {}
) {
  const service = await prisma.servico.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      clientId: true,
      diaristaId: true,
      montadorId: true,
    },
  });

  if (!service) {
    throw new Error("ServiceNotFound");
  }

  if (opts.allowAdmin && opts.role === "ADMIN") {
    return service;
  }

  if (!isServiceParticipant(userId, service)) {
    throw new Error("Forbidden");
  }

  return service;
}
