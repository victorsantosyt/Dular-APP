import { NextResponse } from "next/server";
import { googlePlayLigado } from "@/lib/lojas";
import { autenticarPushGoogle, processarMensagemGoogle } from "@/lib/googlePlayCompras";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/google-play — notificações em tempo real do Google Play
 * (RTDN), entregues por uma assinatura push do Pub/Sub com autenticação OIDC.
 *
 * - Integração desligada (`googlePlayLigado()`): 503, nada é lido.
 * - Token OIDC inválido (assinatura, emissor, audiência, conta de serviço,
 *   e-mail verificado): 401, nada é lido.
 * - A notificação só serve de gatilho: o estado vem de uma consulta nova ao
 *   Google (lib/googlePlayCompras). Falha transitória: 500, e o Pub/Sub reenvia.
 */
export async function POST(request: Request) {
  if (!googlePlayLigado()) {
    return NextResponse.json({ ok: false, error: "Integração Google Play desligada." }, { status: 503 });
  }
  if (!(await autenticarPushGoogle(request.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const corpo = (await request.json().catch(() => null)) as { message?: { messageId?: unknown; data?: unknown } } | null;
  if (!corpo?.message) return NextResponse.json({ ok: false, error: "Mensagem inválida." }, { status: 400 });
  try {
    const resultado = await processarMensagemGoogle(corpo.message);
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    console.error("[google-play] notificação não processada; o Pub/Sub reenvia:", (err as Error)?.message);
    return NextResponse.json({ ok: false, error: "Falha ao processar." }, { status: 500 });
  }
}
