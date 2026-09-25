/**
 * Ciclo de vida do token de push deste aparelho na conta autenticada:
 * registro, reconciliação e desassociação COORDENADOS (fases 1 e 1C).
 *
 * Registro:
 * - só com sessão, uma tentativa por vez;
 * - falhou → até 3 novas tentativas espaçadas (5 s, 30 s, 2 min), sem loop;
 * - conta mudou durante o POST → registra de novo para a conta atual.
 *
 * Reconciliação: SÓ quando o app volta ao primeiro plano (evento de AppState
 * "active"): se o último registro bem-sucedido tem mais de 10 min, reenvia o
 * POST (idempotente no servidor) e corrige um POST antigo de outra conta que o
 * servidor tenha processado fora de ordem. Antes disso, "já registrado" — sem
 * pedido. NÃO é periódica: com o app aberto o tempo todo, sem ir para segundo
 * plano, nada é reconciliado até o próximo retorno.
 *
 * Desassociação (logout): para as novas tentativas, espera o POST em voo
 * terminar por até METADE do prazo (2,5 s no padrão) e então manda o DELETE.
 * Se o POST terminar nesse intervalo, ele não reassocia o token depois do
 * DELETE. Se demorar mais, o DELETE vai antes, e um POST processado depois
 * pelo servidor reassocia o token à conta que saiu. Todo o processo tem prazo:
 * o logout local nunca espera a rede.
 *
 * Limites conhecidos, que só o gerenciamento de dispositivos resolve:
 * - POST além de 2,5 s processado pelo servidor depois do DELETE;
 * - POST que estourou o prazo no app e o servidor processou depois do
 *   registro da conta nova (corrigido só no próximo retorno após 10 min);
 * - logout sem rede: o servidor não fica sabendo; o próximo login move o token.
 * Com o conteúdo neutro do push (fase 1A), o que resta exposto é metadado:
 * existência do aviso, categoria e contador.
 *
 * Sem imports de app: dependências injetadas, testado em Node.
 */
export type ResultadoRegistro = "registrado" | "ja-registrado" | "sem-sessao" | "sem-token" | "falhou" | "em-andamento";
/**
 * `removido`: o servidor CONFIRMOU o DELETE. Não garante que o token siga
 * desassociado — um POST em voo além da espera pode ser processado depois
 * (ver o topo deste arquivo). `falhou`: sem confirmação dentro do prazo.
 */
export type ResultadoSaida = "removido" | "sem-token" | "falhou";

export const ESPERAS_MS = [5_000, 30_000, 120_000] as const;
export const RECONCILIAR_MS = 10 * 60_000;
export const PRAZO_SAIDA_MS = 5_000;

export function criarRegistroPush(deps: {
  obterToken: () => Promise<string | null>;
  enviar: (token: string) => Promise<unknown>;
  usuario: () => string | null;
  aoObterToken?: (token: string) => void;
  agendar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
}) {
  const agendar = deps.agendar ?? ((fn, ms) => setTimeout(fn, ms));
  const cancelar = deps.cancelar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const agora = deps.agora ?? Date.now;
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let registrado: { usuario: string; token: string; em: number } | null = null;
  let ultimoToken: string | null = null;
  let emAndamento: Promise<ResultadoRegistro> | null = null;
  let saida: Promise<ResultadoSaida> | null = null;
  let saindo = false;
  let tentativa = 0;
  let timer: unknown = null;

  function limparTimer() {
    if (timer !== null) {
      cancelar(timer);
      timer = null;
    }
  }

  /** `promessa` ou o prazo, o que vier primeiro. `true` se a promessa terminou. */
  async function noPrazo(promessa: Promise<unknown>, ms: number): Promise<boolean> {
    let terminou = false;
    await Promise.race([promessa.then(() => (terminou = true), () => (terminou = true)), esperar(ms)]);
    return terminou;
  }

  async function executar(usuario: string, forcar: boolean): Promise<ResultadoRegistro> {
    try {
      const token = await deps.obterToken();
      if (!token) return "sem-token";
      ultimoToken = token;
      deps.aoObterToken?.(token);
      if (!forcar && registrado?.usuario === usuario && registrado.token === token) return "ja-registrado";
      await deps.enviar(token);
      registrado = { usuario, token, em: agora() };
      return "registrado";
    } catch {
      return "falhou";
    }
  }

  async function tentar(forcar = false): Promise<ResultadoRegistro> {
    // Nada de registro com uma saída em curso: primeiro o DELETE termina.
    if (saida) await saida;
    const usuario = deps.usuario();
    if (!usuario || saindo) return "sem-sessao";
    if (emAndamento) return "em-andamento";

    emAndamento = executar(usuario, forcar);
    let resultado: ResultadoRegistro;
    try {
      resultado = await emAndamento;
    } finally {
      emAndamento = null;
    }

    // Logout começou durante o POST: nada deste registro vale mais.
    if (saindo) {
      registrado = null;
      return resultado;
    }
    // A conta mudou durante o POST: o token pode ter ido para a anterior.
    if (deps.usuario() !== usuario) {
      registrado = null;
      tentativa = 0;
      limparTimer();
      return deps.usuario() ? tentar(true) : resultado;
    }

    if (resultado === "falhou") {
      if (tentativa < ESPERAS_MS.length && timer === null) {
        const espera = ESPERAS_MS[tentativa++];
        timer = agendar(() => {
          timer = null;
          void tentar();
        }, espera);
      }
    } else {
      tentativa = 0;
      limparTimer();
    }
    return resultado;
  }

  return {
    /** Sessão começou (gate montou): registra mesmo que já tenha registrado antes. */
    iniciarSessao(): Promise<ResultadoRegistro> {
      saindo = false;
      registrado = null;
      tentativa = 0;
      limparTimer();
      return tentar(true);
    },
    /**
     * App voltou ao primeiro plano. Registro recente da mesma conta → nada a
     * fazer, sem pedido nenhum. Mais antigo que `RECONCILIAR_MS` (ou ausente)
     * → reenvia e reconcilia.
     */
    garantir(): Promise<ResultadoRegistro> {
      const usuario = deps.usuario();
      if (usuario && registrado?.usuario === usuario && agora() - registrado.em < RECONCILIAR_MS) {
        return Promise.resolve("ja-registrado");
      }
      tentativa = 0;
      limparTimer();
      return tentar(true);
    },
    /** Token do aparelho mudou: registra o novo. */
    tokenMudou(): Promise<ResultadoRegistro> {
      registrado = null;
      tentativa = 0;
      limparTimer();
      return tentar(true);
    },
    /**
     * Logout: desassocia o token deste aparelho da conta que sai. Coordenado
     * com o registro e sempre dentro de `prazoMs` — o logout local nunca fica
     * preso na rede. Chamadas repetidas durante a saída reaproveitam a mesma.
     */
    desassociar(remover: (token: string) => Promise<unknown>, prazoMs = PRAZO_SAIDA_MS): Promise<ResultadoSaida> {
      if (saida) return saida;
      saindo = true;
      tentativa = 0;
      limparTimer();
      const inicio = agora();
      saida = (async (): Promise<ResultadoSaida> => {
        if (emAndamento) await noPrazo(emAndamento, prazoMs / 2);
        const token = registrado?.token ?? ultimoToken;
        registrado = null;
        if (!token) return "sem-token";
        const restante = Math.max(0, prazoMs - (agora() - inicio));
        let ok = false;
        const pedido = remover(token).then(() => (ok = true));
        const terminou = await noPrazo(pedido, restante);
        return terminou && ok ? "removido" : "falhou";
      })().finally(() => {
        saida = null;
      });
      return saida;
    },
    /** Gate desmontou: a próxima sessão registra do zero. */
    esquecer(): void {
      registrado = null;
      tentativa = 0;
      limparTimer();
    },
  };
}
