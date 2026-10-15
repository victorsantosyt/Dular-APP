import type * as ExpoIap from "expo-iap";

/**
 * Compra de assinatura na Google Play (issue #359), pela expo-iap.
 *
 * O app só pede a compra e entrega o comprovante (`purchaseToken`) ao
 * servidor: quem decide se ela vale é o servidor, consultando o Google. Três
 * regras daqui não mudam:
 *
 * - toda compra leva o token da conta (`obfuscatedAccountId`), que o servidor
 *   gerou em `/api/billing/plans`. Sem ele a compra não é feita: é por ele que
 *   uma notificação de compra que o app não chegou a apresentar encontra a
 *   conta certa;
 * - pagamento pendente (boleto, por exemplo) não é apresentado nem concluído:
 *   a Google avisa o servidor quando ele for pago;
 * - a compra só é concluída (`finishTransaction`, que no Android é o
 *   reconhecimento) depois que o servidor a concedeu.
 *
 * A expo-iap é módulo nativo: no Expo Go o import falha. Ela é carregada sob
 * demanda e, ausente, a compra pela loja fica indisponível — o resto do app
 * segue funcionando.
 */

type Iap = Pick<
  typeof ExpoIap,
  "initConnection" | "fetchProducts" | "requestPurchase" | "getAvailablePurchases" | "finishTransaction" | "purchaseUpdatedListener" | "purchaseErrorListener"
>;

type CompraDaLoja = { productId: string; purchaseToken?: string | null; purchaseState: string };

export type CompraGoogle = {
  produtoId: string;
  comprovante: string;
  pendente: boolean;
  /** A compra como a expo-iap a devolveu; é ela que `finishTransaction` recebe. */
  original: CompraDaLoja;
};

export type CodigoCompraLoja =
  | "IAP_INDISPONIVEL"
  | "SEM_TOKEN_DA_CONTA"
  | "PRODUTO_INDISPONIVEL"
  | "COMPRA_CANCELADA"
  | "COMPRA_NAO_CONCLUIDA"
  | "COMPRA_EM_CONFIRMACAO"
  | "COMPRA_JA_EXISTENTE";

export class ErroCompraLoja extends Error {
  constructor(readonly codigo: CodigoCompraLoja) {
    super(codigo);
  }
}

let modulo: Iap | null | undefined;

/** A expo-iap, ou nulo onde o módulo nativo não existe (Expo Go). */
export function moduloIap(): Iap | null {
  if (modulo === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modulo = require("expo-iap") as Iap;
    } catch {
      modulo = null;
    }
  }
  return modulo;
}

function paraCompraGoogle(c: CompraDaLoja): CompraGoogle {
  return { produtoId: c.productId, comprovante: c.purchaseToken ?? "", pendente: c.purchaseState === "pending", original: c };
}

/**
 * Pede à Google Play a assinatura do produto, no plano base do catálogo e com
 * o token da conta. Devolve a compra — pendente ou paga — sem concluí-la.
 */
export async function comprarAssinaturaGoogle(
  pedido: { produtoId: string; planoBase: string | null | undefined; tokenDaConta: string | null | undefined },
  iap: Iap | null = moduloIap(),
): Promise<CompraGoogle> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  if (!pedido.tokenDaConta) throw new ErroCompraLoja("SEM_TOKEN_DA_CONTA");
  if (!pedido.planoBase) throw new ErroCompraLoja("PRODUTO_INDISPONIVEL");

  await iap.initConnection();
  // Recupera uma compra anterior antes de abrir outra cobrança. O servidor ainda
  // precisa validar o comprovante e o vínculo com a conta atual.
  const anteriores = ((await iap.getAvailablePurchases()) ?? []) as CompraDaLoja[];
  const anterior = anteriores.find((c) => c.productId === pedido.produtoId && (
    (c.purchaseState === "purchased" && c.purchaseToken) || c.purchaseState === "pending"
  ));
  if (anterior) return paraCompraGoogle(anterior);

  const produtos = ((await iap.fetchProducts({ skus: [pedido.produtoId], type: "subs" })) ?? []) as {
    id: string;
    subscriptionOfferDetailsAndroid?: { basePlanId: string; offerId?: string | null; offerToken: string }[];
  }[];
  const produto = produtos.find((p) => p.id === pedido.produtoId);
  // Só o plano base, sem oferta promocional: é o plano base que o servidor confere.
  const oferta = produto?.subscriptionOfferDetailsAndroid?.find((o) => o.basePlanId === pedido.planoBase && !o.offerId);
  if (!oferta) throw new ErroCompraLoja("PRODUTO_INDISPONIVEL");

  // O requestPurchase só abre a folha nativa. O comprovante chega pelo evento,
  // inclusive quando o Android não devolve nenhuma compra no retorno da chamada.
  return new Promise<CompraGoogle>((resolve, reject) => {
    let encerrada = false;
    const listeners: { remove(): void }[] = [];
    const timer = setTimeout(() => terminar(new ErroCompraLoja("COMPRA_EM_CONFIRMACAO")), 120_000);
    function terminar(erro: unknown, compra?: CompraDaLoja) {
      if (encerrada) return;
      encerrada = true;
      clearTimeout(timer);
      listeners.forEach((listener) => listener.remove());
      if (compra) resolve(paraCompraGoogle(compra));
      else reject(erro);
    }
    const falhou = async (erro: unknown) => {
      if (encerrada) return;
      const codigo = (erro as { code?: string } | null)?.code;
      if (codigo === "user-cancelled") return terminar(new ErroCompraLoja("COMPRA_CANCELADA"));
      if (codigo === "already-owned") {
        try {
          const compras = (await iap.getAvailablePurchases()) as CompraDaLoja[] | null;
          const existente = compras?.find((c) => c.productId === pedido.produtoId && c.purchaseToken && c.purchaseState === "purchased");
          if (existente) return terminar(null, existente);
          return terminar(new ErroCompraLoja("COMPRA_JA_EXISTENTE"));
        } catch (e) {
          return terminar(e);
        }
      }
      terminar(erro);
    };
    try {
      listeners.push(iap.purchaseUpdatedListener((evento) => {
        const compra = evento as CompraDaLoja;
        if (compra.productId !== pedido.produtoId) return;
        if (compra.purchaseState === "pending") return terminar(null, compra);
        if (compra.purchaseState === "purchased" && compra.purchaseToken) terminar(null, compra);
      }));
      listeners.push(iap.purchaseErrorListener((erro) => { void falhou(erro); }));
      void iap.requestPurchase({
        type: "subs",
        request: {
          google: {
            skus: [pedido.produtoId],
            subscriptionOffers: [{ sku: pedido.produtoId, offerToken: oferta.offerToken }],
            obfuscatedAccountId: pedido.tokenDaConta,
          },
        },
      }).catch(falhou);
    } catch (erro) {
      void falhou(erro);
    }
  });
}

/** Compras pagas que a Google Play ainda associa a este aparelho, para reapresentar ao servidor. */
export async function comprasParaRestaurarGoogle(iap: Iap | null = moduloIap()): Promise<CompraGoogle[]> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  await iap.initConnection();
  const compras = ((await iap.getAvailablePurchases()) ?? []) as CompraDaLoja[];
  return compras.filter((c) => c.purchaseToken && c.purchaseState === "purchased").map(paraCompraGoogle);
}

/** Conclui (reconhece) a compra na loja. Só depois que o servidor a concedeu. */
export async function concluirCompraGoogle(compra: CompraGoogle, iap: Iap | null = moduloIap()): Promise<void> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  await iap.finishTransaction({ purchase: compra.original as Parameters<Iap["finishTransaction"]>[0]["purchase"], isConsumable: false });
}
