import { NextResponse } from "next/server";
import { gateAdmin } from "@/lib/adminGate";
import { rateLimit, cleanupRateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { reconciliarKycDaVerificacao } from "@/lib/safeScore";
import { enviarPushDaNotificacao } from "@/lib/notifications";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";
import { decidirVerificacao, lerCategoria, lerConferencia, lerDecisao } from "@/lib/decisaoVerificacao";
import { lerPedidoDeDecisao } from "@/lib/pedidoDecisaoVerificacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reprovação e pedido de reenvio: os dois exigem motivo, que a pessoa vê no app. */
export async function POST(req: Request) {
  cleanupRateLimit();
  const ip = getRequestIp(req);
  const rl = rateLimit({ key: `admin:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas ações em pouco tempo. Aguarde e tente novamente.", retryAfterMs: Math.max(0, rl.resetAt - Date.now()) },
      { status: 429 },
    );
  }

  const gate = await gateAdmin(req);
  if (gate.error) return gate.error;

  const pedido = await lerPedidoDeDecisao(req);
  const id = pedido.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }
  const motivo = pedido.motivo;
  if (!motivo) {
    return NextResponse.json({ ok: false, error: "Informe o motivo da reprovação." }, { status: 400 });
  }
  const decisao = pedido.tipo === "REENVIO" ? "REENVIO" : "REPROVADO";

  const r = await decidirVerificacao({
    id,
    adminId: gate.auth.userId,
    decisao,
    motivo,
    revisao: pedido.revisao,
    esperado: lerDecisao(pedido.esperado),
    motivoCategoria: lerCategoria(pedido.motivoCategoria),
  });
  if (r.tipo === "erro") return NextResponse.json({ ok: false, error: r.mensagem }, { status: r.status });

  // A reprovação já está gravada: falha no score não a desfaz, mas não pode
  // sumir em silêncio.
  await reconciliarKycDaVerificacao(id, motivo).catch((err) => {
    console.error("[safeScore] KYC da reprovação não reconciliado — a reprovação segue:", { userId: r.userId, verificacaoId: id }, err);
  });
  // Push do aviso já gravado (best-effort; não desfaz nem repete nada).
  if (r.tipo === "decidida") await enviarPushDaNotificacao(r.aviso);
  const guardian = await getGuardianStatusForUser(r.userId);

  return NextResponse.json({ ok: true, verification: r.verification, guardian, jaDecidida: r.tipo === "ja-decidida" });
}
