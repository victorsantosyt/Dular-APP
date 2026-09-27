import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { criarNotificacao } from "@/lib/notifications";
import { publishChatEvent, isUserPresentInRoom } from "@/lib/ably";
import { profissionalTemPixNoServico, resumoPagamento } from "@/lib/pagamentoPix";
import {
  conversaExcluidaPor,
  MAIS_RECENTES_PRIMEIRO,
  marcarDevolvidasComoLidas,
  motivoParaNaoExcluir,
  PAGINA_MENSAGENS,
  podeExcluirConversa,
  RESPOSTA_CONVERSA_EXCLUIDA,
  STATUS_ARQUIVADO,
  STATUS_COM_CHAT,
} from "@/lib/chatSala";
import type { UserRole } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// roomId = servicoId
// A sala é criada lazily na primeira visita, desde que o serviço esteja ACEITO ou posterior.
// Status permitidos: lib/chatSala (os mesmos da rota /messages).
const ALLOWED_STATUSES = STATUS_COM_CHAT;

type Params = { params: Promise<{ roomId: string }> };

const postSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  type: z.literal("TEXT").optional(),
});

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);
    const { roomId: servicoId } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: {
        id: true,
        status: true,
        clientId: true,
        diaristaId: true,
        montadorId: true,
        tipo: true,
        data: true,
        turno: true,
        bairro: true,
        cidade: true,
        uf: true,
        precoFinal: true,
        paymentStatus: true,
      },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isParticipant =
      servico.clientId === auth.userId ||
      servico.diaristaId === auth.userId ||
      servico.montadorId === auth.userId;

    if (!isParticipant) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    if (!ALLOWED_STATUSES.has(servico.status)) {
      return NextResponse.json(
        { ok: false, error: "Chat disponível apenas após aceite do serviço." },
        { status: 403 },
      );
    }

    if (await conversaExcluidaPor(servicoId, auth.userId)) {
      return NextResponse.json(RESPOSTA_CONVERSA_EXCLUIDA, { status: 404 });
    }

    const room = await prisma.chatRoom.upsert({
      where: { servicoId },
      update: {},
      create: { servicoId },
      select: {
        id: true,
        servicoId: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });

    const profissionalUserId = servico.montadorId ?? servico.diaristaId;
    const otherUserId =
      auth.userId === servico.clientId ? profissionalUserId : servico.clientId;

    const otherUser = otherUserId
      ? await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, nome: true, avatarUrl: true, role: true, lastSeenAt: true },
        })
      : null;

    // Pagamento PIX: o banner do chat depende de haver dados de recebimento —
    // o snapshot congelado do serviço ou, na falta dele, o PaymentInfo atual
    // do profissional (lib/pagamentoPix). Consultas leves (só id), re-buscadas
    // a cada poll de 8s. O detalhe do serviço usa a mesma regra.
    const profissionalTemPix = await profissionalTemPixNoServico(servicoId, profissionalUserId);

    // Entrega (deliveredAt) ANTES de leitura (readAt): ao abrir/atualizar a sala,
    // as mensagens do outro são consideradas entregues; só as visíveis aqui
    // também viram lidas. Assim uma msg pode ficar "entregue" sem "lida" se o
    // destinatário ainda não tiver aberto a conversa.
    if (otherUserId) {
      await prisma.chatMessage.updateMany({
        where: { roomId: room.id, senderId: otherUserId, deliveredAt: null },
        data: { deliveredAt: new Date() },
      });
    }

    // As 50 MAIS RECENTES (antes: as 50 mais antigas — com mais de 50
    // mensagens, as novas nunca chegavam ao app e continuavam não lidas).
    // Buscadas da mais nova para a mais antiga e devolvidas em ordem
    // cronológica, como o app já espera.
    const recentes = await prisma.chatMessage.findMany({
      where: { roomId: room.id },
      orderBy: MAIS_RECENTES_PRIMEIRO,
      take: PAGINA_MENSAGENS,
      select: {
        id: true,
        roomId: true,
        type: true,
        content: true,
        senderId: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });
    const messages = recentes.reverse();

    // Lidas = as do outro participante devolvidas aqui (lib/chatSala).
    await marcarDevolvidasComoLidas(room.id, otherUserId, messages);

    return NextResponse.json({
      ok: true,
      room: {
        id: room.id,
        servicoId: room.servicoId,
        createdAt: room.createdAt,
        totalMessages: room._count.messages,
        servico: {
          id: servico.id,
          status: servico.status,
          tipo: servico.tipo,
          data: servico.data,
          turno: servico.turno,
          local: `${servico.bairro}, ${servico.cidade} - ${servico.uf}`,
          precoFinal: servico.precoFinal,
          paymentStatus: servico.paymentStatus,
        },
        // `profissionalTemPix` é o contrato que os apps já leem; o resto é o
        // mesmo resumo do detalhe do serviço (ações por participante).
        pagamento: resumoPagamento(servico, auth.userId, profissionalTemPix),
        // A conversa aberta usa a MESMA regra da lista e do DELETE.
        arquivada: STATUS_ARQUIVADO.has(servico.status),
        podeExcluir: podeExcluirConversa(servico),
        other: otherUser,
        myRole: auth.role as UserRole,
      },
      messages,
    });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);
    const { roomId: servicoId } = await params;

    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: {
        status: true,
        clientId: true,
        diaristaId: true,
        montadorId: true,
      },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isParticipant =
      servico.clientId === auth.userId ||
      servico.diaristaId === auth.userId ||
      servico.montadorId === auth.userId;

    if (!isParticipant) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    if (!ALLOWED_STATUSES.has(servico.status)) {
      return NextResponse.json(
        { ok: false, error: "Chat disponível apenas após aceite do serviço." },
        { status: 403 },
      );
    }

    if (await conversaExcluidaPor(servicoId, auth.userId)) {
      return NextResponse.json(RESPOSTA_CONVERSA_EXCLUIDA, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const room = await prisma.chatRoom.upsert({
      where: { servicoId },
      update: {},
      create: { servicoId },
      select: { id: true },
    });

    const message = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: auth.userId,
        type: "TEXT",
        content: parsed.data.content,
      },
      select: {
        id: true,
        roomId: true,
        type: true,
        content: true,
        senderId: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true,
        sender: { select: { id: true, nome: true, avatarUrl: true } },
      },
    });

    // Acorda os clientes em tempo real (best-effort): evento leve, sem conteúdo.
    // O banco permanece a fonte da verdade; falha do Ably não afeta o 201.
    await publishChatEvent(servicoId, { id: message.id, roomId: message.roomId, type: message.type });

    // Notifica a outra parte sobre a nova mensagem (best-effort).
    // O `outroUsuarioId` é o oposto do sender no serviço.
    try {
      const profissionalUserId = servico.montadorId ?? servico.diaristaId;
      const outroUsuarioId =
        auth.userId === servico.clientId ? profissionalUserId : servico.clientId;
      // Quem excluiu a conversa arquivada não é avisado de mensagem tardia
      // nela: o aviso apontaria para uma conversa que a pessoa tirou da lista.
      if (outroUsuarioId && !(await conversaExcluidaPor(servicoId, outroUsuarioId))) {
        const preview = parsed.data.content.length > 80
          ? `${parsed.data.content.slice(0, 77)}...`
          : parsed.data.content;
        // Gate anti-duplicação: se o destinatário já está com a sala aberta em
        // tempo real (presente no canal Ably), o realtime já entrega — pula o
        // push, mas mantém a Notification in-app. Fail-open (Ably fora → push).
        const presente = await isUserPresentInRoom(servicoId, outroUsuarioId);
        await criarNotificacao({
          userId: outroUsuarioId,
          type: "CHAT_NOVA_MENSAGEM",
          title: message.sender.nome || "Nova mensagem",
          body: preview,
          servicoId,
          chatRoomId: room.id,
          sendPush: !presente,
        });
      }
    } catch (e) {
      console.error("[chat] erro criando notificação de mensagem:", e);
    }

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

// DELETE /api/chat/[roomId] — tira a conversa ARQUIVADA da lista de quem pede.
//
// Só para essa pessoa: o outro participante continua vendo a conversa, e
// mensagens, sala, serviço e avaliações ficam intactos — nada é apagado,
// grava-se apenas a exclusão (ChatRoomExclusao). Idempotente: repetir o
// pedido devolve o mesmo 200 sem criar outra linha.
//
// Quem pode: lib/chatSala `motivoParaNaoExcluir` — serviço encerrado e
// pagamento confirmado. A mesma função gera o `podeExcluir` da lista e da
// sala; nada do que vem na requisição entra nessa decisão.
export async function DELETE(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);
    const { roomId: servicoId } = await params;

    // Status REAL do serviço, lido aqui — o app não decide o que é arquivado.
    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: { status: true, paymentStatus: true, clientId: true, diaristaId: true, montadorId: true },
    });

    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isParticipant =
      servico.clientId === auth.userId ||
      servico.diaristaId === auth.userId ||
      servico.montadorId === auth.userId;

    if (!isParticipant) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }

    const motivo = motivoParaNaoExcluir(servico);
    if (motivo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            motivo === "PAGAMENTO_PENDENTE"
              ? "Esta conversa não pode ser excluída enquanto o pagamento não for confirmado."
              : "Só conversas arquivadas podem ser excluídas.",
          code: motivo,
        },
        { status: 409 },
      );
    }

    // Sem criar a sala: se ela não existe, não há conversa a excluir.
    const room = await prisma.chatRoom.findUnique({ where: { servicoId }, select: { id: true } });
    if (!room) {
      return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // ON CONFLICT DO NOTHING (único em roomId+userId): dois toques ou duas
      // requisições simultâneas resultam na mesma linha, sem erro.
      await tx.chatRoomExclusao.createMany({
        data: [{ roomId: room.id, userId: auth.userId }],
        skipDuplicates: true,
      });
      // Avisos de mensagem desta conversa, SÓ de quem excluiu, passam a lidos:
      // o contador de notificações não fica apontando para uma conversa que
      // saiu da lista. Os avisos continuam no histórico.
      await tx.notification.updateMany({
        where: {
          userId: auth.userId,
          type: "CHAT_NOVA_MENSAGEM",
          readAt: null,
          OR: [{ chatRoomId: room.id }, { servicoId }],
        },
        data: { readAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true, roomId: servicoId });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
