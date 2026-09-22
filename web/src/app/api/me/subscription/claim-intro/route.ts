import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { checkFeatureAccess } from "@/lib/featureGate";

export const dynamic = "force-dynamic";

/**
 * Reivindica a apresentação do Premium (paywall de primeiro acesso).
 *
 * Responde `shouldShow: true` no MÁXIMO uma vez por conta, para sempre. O
 * estado mora em `User.premiumIntroShownAt`, então sobrevive a fechar o app,
 * a logout/login, a outro aparelho e a reinstalação — era exatamente o que a
 * variável de módulo `jaApresentouPlanos` não fazia.
 *
 * Por que reivindicar e responder no mesmo passo, em vez de "ler e depois
 * marcar": entre uma leitura e uma escrita separadas cabem duas chamadas
 * simultâneas — duas telas da Home montando ao mesmo tempo, ou um retry de
 * rede —, e as duas leriam "ainda não viu". O `updateMany` com
 * `premiumIntroShownAt: null` no where vira um `UPDATE ... WHERE
 * "premiumIntroShownAt" IS NULL` no banco: a primeira chamada afeta 1 linha,
 * a segunda afeta 0. A decisão é do banco, não do processo.
 *
 * Trade-off assumido: se a marca gravar e a resposta se perder no caminho, a
 * conta nunca verá a apresentação. É o lado certo para errar — insistir até a
 * confirmação chegar traz de volta a tela repetida, que é o defeito que esta
 * rota corrige.
 *
 * NÃO é gate de acesso. Não libera plano, não altera limite e não substitui o
 * `checkFeatureAccess` — o paywall por limite esgotado continua vindo do 403
 * LIMIT_EXCEEDED em `/api/servicos/[id]/aceitar`, por outro caminho.
 */
export async function POST(request: Request) {
  let payload;
  try {
    payload = await requireAuthAtivo(request);
  } catch (e) {
    return respostaDeSessao(e) ?? fail("UNAUTHORIZED", "Não autenticado", 401);
  }

  // Quem já assina não recebe apresentação — e sai daqui SEM ser marcado. Se
  // um dia cair para o gratuito (cancelamento ou expiração), a apresentação
  // continua disponível para essa conta, o que é o comportamento desejado:
  // gastar a única exibição com quem já é assinante seria desperdiçá-la.
  const { plan } = await checkFeatureAccess(payload.userId, "SOLICITACOES_MES");
  if (plan !== "FREE") {
    return ok({ shouldShow: false, claimed: false, reason: "ALREADY_SUBSCRIBED" });
  }

  const { count } = await prisma.user.updateMany({
    where: { id: payload.userId, premiumIntroShownAt: null },
    data: { premiumIntroShownAt: new Date() },
  });

  // count === 1 → esta chamada reivindicou agora; é a única que pode exibir.
  // count === 0 → a conta já tinha a marca (ou não existe, o que
  // `requireAuthAtivo` já teria barrado). Nos dois casos, não exibe.
  return count === 1
    ? ok({ shouldShow: true, claimed: true, reason: "FIRST_LOGIN" })
    : ok({ shouldShow: false, claimed: false, reason: "ALREADY_SHOWN" });
}
