import { prisma } from "@/lib/prisma";
import { Prisma, ServicoStatus, UserRole } from "@prisma/client";

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

const FINALIZACAO_CONFIRMADA: ServicoStatus[] = [
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
];

async function confirmouTx(
  tx: Prisma.TransactionClient,
  servicoId: string,
  actorRole: UserRole,
): Promise<boolean> {
  const evento = await tx.servicoEvento.findFirst({
    where: { servicoId, actorRole, toStatus: { in: FINALIZACAO_CONFIRMADA } },
    select: { id: true },
  });
  return !!evento;
}

async function profissionalConfirmouTx(
  tx: Prisma.TransactionClient,
  servicoId: string,
): Promise<boolean> {
  const [d, m] = await Promise.all([
    confirmouTx(tx, servicoId, "DIARISTA"),
    confirmouTx(tx, servicoId, "MONTADOR"),
  ]);
  return d || m;
}

function isWriteConflict(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === "P2034") return true; // Prisma: write conflict / deadlock (retryable)
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("40001") ||
    msg.includes("could not serialize") ||
    msg.includes("write conflict") ||
    msg.includes("deadlock")
  );
}

export type ConfirmarFinalizacaoResult = {
  idempotent: boolean;
  fromStatus: ServicoStatus;
  novoStatus: ServicoStatus;
};

/**
 * Transição ATÔMICA da dupla confirmação de finalização, compartilhada por
 * `confirmar-finalizacao` e `concluir` (ambos codificavam a mesma lógica
 * racy em duplicata).
 *
 * Correção da corrida (provada: 2 confirmações simultâneas deixavam o serviço
 * preso em AGUARDANDO_FINALIZACAO com ambos os papéis já confirmados): a
 * leitura das confirmações, a decisão do novo status e as escritas (Servico +
 * ServicoEvento) rodam numa única transação PostgreSQL `Serializable`. Como as
 * duas requisições escrevem a MESMA linha de `Servico`, uma sofre falha de
 * serialização (P2034/40001) e é reexecutada; na reexecução ela enxerga o
 * evento da outra parte já commitado e transiciona corretamente para CONCLUIDO.
 *
 * Não altera regra de negócio: mesmas transições, mesma idempotência.
 */
export async function confirmarFinalizacaoAtomic(
  servicoId: string,
  papel: UserRole,
  actorId: string,
): Promise<ConfirmarFinalizacaoResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const svc = await tx.servico.findUnique({
            where: { id: servicoId },
            select: { status: true },
          });
          if (!svc) throw new Error("SERVICO_NOT_FOUND");
          const fromStatus = svc.status as ServicoStatus;
          if (
            fromStatus !== "EM_ANDAMENTO" &&
            fromStatus !== "AGUARDANDO_FINALIZACAO"
          ) {
            throw new Error("INVALID_STATUS");
          }

          const jaConfirmei = await confirmouTx(tx, servicoId, papel);
          if (jaConfirmei) {
            return { idempotent: true, fromStatus, novoStatus: fromStatus };
          }

          const outroConfirmou =
            papel === "EMPREGADOR"
              ? await profissionalConfirmouTx(tx, servicoId)
              : await confirmouTx(tx, servicoId, "EMPREGADOR");
          const novoStatus: ServicoStatus = outroConfirmou
            ? "CONCLUIDO"
            : "AGUARDANDO_FINALIZACAO";

          await tx.servico.update({
            where: { id: servicoId },
            data: { status: novoStatus },
          });
          await tx.servicoEvento.create({
            data: {
              servicoId,
              fromStatus,
              toStatus: novoStatus,
              actorRole: papel,
              actorId,
            },
          });

          return { idempotent: false, fromStatus, novoStatus };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (isWriteConflict(e) && attempt < 5) continue;
      throw e;
    }
  }
}
