import { Linking, Platform } from "react-native";

import { api } from "@/lib/api";

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
};

export type PlanoParaCompra = {
  id: string;
  storeProductId?: string | null;
};

/** A loja está pronta para receber compra nesta plataforma? */
export function lojaDisponivel(caminho: CaminhoDePagamento | null | undefined): boolean {
  if (!caminho) return false;
  if (Platform.OS === "ios") return caminho.loja.ios;
  if (Platform.OS === "android") return caminho.loja.android;
  return false;
}

/**
 * Compra pela loja do sistema.
 *
 * O corpo fica isolado aqui de propósito: a biblioteca de compra in-app é
 * módulo nativo e NÃO roda em Expo Go, que é como o app é desenvolvido hoje.
 * Instalá-la agora tiraria o Expo Go de todo mundo por uma função que ainda
 * não tem produto cadastrado para comprar.
 *
 * Quando houver dev build, o que muda é só o miolo desta função: pedir a
 * compra à loja e devolver o comprovante. O resto do caminho — validar no
 * servidor, conceder o plano — já está pronto e não muda.
 */
async function comprarNaLoja(_produtoId: string): Promise<{ comprovante: string }> {
  throw new Error("IAP_INDISPONIVEL");
}

export type ResultadoCompra =
  | { via: "loja"; plano: string }
  | { via: "stripe"; url: string };

/**
 * Inicia a compra do plano.
 *
 * Pela loja, a compra acontece no aparelho e o comprovante é validado no
 * servidor — que consulta a loja, porque recibo é dado vindo do cliente e
 * aceitá-lo de olhos fechados daria PREMIUM a quem souber montar um JSON.
 *
 * Pelo Stripe, devolve a URL do checkout para abrir no navegador.
 */
export async function comprarPlano(
  plano: PlanoParaCompra,
  caminho: CaminhoDePagamento | null | undefined,
): Promise<ResultadoCompra> {
  if (lojaDisponivel(caminho) && plano.storeProductId) {
    const { comprovante } = await comprarNaLoja(plano.storeProductId);
    const res = await api.post<{ plan: string }>("/api/billing/loja", {
      plataforma: Platform.OS === "ios" ? "ios" : "android",
      produtoId: plano.storeProductId,
      comprovante,
    });
    return { via: "loja", plano: res.data.plan };
  }

  const res = await api.post<{ url: string }>("/api/billing/checkout", { planId: plano.id });
  return { via: "stripe", url: res.data.url };
}

/** Abre o checkout do Stripe. Separado para a tela decidir quando abrir. */
export async function abrirCheckout(url: string): Promise<void> {
  await Linking.openURL(url);
}
