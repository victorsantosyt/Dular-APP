import { NextResponse } from "next/server";
import { gateAdmin } from "@/lib/adminGate";
import { rateLimit, cleanupRateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { reconciliarKycDaVerificacao } from "@/lib/safeScore";
import { enviarPushDaNotificacao } from "@/lib/notifications";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";
import { pendenciasDeVisibilidade } from "@/lib/adminPerfis";
import { decidirVerificacao, lerCategoria, lerConferencia, lerDecisao } from "@/lib/decisaoVerificacao";
import { lerPedidoDeDecisao } from "@/lib/pedidoDecisaoVerificacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (pedido.revisao && !pedido.motivo) {
    return NextResponse.json({ ok: false, error: "Informe o motivo da revisão." }, { status: 400 });
  }
  const motivo = pedido.motivo || "Documentos aprovados.";

  const r = await decidirVerificacao({
    id,
    adminId: gate.auth.userId,
    decisao: "APROVADO",
    motivo,
    revisao: pedido.revisao,
    esperado: lerDecisao(pedido.esperado),
    conferencia: lerConferencia(pedido.conferencia),
  });
  if (r.tipo === "erro") return NextResponse.json({ ok: false, error: r.mensagem }, { status: r.status });

  // SafeScore acompanha a decisão VIGENTE do envio (primeira decisão ou
  // revisão). Também no repetido: pelo estado, rodar de novo dá delta 0, e
  // repara um ajuste que tenha falhado depois do commit.
  await reconciliarKycDaVerificacao(id, motivo);
  // Push do aviso já gravado: acelera a atualização do app (que consulta
  // /api/me/sincronizacao ao recebê-lo). Best-effort — falha aqui não desfaz
  // nem repete a decisão ou o aviso.
  if (r.tipo === "decidida") await enviarPushDaNotificacao(r.aviso);
  const guardian = await getGuardianStatusForUser(r.userId);

  // A aprovação continua sendo sobre o DOCUMENTO: um KYC válido não deixa de
  // ser válido porque o perfil está pela metade, e nada aqui muda essa regra.
  //
  // O que mudou é a aprovação parar de prometer o que não cumpre. A busca exige
  // VERIFICADO **e** perfil completo (api/diaristas/buscar), e descarta o
  // incompleto em silêncio. Aprovar sem olhar a completude criava gente
  // aprovada, ativa e invisível — sem fila, sem aviso e sem nada que
  // apontasse para ela. Agora a resposta diz o que ainda falta, no mesmo lugar
  // onde a decisão humana acontece.
  const visibilidade = await pendenciasDeVisibilidade(r.userId, r.role as any);

  return NextResponse.json({ ok: true, verification: r.verification, guardian, visibilidade, jaDecidida: r.tipo === "ja-decidida" });
}
