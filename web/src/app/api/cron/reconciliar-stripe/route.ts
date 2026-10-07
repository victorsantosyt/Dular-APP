import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { varrerOperacoes } from "@/lib/trocaDePlano";

export const dynamic = "force-dynamic";
// A trava global da varredura solta em até 110 s (limitesTroca.timeoutVarreduraMs).
export const maxDuration = 120;

/**
 * Cron da plataforma (Vercel Cron, `vercel.json`): a mesma varredura das
 * operações Stripe que roda no boot de cada servidor (lib/trocaDePlano) — aqui
 * com hora marcada, sem depender de instância nova, pedido ou evento.
 *
 * Autenticação SÓ pelo segredo próprio: a Vercel manda `Authorization: Bearer
 * <CRON_SECRET>`. Sem segredo configurado (ou curto demais), recusa e NÃO varre:
 * falha fechada. Comparação em tempo constante.
 *
 * Repetida ou concorrente é segura: a varredura tem trava global sem espera
 * (a segunda chamada sai com `emAndamento`) e cada operação é idempotente —
 * relê a Stripe antes de agir, então não cobra de novo.
 *
 * A Vercel não repete uma execução que falhou: falha devolve 500 para aparecer
 * nos logs do cron, e o que ficou pendente volta na próxima rodada.
 */
const TAMANHO_MINIMO_DO_SEGREDO = 16;

function autenticar(req: Request): "ok" | "negado" | "sem_segredo" {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || segredo.length < TAMANHO_MINIMO_DO_SEGREDO) return "sem_segredo";
  const recebido = createHash("sha256").update(req.headers.get("authorization") ?? "").digest();
  const esperado = createHash("sha256").update(`Bearer ${segredo}`).digest();
  return timingSafeEqual(recebido, esperado) ? "ok" : "negado";
}

export async function GET(req: Request) {
  const autenticacao = autenticar(req);
  if (autenticacao === "sem_segredo") {
    console.error("[cron/reconciliar-stripe] CRON_SECRET ausente ou com menos de 16 caracteres; varredura NÃO executada.");
    return NextResponse.json({ ok: false, error: "Cron não configurado." }, { status: 503 });
  }
  if (autenticacao === "negado") {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { examinadas, falhas, emAndamento } = await varrerOperacoes({ limite: 50 });
    if (emAndamento) return NextResponse.json({ ok: true, emAndamento: true, examinadas: 0, falhas: 0 });
    if (falhas > 0) console.error("[cron/reconciliar-stripe] operações com falha seguem gravadas para a próxima rodada:", falhas);
    return NextResponse.json({ ok: falhas === 0, examinadas, falhas }, { status: falhas === 0 ? 200 : 500 });
  } catch (err) {
    console.error("[cron/reconciliar-stripe] varredura interrompida; as operações seguem gravadas:", err);
    return NextResponse.json({ ok: false, error: "Varredura interrompida." }, { status: 500 });
  }
}
