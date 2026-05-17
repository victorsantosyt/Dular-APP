import type { Prisma, UserRole } from "@prisma/client";

type ProfileClient = Pick<
  Prisma.TransactionClient,
  "empregadorPerfil" | "diaristaProfile" | "montadorPerfil"
>;

type ProfileRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

export function isProfileRole(role: UserRole | null | undefined): role is ProfileRole {
  return role === "EMPREGADOR" || role === "DIARISTA" || role === "MONTADOR";
}

const ROLE_LABELS: Record<UserRole, string> = {
  EMPREGADOR: "Empregador",
  DIARISTA: "Diarista",
  MONTADOR: "Montador",
  ADMIN: "Admin",
};

export function roleMismatchMessage(existingRole: UserRole, requestedRole: UserRole) {
  return `Esta conta Google já está vinculada ao perfil ${ROLE_LABELS[existingRole]}. Use outra conta Google para entrar como ${ROLE_LABELS[requestedRole]}.`;
}

export async function ensureUserRoleProfile(
  prisma: ProfileClient,
  userId: string,
  role: UserRole | null | undefined,
) {
  if (!isProfileRole(role)) return;

  if (role === "EMPREGADOR") {
    await prisma.empregadorPerfil.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return;
  }

  if (role === "DIARISTA") {
    await prisma.diaristaProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, precoLeve: 0, precoPesada: 0 },
    });
    return;
  }

  if (role === "MONTADOR") {
    await prisma.montadorPerfil.upsert({
      where: { userId },
      update: {},
      create: { userId, especialidades: [] },
    });
  }
}
