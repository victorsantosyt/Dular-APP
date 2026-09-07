import { NextResponse } from "next/server";
import { PLANS } from "@/lib/stripe";
import { requireAuth } from "@/lib/requireAuth";
import { fail } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let payload;
  try {
    payload = requireAuth(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  // Filtra pelo papel de quem pergunta. Sem isso o app listava planos de
  // outro perfil e o checkout recusava depois com PLAN_ROLE_MISMATCH —
  // o usuário só descobria o erro no fim do fluxo.
  const plans = Object.values(PLANS)
    .filter((p) => p.role === payload.role)
    .map(
    ({ id, name, description, role, mode, interval, priceInCents, plan }) => ({
      id,
      name,
      description,
      role,
      mode,
      interval,
      priceInCents,
      plan,
    })
  );

  return NextResponse.json({ ok: true, plans });
}
