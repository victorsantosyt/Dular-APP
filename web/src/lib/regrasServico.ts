import { prisma } from "@/lib/prisma";
import { ServicoStatus, UserRole } from "@prisma/client";

export function assertRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) throw new Error("FORBIDDEN");
}

export function assertStatus(current: ServicoStatus, allowed: ServicoStatus[]) {
  if (!allowed.includes(current)) throw new Error("INVALID_STATUS");
}

export function msAte(date: Date) {
  return date.getTime() - Date.now();
}

/**
 * Regra: cancelamento tardio < 12h antes do horário do serviço.
 */
export function isCancelamentoTardio(data: Date) {
  const horas = msAte(data) / (1000 * 60 * 60);
  return horas < 12;
}

/**
 * Recalcula nota média e totalServicos a partir do BD (confiável).
 */
export async function recomputeDiaristaStats(userIdDiarista: string) {
  const prof = await prisma.diaristaProfile.findUnique({
    where: { userId: userIdDiarista },
  });
  if (!prof) return;

  const avals = await prisma.avaliacao.findMany({
    where: { diaristaId: userIdDiarista },
    select: { notaGeral: true },
  });

  const total = avals.length;
  const media = total ? avals.reduce((a, b) => a + b.notaGeral, 0) / total : 0;

  const servicosConcluidos = await prisma.servico.count({
    where: { diaristaId: userIdDiarista, status: { in: ["CONFIRMADO", "FINALIZADO"] } },
  });

  await prisma.diaristaProfile.update({
    where: { userId: userIdDiarista },
    data: {
      notaMedia: Number(media.toFixed(2)),
      totalServicos: servicosConcluidos,
    },
  });
}

/**
 * Equivalente a recomputeDiaristaStats, mas para MontadorPerfil.
 * MontadorPerfil usa o campo `rating` no lugar de `notaMedia`; demais
 * campos seguem o mesmo padrão.
 */
export async function recomputeMontadorStats(userIdMontador: string) {
  const perfil = await prisma.montadorPerfil.findUnique({
    where: { userId: userIdMontador },
  });
  if (!perfil) return;

  const avals = await prisma.avaliacao.findMany({
    where: { montadorId: userIdMontador },
    select: { notaGeral: true },
  });

  const total = avals.length;
  const media = total ? avals.reduce((a, b) => a + b.notaGeral, 0) / total : 0;

  const servicosConcluidos = await prisma.servico.count({
    where: { montadorId: userIdMontador, status: { in: ["CONFIRMADO", "FINALIZADO"] } },
  });

  await prisma.montadorPerfil.update({
    where: { userId: userIdMontador },
    data: {
      rating: Number(media.toFixed(2)),
      totalServicos: servicosConcluidos,
    },
  });
}
