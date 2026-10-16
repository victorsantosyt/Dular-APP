import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { PLANS } from "@/lib/stripe";
import { catalogoGooglePlay, ErroDeLoja, googlePlayLigado } from "@/lib/lojas";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops/google-play-catalogo — DIAGNÓSTICO DE HOMOLOGAÇÃO (issue #359).
 *
 * Compara o catálogo do Dular com o que está cadastrado no Play Console, pela
 * integração já configurada no staging. Só leitura; devolve ids e estados.
 *
 * Existe só onde a integração Google está ligada para homologar (Preview com
 * o banco de staging, `googlePlayLigado()`), e só com o cabeçalho
 * `x-diagnostico` igual a DULAR_DIAGNOSTICO_GOOGLE. Fora disso: 404, como se
 * a rota não existisse. Retirar antes da integração ir para produção.
 */
function autorizado(req: Request): boolean {
  const segredo = process.env.DULAR_DIAGNOSTICO_GOOGLE ?? "";
  if (segredo.length < 32) return false;
  const recebido = createHash("sha256").update(req.headers.get("x-diagnostico") ?? "").digest();
  return timingSafeEqual(recebido, createHash("sha256").update(segredo).digest());
}

export async function GET(req: Request) {
  if (!googlePlayLigado() || !autorizado(req)) return NextResponse.json({ ok: false }, { status: 404 });
  let catalogo;
  try {
    catalogo = await catalogoGooglePlay();
  } catch (err) {
    const codigo = err instanceof ErroDeLoja ? err.codigo : "ERRO";
    return NextResponse.json({ ok: false, codigo }, { status: 503 });
  }
  const dular = Object.values(PLANS).map((p) => ({ id: p.id, role: p.role, storeProductId: p.storeProductId, storeBasePlanId: p.storeBasePlanId }));
  return NextResponse.json({ ok: true, dular, console: catalogo });
}
