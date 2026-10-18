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

type CompraDaLoja = {
  productId: string;
  purchaseToken?: string | null;
  purchaseState: string;
  /** Token da conta Dular gravado na compra (`obfuscatedAccountId`). */
  obfuscatedAccountIdAndroid?: string | null;
};

/**
 * A mesma conta Google pode ter compras de outras contas Dular (Montador e
 * Profissional de Casa, por exemplo). Compra marcada com o token de outra conta
 * não é desta: não bloqueia, não é restaurada nem substituída aqui. Sem token
 * na compra, a decisão fica com o servidor.
 */
export function compraDeOutraConta(c: { obfuscatedAccountIdAndroid?: string | null }, tokenDaConta: string | null | undefined): boolean {
  return Boolean(tokenDaConta && c.obfuscatedAccountIdAndroid && c.obfuscatedAccountIdAndroid !== tokenDaConta);
}

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
  | "COMPRA_JA_EXISTENTE"
  | "UPGRADE_INDISPONIVEL"
  /**
   * Falhou ANTES de pedir a compra à Google (requestPurchase não foi chamado
   * nesta tentativa): nada foi cobrado agora e dá para tentar de novo.
   */
  | "FALHA_ANTES_DA_FOLHA";

/** Por que uma tentativa parou antes da folha da Google. */
export type MotivoAntesDaFolha = "sem_conexao" | "tempo_esgotado" | "servidor_indisponivel" | "loja_indisponivel" | "erro_inesperado";

export class ErroCompraLoja extends Error {
  constructor(readonly codigo: CodigoCompraLoja, readonly motivo?: MotivoAntesDaFolha) {
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
  pedido: { produtoId: string; planoBase: string | null | undefined; tokenDaConta: string | null | undefined;
    substituicao?: { produtoId: string; validar: (compra: CompraGoogle) => Promise<void> };
    /** Chamado imediatamente antes de pedir a compra à Google (requestPurchase). */
    aoPedirCompra?: () => void },
  iap: Iap | null = moduloIap(),
): Promise<CompraGoogle> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  if (!pedido.tokenDaConta) throw new ErroCompraLoja("SEM_TOKEN_DA_CONTA");
  if (!pedido.planoBase) throw new ErroCompraLoja("PRODUTO_INDISPONIVEL");

  await iap.initConnection();
  // Recupera uma compra anterior antes de abrir outra cobrança. O servidor ainda
  // precisa validar o comprovante e o vínculo com a conta atual.
  const anteriores = (((await iap.getAvailablePurchases()) ?? []) as CompraDaLoja[])
    .filter((c) => !compraDeOutraConta(c, pedido.tokenDaConta));
  const anterior = anteriores.find((c) => c.productId === pedido.produtoId && (
    (c.purchaseState === "purchased" && c.purchaseToken) || c.purchaseState === "pending"
  ));
  if (anterior) return paraCompraGoogle(anterior);
  if (!pedido.substituicao && anteriores.some((c) => c.purchaseState === "purchased" || c.purchaseState === "pending")) {
    // O servidor pode ainda não conhecer uma compra concluída fora deste fluxo.
    // Restaure primeiro; abrir outra folha criaria assinaturas em paralelo.
    throw new ErroCompraLoja("COMPRA_JA_EXISTENTE");
  }

  let substituida: CompraDaLoja | undefined;
  if (pedido.substituicao) {
    // Nunca escolher uma compra arbitrária de outra conta/produto do aparelho.
    const candidatas = anteriores.filter((c) => c.productId === pedido.substituicao?.produtoId && c.purchaseToken && c.purchaseState === "purchased");
    if (candidatas.length !== 1 || pedido.substituicao.produtoId === pedido.produtoId) throw new ErroCompraLoja("UPGRADE_INDISPONIVEL");
    substituida = candidatas[0];
    // Validação autenticada no servidor deve terminar ANTES da folha de troca.
    await pedido.substituicao.validar(paraCompraGoogle(substituida));
  }

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
          const existente = compras?.find((c) => c.productId === pedido.produtoId && c.purchaseToken && c.purchaseState === "purchased" && !compraDeOutraConta(c, pedido.tokenDaConta));
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
      pedido.aoPedirCompra?.();
      void iap.requestPurchase({
        type: "subs",
        request: {
          google: {
            skus: [pedido.produtoId],
            subscriptionOffers: [{ sku: pedido.produtoId, offerToken: oferta.offerToken }],
            obfuscatedAccountId: pedido.tokenDaConta,
            ...(substituida ? {
              purchaseToken: substituida.purchaseToken,
              subscriptionProductReplacementParams: {
                oldProductId: substituida.productId,
                replacementMode: "with-time-proration" as const,
              },
            } : {}),
          },
        },
      }).catch(falhou);
    } catch (erro) {
      void falhou(erro);
    }
  });
}

/**
 * Compras pagas que a Google Play ainda associa a este aparelho, para
 * reapresentar ao servidor. As de outra conta Dular só são contadas: o
 * comprovante delas não sai do aparelho.
 */
export async function comprasParaRestaurarGoogle(
  tokenDaConta?: string | null,
  iap: Iap | null = moduloIap(),
): Promise<{ compras: CompraGoogle[]; deOutraConta: number }> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  await iap.initConnection();
  const pagas = (((await iap.getAvailablePurchases()) ?? []) as CompraDaLoja[]).filter((c) => c.purchaseToken && c.purchaseState === "purchased");
  const desta = pagas.filter((c) => !compraDeOutraConta(c, tokenDaConta));
  return { compras: desta.map(paraCompraGoogle), deOutraConta: pagas.length - desta.length };
}

/** Conclui (reconhece) a compra na loja. Só depois que o servidor a concedeu. */
export async function concluirCompraGoogle(compra: CompraGoogle, iap: Iap | null = moduloIap()): Promise<void> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  await iap.finishTransaction({ purchase: compra.original as Parameters<Iap["finishTransaction"]>[0]["purchase"], isConsumable: false });
}


/** Apenas produtos publicados e com o plano base sem promoção podem ser oferecidos. */
export async function consultarDisponibilidadeGoogle(
  planos: { id: string; storeProductId?: string | null; storeBasePlanId?: string | null }[],
  iap: Iap | null = moduloIap(),
): Promise<string[]> {
  if (!iap) throw new ErroCompraLoja("IAP_INDISPONIVEL");
  const skus = [...new Set(planos.flatMap((p) => p.storeProductId ? [p.storeProductId] : []))];
  if (!skus.length) return [];
  await iap.initConnection();
  const produtos = ((await iap.fetchProducts({ skus, type: "subs" })) ?? []) as {
    id: string; subscriptionOfferDetailsAndroid?: { basePlanId: string; offerId?: string | null }[];
  }[];
  return planos.filter((p) => p.storeProductId && p.storeBasePlanId && produtos.some((produto) =>
    produto.id === p.storeProductId && produto.subscriptionOfferDetailsAndroid?.some((oferta) =>
      oferta.basePlanId === p.storeBasePlanId && !oferta.offerId))).map((p) => p.id);
}
