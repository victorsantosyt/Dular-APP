/**
 * Vocabulário único do paywall: por que ele abriu, e o que a tela recebe.
 *
 * Existe para que o motivo não vire string solta espalhada pelas telas. São
 * dois gatilhos de verdade, e eles NÃO compartilham regra de exibição:
 *
 *   FIRST_LOGIN        apresentação do Premium, uma vez por CONTA, decidida
 *                      pelo backend em POST /api/me/subscription/claim-intro;
 *   FREE_LIMIT_REACHED cota do gratuito esgotada, disparada pelo 403
 *                      LIMIT_EXCEEDED de /api/servicos/[id]/aceitar — pode
 *                      acontecer quantas vezes a pessoa esbarrar no limite;
 *   USER_REQUESTED     a pessoa abriu "Meu plano" ou a barra de limite por
 *                      conta própria. Sem regra nenhuma: ela pediu.
 */
export const MotivoPaywall = {
  FIRST_LOGIN: "FIRST_LOGIN",
  FREE_LIMIT_REACHED: "FREE_LIMIT_REACHED",
  USER_REQUESTED: "USER_REQUESTED",
} as const;

export type MotivoPaywall = (typeof MotivoPaywall)[keyof typeof MotivoPaywall];

/** Parâmetros da rota "Paywall". `mensagem` só acompanha o caso de limite. */
export type PaywallParams = {
  motivo: MotivoPaywall;
  mensagem?: string;
};

/** Resposta de POST /api/me/subscription/claim-intro. */
export type RespostaClaimIntro = {
  shouldShow?: boolean;
  claimed?: boolean;
  reason?: string;
};

/**
 * Decide, a partir da resposta do backend, se a apresentação deve aparecer.
 *
 * Falha FECHADO por construção: só o literal `true` exibe. Resposta truncada,
 * shape inesperado, corpo vazio ou erro de rede (que nem chega aqui) resultam
 * em não exibir. Errar para o lado de não mostrar é barato — a conta continua
 * sem a marca no backend e a apresentação segue disponível na próxima
 * abertura. Errar para o outro lado é o defeito que estamos corrigindo.
 */
export function deveExibirIntro(resposta: unknown): boolean {
  return (resposta as RespostaClaimIntro | undefined)?.shouldShow === true;
}

/**
 * Se esta sessão pode perguntar ao backend sobre a apresentação.
 *
 * Três condições, todas necessárias:
 *
 *  - a sessão está autenticada E o usuário canônico já carregou. Perguntar
 *    durante o bootstrap reivindicaria a apresentação de uma conta que ainda
 *    não terminou de abrir;
 *  - a conta ainda não foi perguntada NESTE processo. O guard é por `userId`,
 *    não global: trocar de conta sem fechar o app precisa perguntar de novo,
 *    e era justamente o que a flag única de módulo impedia;
 *  - existe um `userId`. Sem ele não há a quem atribuir a resposta.
 *
 * Isto NÃO é a fonte de verdade — é só economia de requisição. Quem garante
 * a exibição única é o backend, com a marca na conta.
 */
export function podeConsultarIntro(params: {
  autenticado: boolean;
  userId: string | null | undefined;
  jaConsultadas: ReadonlySet<string>;
}): boolean {
  const { autenticado, userId, jaConsultadas } = params;
  if (!autenticado || !userId) return false;
  return !jaConsultadas.has(userId);
}

/** Formato do 403 de `checkFeatureAccess` visto pelo cliente HTTP. */
type ErroDeLimite = {
  response?: { status?: number; data?: { error?: string; message?: string } };
};

/**
 * Traduz um erro de requisição em parâmetros do paywall — ou `null` quando o
 * erro não é de limite.
 *
 * Só o par exato (403, `LIMIT_EXCEEDED`) abre a tela. Um 403 de outra origem
 * (conta bloqueada, por exemplo) não é falta de plano e não pode virar oferta
 * de assinatura; um 500 muito menos.
 */
export function paramsDeLimiteExcedido(erro: unknown): PaywallParams | null {
  const dados = (erro as ErroDeLimite | undefined)?.response?.data;
  const status = (erro as ErroDeLimite | undefined)?.response?.status;
  if (status !== 403 || dados?.error !== "LIMIT_EXCEEDED") return null;

  return {
    motivo: MotivoPaywall.FREE_LIMIT_REACHED,
    mensagem:
      dados.message ??
      "Você atingiu o limite do seu plano. Assine para continuar aceitando serviços.",
  };
}
