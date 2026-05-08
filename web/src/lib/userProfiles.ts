import type { Prisma, UserRole } from "@prisma/client";

type ProfileClient = Pick<
  Prisma.TransactionClient,
  "empregadorPerfil" | "diaristaProfile" | "montadorPerfil"
>;

type ProfileRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

export function isProfileRole(role: UserRole | null | undefined): role is ProfileRole {
  return role === "EMPREGADOR" || role === "DIARISTA" || role === "MONTADOR";
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
