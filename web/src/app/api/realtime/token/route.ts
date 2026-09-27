import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { createChatTokenRequest } from "@/lib/ably";
import { salasNaoExcluidasPor } from "@/lib/chatSala";

export const dynamic = "force-dynamic";

// GET /api/realtime/token — emite um TokenRequest do Ably para o cliente
// autenticar no realtime SEM nunca receber a ABLY_API_KEY (root). A capability
// é restrita apenas às salas em que o usuário participa.
export async function GET(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);

    // Salas (ChatRoom) do usuário: cliente, diarista ou montador do serviço.
    // Capability é gerada exclusivamente para essas salas — sem wildcard. As
    // que a pessoa excluiu ficam de fora: nenhum evento delas chega ao app.
    const rooms = await prisma.chatRoom.findMany({
      where: {
        ...salasNaoExcluidasPor(auth.userId),
        servico: {
          OR: [
            { clientId: auth.userId },
            { diaristaId: auth.userId },
            { montadorId: auth.userId },
          ],
        },
      },
      select: { servicoId: true },
    });

    const tokenRequest = await createChatTokenRequest(
      auth.userId,
      rooms.map((r) => r.servicoId),
    );

    return NextResponse.json({ tokenRequest });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
