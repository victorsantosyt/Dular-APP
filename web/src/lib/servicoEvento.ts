import { prisma } from "@/lib/prisma";
import { ServicoStatus, UserRole } from "@prisma/client";

/**
 * Opções estruturadas associadas a uma transição de serviço.
 *
 * Quando a transição envolve recusa/cancelamento, esses campos viram a
 * **fonte da verdade** sobre o motivo (substituindo a antiga annotation
 * em texto livre dentro de `Servico.observacoes`).
 */
export type RegistrarEventoOptions = {
  motivo?: string | null;
  observacao?: string | null;
  motivoGrave?: boolean;
};

export async function registrarEvento(
  servicoId: string,
  fromStatus: ServicoStatus,
  toStatus: ServicoStatus,
  actorRole: UserRole,
  actorId: string,
  options: RegistrarEventoOptions = {},
) {
  try {
    await prisma.servicoEvento.create({
      data: {
        servicoId,
        fromStatus,
        toStatus,
        actorRole,
        actorId,
        motivo: options.motivo ?? null,
        observacao: options.observacao ?? null,
        motivoGrave: options.motivoGrave ?? false,
      },
    });
  } catch (e) {
    console.error("erro registrar evento servico", e);
  }
}

/**
 * Verifica se já existe um ServicoEvento de transição emitido pelo papel
 * informado (CLIENT vs profissional) sinalizando finalização. Usamos como
 * "fonte da verdade" da dupla confirmação enquanto não há colunas
 * `confirmadoPorEmpregador` / `confirmadoPorProfissional` no schema.
 *
 * TODO (database agent): adicionar colunas dedicadas em `Servico` para
 * eliminar essa busca por histórico.
 */
export async function jaConfirmouFinalizacao(
  servicoId: string,
  actorRole: UserRole,
): Promise<boolean> {
  const evento = await prisma.servicoEvento.findFirst({
    where: {
      servicoId,
      actorRole,
      toStatus: { in: ["AGUARDANDO_FINALIZACAO", "CONCLUIDO", "CONFIRMADO", "FINALIZADO"] },
    },
    select: { id: true },
  });
  return !!evento;
}
