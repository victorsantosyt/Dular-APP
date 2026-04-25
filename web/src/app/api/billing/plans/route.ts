import { NextResponse } from "next/server";
import { PLANS } from "@/lib/stripe";
import { requireAuth } from "@/lib/requireAuth";
import { fail } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAuth(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  const plans = Object.values(PLANS).map(
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
