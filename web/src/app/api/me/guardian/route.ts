import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/guardian
 *
 * Retorna a matriz de permissões do SafeScore Guardian para o user logado.
 * Mobile usa para:
 *   - exibir motivos de bloqueio nos perfis (DIARISTA/MONTADOR/EMPREGADOR)
 *   - travar CTAs (empregador "Solicitar serviço", profissional "Aceitar")
 *   - cruzar com 403 GUARDIAN_BLOCKED retornado em ações
 *
 * Nunca retorna 403 — sempre devolve o JSON do Guardian, mesmo bloqueado.
 * O bloqueio é exposto em `ok=false` e `motivos[]`.
 */
export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    const guardian = await getGuardianStatusForUser(auth.userId);
    return NextResponse.json({ ok: true, guardian });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
