import { prisma } from "@/lib/prisma";

/**
 * Regras comuns às rotas da sala de chat (GET/POST /api/chat/[roomId] e
 * /api/chat/[roomId]/messages). Antes cada rota tinha a sua cópia, e elas
 * divergiam: a de mensagens não aceitava AGUARDANDO_FINALIZACAO.
 */

/** Status do serviço com chat disponível (ativo ou arquivado, somente leitura). */
export const STATUS_COM_CHAT: ReadonlySet<string> = new Set([
  "ACEITO",
  "EM_ANDAMENTO",
  // Sem este status, ao empregador confirmar a finalização primeiro o chat caía
  // em 403 para ambas as partes justamente na etapa de fechar o serviço.
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
]);

/** Tamanho da página de mensagens. */
export const PAGINA_MENSAGENS = 50;

/**
 * Ordem determinística: mais recente primeiro; empate de `createdAt` resolvido
 * pelo id. Sem o desempate, duas mensagens no mesmo milissegundo podiam trocar
 * de lugar entre consultas (e sumir ou repetir entre páginas).
 */
export const MAIS_RECENTES_PRIMEIRO = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/** Condição "estritamente anterior ao cursor" na mesma ordem (createdAt, id). */
export function anterioresAo(cursor: { createdAt: Date; id: string }) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

/**
 * Confirmação de leitura: marca como lidas SÓ as mensagens do outro
 * participante que foram DEVOLVIDAS nesta resposta (as que a pessoa recebe
 * para ver). O limite é o conjunto de ids devolvidos: uma mensagem gravada
 * depois da consulta não entra, e uma mais antiga que a página também não.
 * `readAt: null` no filtro mantém o primeiro horário de leitura (idempotente
 * entre consultas concorrentes); `roomId`/`senderId` garantem que nada fora
 * desta sala, ou enviado pela própria pessoa, seja tocado.
 */
export async function marcarDevolvidasComoLidas(
  roomId: string,
  outroUsuarioId: string | null,
  mensagens: Array<{ id: string; senderId: string; readAt: Date | null }>,
): Promise<void> {
  if (!outroUsuarioId) return;
  const ids = mensagens.filter((m) => m.senderId === outroUsuarioId && m.readAt === null).map((m) => m.id);
  if (ids.length === 0) return;
  const agora = new Date();
  await prisma.chatMessage.updateMany({
    where: { id: { in: ids }, roomId, senderId: outroUsuarioId, readAt: null },
    data: { readAt: agora },
  });
  // Reflete nas mensagens já carregadas (sem nova query).
  const marcadas = new Set(ids);
  for (const m of mensagens) if (marcadas.has(m.id)) m.readAt = agora;
}
