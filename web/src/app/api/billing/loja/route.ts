import { z } from "zod";

import { concederAssinatura } from "@/lib/assinatura";
import { ok, fail } from "@/lib/apiResponse";
import { planoPorProdutoDaLoja } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { cleanupRateLimit, rateLimit } from "@/lib/rateLimit";
import { ErroDeLoja, verificarCompraApple, verificarCompraGoogle } from "@/lib/lojas";

/**
 * POST /api/billing/loja — registra uma compra feita na App Store ou no Google
 * Play.
 *
 * O app compra pela loja (é o que a diretriz 3.1.1 da Apple exige de assinatura
 * que desbloqueia função dentro do app) e manda o comprovante para cá. Quem
 * decide se a compra vale é a LOJA, consultada aqui — o recibo sozinho é dado
 * vindo do cliente, e aceitá-lo seria dar PREMIUM a quem souber montar um JSON.
 */

const corpo = z.object({
  plataforma: z.enum(["ios", "android"]),
  /** Id do produto na loja, como aparece no catálogo. */
  produtoId: z.string().min(1).max(200),
  /**
   * Comprovante: `transactionId` no iOS, `purchaseToken` no Android. A
   * verificação usa este valor contra a loja, nunca o que ele afirma ser.
   */
  comprovante: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  let auth;
  try {
    cleanupRateLimit();
    auth = await requireAuthAtivo(request);
  } catch {
    return fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  const limite = rateLimit({ key: `loja:${auth.userId}`, limit: 20, windowMs: 10 * 60_000 });
  if (!limite.ok) {
    return fail("RATE_LIMITED", "Muitas tentativas. Aguarde um pouco.", 429);
  }

  const parsed = corpo.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("INVALID_BODY", "Dados inválidos", 400);

  const plano = planoPorProdutoDaLoja(parsed.data.produtoId);
  if (!plano) return fail("INVALID_PLAN", "Produto desconhecido", 400);

  // Mesmo guarda do checkout do Stripe: plano de diarista não é vendido a
  // montador, e o empregador não tem plano nenhum.
  if (plano.role !== auth.role) {
    return fail("PLAN_ROLE_MISMATCH", "Plano indisponível para este perfil", 403);
  }

  let compra;
  try {
    compra =
      parsed.data.plataforma === "ios"
        ? await verificarCompraApple(parsed.data.comprovante)
        : await verificarCompraGoogle(parsed.data.produtoId, parsed.data.comprovante);
  } catch (erro) {
    if (erro instanceof ErroDeLoja) {
      // Sem credencial ou loja fora do ar NÃO é compra inválida. Dizer o
      // contrário a quem acabou de pagar é o pior desfecho possível: ele perde
      // o dinheiro e a confiança. 503 diz "tente de novo", e o app pode
      // reapresentar o comprovante depois.
      const status = erro.codigo === "COMPRA_INVALIDA" ? 400 : 503;
      console.error("[loja] verificação falhou:", erro.codigo, erro.message);
      return fail(erro.codigo, erro.message, status);
    }
    console.error("[loja] erro inesperado:", erro);
    return fail("LOJA_INDISPONIVEL", "Não foi possível confirmar a compra agora.", 503);
  }

  // O produto que a LOJA confirmou manda, não o que o app disse ter comprado.
  const planoConfirmado = planoPorProdutoDaLoja(compra.storeProductId) ?? plano;

  const provider = parsed.data.plataforma === "ios" ? "APPLE" : "GOOGLE";

  // Um comprovante não pode ativar plano em duas contas. O índice único
  // (provider, externalId) garante isso no banco; aqui devolvemos um erro
  // claro em vez de deixar estourar violação de constraint.
  const jaUsado = await prisma.subscription.findFirst({
    where: { provider, externalId: compra.externalId, NOT: { userId: auth.userId } },
    select: { id: true },
  });
  if (jaUsado) {
    return fail("COMPRA_DE_OUTRA_CONTA", "Esta compra já está vinculada a outra conta.", 409);
  }

  const assinatura = await concederAssinatura({
    userId: auth.userId,
    plano: planoConfirmado,
    provider,
    externalId: compra.externalId,
    expiraEm: compra.expiraEm,
  });

  return ok({
    plan: assinatura.plan,
    status: assinatura.status,
    expiresAt: assinatura.expiresAt,
  });
}
