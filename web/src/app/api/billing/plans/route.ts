import { NextResponse } from "next/server";
import { PLANS } from "@/lib/stripe";
import { lojasProntas } from "@/lib/lojas";
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
    ({ id, name, description, role, mode, interval, priceInCents, plan, storeProductId }) => ({
      id,
      name,
      description,
      role,
      mode,
      interval,
      priceInCents,
      plan,
      storeProductId,
    })
  );

  // Por onde comprar. Quem decide é o SERVIDOR, não o app: enquanto os produtos
  // não existirem nas lojas, `loja` vem falso e o app segue no checkout do
  // Stripe, exatamente como hoje. No dia em que as credenciais entrarem, o app
  // passa a comprar pela loja sozinho — sem publicar versão nova só para isso,
  // e sem risco de mandar gente para uma compra que ainda não existe.
  const lojas = lojasProntas();
  const pagamento = {
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    loja: { ios: lojas.apple, android: lojas.google },
  };

  return NextResponse.json({ ok: true, plans, pagamento });
}
