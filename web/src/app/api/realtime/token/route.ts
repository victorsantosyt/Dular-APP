import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createChatTokenRequest } from "@/lib/ably";

export const dynamic = "force-dynamic";

// GET /api/realtime/token — emite um TokenRequest do Ably para o cliente
// autenticar no realtime SEM nunca receber a ABLY_API_KEY (root). A capability
// é restrita apenas às salas em que o usuário participa.
export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);

    // Salas (ChatRoom) do usuário: cliente, diarista ou montador do serviço.
    // Capability é gerada exclusivamente para essas salas — sem wildcard.
    const rooms = await prisma.chatRoom.findMany({
      where: {
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
