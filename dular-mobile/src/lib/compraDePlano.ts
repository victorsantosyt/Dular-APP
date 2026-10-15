import { Linking, Platform } from "react-native";

import { api } from "@/lib/api";
import {
  ErroCompraLoja,
  comprarAssinaturaGoogle,
  comprasParaRestaurarGoogle,
  concluirCompraGoogle,
  type CompraGoogle,
} from "@/lib/lojaGoogle";

/**
 * Por onde a assinatura é comprada.
 *
 * Duas rotas, e quem escolhe é o SERVIDOR:
 *
 * - LOJA (App Store / Google Play) — é o que a diretriz 3.1.1 da Apple exige
 *   de assinatura que desbloqueia função dentro do app. Sem isso a submissão é
 *   recusada.
 * - STRIPE, abrindo o checkout no navegador — o que já funciona hoje, e o que
 *   segue valendo fora das lojas.
 *
 * O servidor informa em `/api/billing/plans` se os produtos já existem nas
 * lojas. Enquanto não existirem, o app usa o Stripe exatamente como hoje; no
 * dia em que existirem, ele passa a comprar pela loja sozinho, sem publicar
 * versão nova só para isso e sem mandar ninguém para uma compra inexistente.
 */

export type CaminhoDePagamento = {
  stripe: boolean;
  loja: { ios: boolean; android: boolean };
  /** Token da conta que vai na compra da loja. Só vem com alguma loja pronta. */
  tokenLoja?: string | null;
};

export type PlanoParaCompra = {
  id: string;
  storeProductId?: string | null;
  /** Google: plano base do produto (mensal/anual). */
  storeBasePlanId?: string | null;
};

/** A loja está pronta para receber compra nesta plataforma? */
export function lojaDisponivel(caminho: CaminhoDePagamento | null | undefined): boolean {
  if (!caminho) return false;
  if (Platform.OS === "ios") return caminho.loja.ios;
  if (Platform.OS === "android") return caminho.loja.android;
  return false;
}

export type ResultadoCompra =
  | { via: "loja"; plano: string }
  | { via: "loja"; pendente: true }
  | { via: "stripe"; url: string };

/**
 * Apresenta ao servidor uma compra paga na loja. Concedida (200), conclui a
 * compra na loja; pendente (202), não conclui — o servidor recebe da Google o
 * aviso de quando ela for paga. Recusa (4xx) sobe como erro da api.
 */
async function apresentarCompraGoogle(compra: CompraGoogle): Promise<{ plano: string } | { pendente: true }> {
  const res = await api.post<{ plan?: string; pendente?: boolean }>("/api/billing/loja", {
    plataforma: "android",
    produtoId: compra.produtoId,
    comprovante: compra.comprovante,
  });
  if (res.status === 202 || res.data?.pendente) return { pendente: true };
  try {
    await concluirCompraGoogle(compra);
  } catch {
    // O servidor já reconheceu a compra no Google ao concedê-la; concluir aqui
    // é redundância. Na próxima restauração ela é apresentada de novo.
  }
  return { plano: res.data.plan ?? "FREE" };
}

/**
 * Inicia a compra do plano.
 *
 * Pela loja, a compra acontece no aparelho e o comprovante é validado no
 * servidor — que consulta a loja, porque recibo é dado vindo do cliente e
 * aceitá-lo de olhos fechados daria PREMIUM a quem souber montar um JSON.
 * Hoje só a Google Play existe; no iOS a loja segue indisponível.
 *
 * Pelo Stripe, devolve a URL do checkout para abrir no navegador.
 */
export async function comprarPlano(
  plano: PlanoParaCompra,
  caminho: CaminhoDePagamento | null | undefined,
): Promise<ResultadoCompra> {
  if (lojaDisponivel(caminho) && plano.storeProductId) {
    if (Platform.OS !== "android") throw new ErroCompraLoja("IAP_INDISPONIVEL");
    const compra = await comprarAssinaturaGoogle({
      produtoId: plano.storeProductId,
      planoBase: plano.storeBasePlanId,
      tokenDaConta: caminho?.tokenLoja,
    });
    if (compra.pendente) return { via: "loja", pendente: true };
    const r = await apresentarCompraGoogle(compra);
    return "pendente" in r ? { via: "loja", pendente: true } : { via: "loja", plano: r.plano };
  }

  const res = await api.post<{ url: string }>("/api/billing/checkout", { planId: plano.id });
  return { via: "stripe", url: res.data.url };
}

export type ResultadoRestauracao = {
  /** Compras que o servidor concedeu (ou já tinha concedido) a esta conta. */
  restauradas: number;
  /** Compras que o servidor recusou (de outra conta, vencida, outro perfil). */
  recusadas: number;
  /** Pagamentos ainda pendentes: não são assinaturas concedidas. */
  pendentes: number;
  /** Falhas transitórias na confirmação; restauração pode ser repetida. */
  falhas: number;
  /** Plano depois da última restauração concedida. */
  plano: string | null;
};

/**
 * Restaurar compras: reapresenta ao servidor as assinaturas pagas que a Google
 * Play associa a este aparelho. Serve para quem trocou de aparelho, reinstalou
 * o app ou fechou o app no meio da compra. O servidor decide cada uma — compra
 * de outra conta continua recusada.
 */
export async function restaurarCompras(caminho: CaminhoDePagamento | null | undefined): Promise<ResultadoRestauracao> {
  if (Platform.OS !== "android" || !lojaDisponivel(caminho)) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  const resultado: ResultadoRestauracao = { restauradas: 0, recusadas: 0, pendentes: 0, falhas: 0, plano: null };
  for (const compra of await comprasParaRestaurarGoogle()) {
    try {
      const r = await apresentarCompraGoogle(compra);
      if ("plano" in r) {
        resultado.restauradas += 1;
        resultado.plano = r.plano;
      } else {
        resultado.pendentes += 1;
      }
    } catch (erro) {
      const status = (erro as { response?: { status?: number } })?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) resultado.recusadas += 1;
      else resultado.falhas += 1;
    }
  }
  return resultado;
}

/** Abre o checkout do Stripe. Separado para a tela decidir quando abrir. */
export async function abrirCheckout(url: string): Promise<void> {
  await Linking.openURL(url);
}
