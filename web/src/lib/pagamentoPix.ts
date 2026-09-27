import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertContaAtiva } from "@/lib/contaAtiva";
import type { JwtPayload } from "@/lib/auth";
import type {
  PaymentEventType,
  PaymentStatus,
  PixKeyType,
  ServicoStatus,
  UserRole,
} from "@prisma/client";

/**
 * Regras do pagamento PIX P2P (empregador → profissional).
 *
 * O valor é SEMPRE Servico.precoFinal (congelado na contratação) e o TxId é
 * SEMPRE o id do Servico — nada disso aceita entrada do cliente.
 */

// "Contratado e ativo": do aceite em diante, excluindo RASCUNHO/SOLICITADO/
// RECUSADO/CANCELADO. Mesmo conjunto que libera o chat da contratação.
export const PIX_STATUSES_ELEGIVEIS: readonly ServicoStatus[] = [
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
] as const;

// Estados em que o empregador pode (re)gerar o PIX e informar pagamento:
// aguardando, ou contestado pelo profissional (permite corrigir/pagar de novo).
export const PIX_PAGAVEL: readonly PaymentStatus[] = [
  "WAITING_PAYMENT",
  "PAYMENT_DISPUTED",
] as const;

export function profissionalIdDoServico(servico: {
  diaristaId: string | null;
  montadorId: string | null;
}): string | null {
  return servico.montadorId ?? servico.diaristaId;
}

export type PapelNoPagamento = "EMPREGADOR" | "PROFISSIONAL" | "OUTRO";

/**
 * O que cada participante vê e pode fazer no pagamento — a MESMA regra das
 * rotas de PIX, num lugar só. O chat e o detalhe do serviço mostram o que
 * vem daqui; as rotas continuam sendo a autoridade (checam tudo de novo).
 *
 * - pagarComPix (empregador): gerar o PIX e informar o pagamento — serviço
 *   contratado, pagamento aguardando ou contestado e chave PIX disponível
 *   (snapshot congelado ou PaymentInfo do profissional);
 * - confirmarRecebimento / contestarRecebimento (profissional): pagamento
 *   informado pelo empregador.
 *
 * Não depende do chat: vale igual com a conversa excluída por qualquer lado.
 */
export type ResumoPagamento = {
  paymentStatus: PaymentStatus;
  precoFinal: number | null;
  profissionalTemPix: boolean;
  papel: PapelNoPagamento;
  acoes: {
    pagarComPix: boolean;
    confirmarRecebimento: boolean;
    contestarRecebimento: boolean;
  };
};

export function resumoPagamento(
  servico: {
    status: ServicoStatus;
    paymentStatus: PaymentStatus;
    precoFinal: number | null;
    clientId: string;
    diaristaId: string | null;
    montadorId: string | null;
  },
  usuarioId: string,
  profissionalTemPix: boolean,
): ResumoPagamento {
  const papel: PapelNoPagamento =
    usuarioId === servico.clientId
      ? "EMPREGADOR"
      : usuarioId === profissionalIdDoServico(servico)
        ? "PROFISSIONAL"
        : "OUTRO";
  const contratado = PIX_STATUSES_ELEGIVEIS.includes(servico.status);
  const informado = servico.paymentStatus === "PAYMENT_REPORTED";
  return {
    paymentStatus: servico.paymentStatus,
    precoFinal: servico.precoFinal,
    profissionalTemPix,
    papel,
    acoes: {
      pagarComPix:
        papel === "EMPREGADOR" &&
        contratado &&
        PIX_PAGAVEL.includes(servico.paymentStatus) &&
        profissionalTemPix &&
        profissionalIdDoServico(servico) !== null,
      confirmarRecebimento: papel === "PROFISSIONAL" && informado,
      contestarRecebimento: papel === "PROFISSIONAL" && informado,
    },
  };
}

/**
 * Há dados de recebimento para o PIX deste serviço? O snapshot congelado é a
 * fonte canônica depois da contratação; na falta dele, o PaymentInfo atual do
 * profissional (o PIX congela o snapshot no primeiro uso).
 */
export async function profissionalTemPixNoServico(
  servicoId: string,
  profissionalId: string | null,
  temSnapshot?: boolean,
): Promise<boolean> {
  const snapshot =
    temSnapshot ??
    (await prisma.pixSnapshot.findUnique({ where: { servicoId }, select: { id: true } })) !== null;
  if (snapshot) return true;
  if (!profissionalId) return false;
  return (await prisma.paymentInfo.findUnique({ where: { userId: profissionalId }, select: { id: true } })) !== null;
}

export type DadosRecebimento = {
  pixType: PixKeyType;
  pixKey: string;
  bank: string | null;
  holderName: string;
};

/**
 * Congela (create-only) o snapshot PIX do serviço e o retorna.
 *
 * - Se o snapshot já existe, retorna o existente — NUNCA sobrescreve, mesmo
 *   que o PaymentInfo do profissional tenha mudado depois.
 * - Se não existe e o profissional tem PaymentInfo, cria a partir dele
 *   (contratação, ou primeiro uso quando a chave foi cadastrada após o aceite).
 * - Se não existe e não há PaymentInfo, retorna null (nada a congelar).
 *
 * Corrida entre dois congelamentos: o unique(servicoId) garante um vencedor;
 * o perdedor lê e usa o snapshot vencedor.
 */
export async function congelarPixSnapshot(
  servicoId: string,
  profissionalId: string,
): Promise<DadosRecebimento | null> {
  const existente = await prisma.pixSnapshot.findUnique({
    where: { servicoId },
    select: { pixType: true, pixKey: true, bank: true, holderName: true },
  });
  if (existente) return existente;

  const info = await prisma.paymentInfo.findUnique({
    where: { userId: profissionalId },
    select: { pixType: true, pixKey: true, bank: true, holderName: true },
  });
  if (!info) return null;

  try {
    return await prisma.pixSnapshot.create({
      data: { servicoId, ...info },
      select: { pixType: true, pixKey: true, bank: true, holderName: true },
    });
  } catch {
    // Unique violado = outra requisição congelou primeiro; o snapshot dela vence.
    return prisma.pixSnapshot.findUnique({
      where: { servicoId },
      select: { pixType: true, pixKey: true, bank: true, holderName: true },
    });
  }
}

/**
 * Trilha de auditoria do pagamento (espelho do padrão registrarEvento de
 * ServicoEvento): best-effort — nunca derruba a rota que a chama.
 */
export async function registrarPaymentEvent(
  servicoId: string,
  tipo: PaymentEventType,
  actorRole: UserRole,
  actorId: string,
  motivo?: string,
) {
  try {
    await prisma.paymentEvent.create({
      data: { servicoId, tipo, actorRole, actorId, motivo: motivo ?? null },
    });
  } catch (e) {
    console.error("erro registrar evento pagamento", e);
  }
}

/**
 * Mensagem SYSTEM no chat da contratação (sala criada lazily, como no chat).
 * Best-effort: o polling de 8s do chat entrega a atualização às duas partes.
 */
export async function enviarMensagemSistema(
  servicoId: string,
  actorId: string,
  content: string,
) {
  try {
    const room = await prisma.chatRoom.upsert({
      where: { servicoId },
      update: {},
      create: { servicoId },
      select: { id: true },
    });
    // senderId = ator da ação (FK obrigatória); type SYSTEM diferencia na UI.
    await prisma.chatMessage.create({
      data: { roomId: room.id, senderId: actorId, type: "SYSTEM", content },
    });
  } catch (e) {
    console.error("erro enviar mensagem de sistema", e);
  }
}

/**
 * Auth dual: JWT próprio (mobile/admin, via requireAuth) com fallback para a
 * sessão NextAuth (web OAuth). O fallback é import dinâmico de propósito —
 * os testes de segurança exercitam só o caminho JWT e não carregam NextAuth.
 */
export async function requireAuthOuSessao(req: Request): Promise<JwtPayload> {
  // A checagem de conta ativa fica FORA do try/catch abaixo, no final.
  // Dentro, o catch engole tudo em "Unauthorized" e uma conta bloqueada
  // viraria 401 de credencial em vez de 403 — a pessoa repetiria o login
  // para bater na mesma parede.
  const auth = await resolverIdentidade(req);
  await assertContaAtiva(auth.userId);
  return auth;
}

async function resolverIdentidade(req: Request): Promise<JwtPayload> {
  try {
    return requireAuth(req);
  } catch {
    try {
      const { auth } = await import("@/lib/auth-oauth");
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (!user?.role) throw new Error("Unauthorized");
      return { userId: session.user.id, role: user.role as JwtPayload["role"] };
    } catch {
      // Qualquer falha na via de sessão (inclusive fora de request scope) é 401.
      throw new Error("Unauthorized");
    }
  }
}
