import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { diagnosticarGate, listarAssinaturas } from "@/lib/adminPlanos";
import type { SubscriptionProvider, SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico do paywall em JSON. SOMENTE LEITURA — não existe POST/PUT/DELETE
 * aqui e não deve passar a existir: mudar limite é migration, não requisição.
 *
 * A página do painel lê a mesma lib direto (server component), então esta rota
 * não é o que desenha a tela. Ela existe porque "o paywall está ligado?" é uma
 * pergunta que se quer poder fazer de fora — por um alerta, por um smoke test
 * de deploy — sem abrir o navegador e olhar.
 */
function gate(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "ADMIN") {
      return {
        error: NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 }),
      };
    }
    return { auth };
  } catch {
    return {
      error: NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 }),
    };
  }
}

const STATUS_VALIDOS: SubscriptionStatus[] = ["TRIAL", "ACTIVE", "CANCELED", "EXPIRED"];
const PROVIDERS_VALIDOS: SubscriptionProvider[] = ["STRIPE", "APPLE", "GOOGLE", "MANUAL"];

export async function GET(req: Request) {
  const g = gate(req);
  if (g.error) return g.error;

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const providerParam = url.searchParams.get("provider");
    const paginaParam = Number(url.searchParams.get("pagina") ?? "1");

    // Valor fora do enum é ignorado, não vira filtro inválido no Prisma.
    const status = STATUS_VALIDOS.find((s) => s === statusParam);
    const provider = PROVIDERS_VALIDOS.find((p) => p === providerParam);

    const [diagnostico, assinaturas] = await Promise.all([
      diagnosticarGate(),
      listarAssinaturas({
        status,
        provider,
        pagina: Number.isFinite(paginaParam) ? paginaParam : 1,
      }),
    ]);

    return NextResponse.json({ ok: true, diagnostico, assinaturas });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro" },
      { status: 500 }
    );
  }
}
