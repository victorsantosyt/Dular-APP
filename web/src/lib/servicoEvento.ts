import { prisma } from "@/lib/prisma";
import { ServicoStatus, UserRole } from "@prisma/client";

export async function registrarEvento(
  servicoId: string,
  fromStatus: ServicoStatus,
  toStatus: ServicoStatus,
  actorRole: UserRole,
  actorId: string
) {
  try {
    await prisma.servicoEvento.create({
      data: {
        servicoId,
        fromStatus,
        toStatus,
        actorRole,
        actorId,
      },
    });
  } catch (e) {
    console.error("erro registrar evento servico", e);
  }
}
