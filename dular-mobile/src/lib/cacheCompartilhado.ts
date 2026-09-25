/**
 * Cache de módulo compartilhado por todas as telas que usam o mesmo dado
 * (lista de conversas, notificações): uma requisição por janela `staleMs`,
 * requisições simultâneas unificadas, e `invalidar()` para quando se SABE que
 * o dado mudou (push de mensagem nova).
 *
 * Isolamento entre sessões: cada busca nasce numa GERAÇÃO. `limpar()` (logout)
 * e a troca da conta autenticada (`chaveSessao`) abrem uma geração nova e
 * abortam a busca em voo. Resultado, erro ou "buscar de novo" de uma geração
 * velha é descartado — a resposta que a conta A pediu nunca entra no cache da
 * conta B, mesmo que o cancelamento de rede não chegue a tempo.
 *
 * `invalidar()` durante uma requisição em voo não a reaproveita — ela pode ter
 * saído antes da mudança. Agenda UMA nova busca para quando ela terminar;
 * várias invalidações nesse intervalo viram essa mesma busca (sem loop).
 */
export type Resultado<T> = { valor: T; erro: string | null };

export function criarCacheCompartilhado<T>(opcoes: {
  buscar: (signal: AbortSignal) => Promise<T>;
  vazio: () => T;
  mensagemDeErro: (err: unknown) => string;
  staleMs: number;
  /** Conta autenticada agora; o cache nunca serve dado de outra chave. */
  chaveSessao?: () => string | null;
  agora?: () => number;
}) {
  const agora = opcoes.agora ?? Date.now;
  const chaveAgora = () => (opcoes.chaveSessao ? opcoes.chaveSessao() : null);

  let geracao = 0;
  let chave: string | null = chaveAgora();
  let valor: T | null = null;
  let erro: string | null = null;
  let em = 0;
  let pendente: { geracao: number; promessa: Promise<Resultado<T>>; controle: AbortController } | null = null;
  let buscarDeNovo = false;
  const assinantes = new Set<() => void>();

  const avisar = () => {
    assinantes.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  };

  /** Abre uma geração nova: nada da anterior pode mais tocar o estado. */
  function novaGeracao() {
    geracao++;
    pendente?.controle.abort();
    pendente = null;
    valor = null;
    erro = null;
    em = 0;
    buscarDeNovo = false;
  }

  /** A conta mudou sem passar por `limpar()`? Trata como troca de sessão. */
  function conferirSessao() {
    const atualChave = chaveAgora();
    if (atualChave !== chave) {
      novaGeracao();
      chave = atualChave;
      avisar();
    }
  }

  function obter(forcar = false): Promise<Resultado<T>> {
    conferirSessao();
    if (pendente && pendente.geracao === geracao) return pendente.promessa;
    if (!forcar && valor !== null && agora() - em < opcoes.staleMs) {
      return Promise.resolve({ valor, erro });
    }

    const minhaGeracao = geracao;
    const controle = new AbortController();
    const promessa = (async (): Promise<Resultado<T>> => {
      try {
        const novo = await opcoes.buscar(controle.signal);
        if (minhaGeracao !== geracao) return { valor: opcoes.vazio(), erro: null };
        valor = novo;
        erro = null;
      } catch (err) {
        if (minhaGeracao !== geracao) return { valor: opcoes.vazio(), erro: null };
        valor = valor ?? opcoes.vazio();
        erro = opcoes.mensagemDeErro(err);
      }
      em = agora();
      return { valor: valor as T, erro };
    })().finally(() => {
      // Geração velha: não mexe na pendência nova, não avisa e não agenda nada.
      if (minhaGeracao !== geracao) return;
      pendente = null;
      avisar();
      if (buscarDeNovo) {
        buscarDeNovo = false;
        void obter(true);
      }
    });
    pendente = { geracao: minhaGeracao, promessa, controle };
    return promessa;
  }

  return {
    obter,
    invalidar(): void {
      conferirSessao();
      if (pendente && pendente.geracao === geracao) {
        buscarDeNovo = true;
        return;
      }
      void obter(true);
    },
    /**
     * Dado buscado DEPOIS desta chamada, da sessão de agora. Uma busca que já
     * estava em voo pode ter lido o servidor antes do evento: espera ela e
     * busca de novo. Devolve `null` se a sessão mudar no meio (logout, troca
     * de conta) — quem chamou não pode mostrar nada.
     */
    async obterAtualizado(): Promise<Resultado<T> | null> {
      conferirSessao();
      const minhaGeracao = geracao;
      if (pendente && pendente.geracao === geracao) {
        await pendente.promessa.catch(() => undefined);
      }
      if (minhaGeracao !== geracao) return null;
      const r = await obter(true);
      if (minhaGeracao !== geracao || chaveAgora() !== chave) return null;
      return r;
    },
    /** Mutação otimista local. */
    alterar(fn: (v: T) => T): void {
      conferirSessao();
      valor = fn(valor ?? opcoes.vazio());
      avisar();
    },
    /** Logout: abre geração nova e aborta a busca da sessão que saiu. */
    limpar(): void {
      novaGeracao();
      chave = chaveAgora();
      avisar();
    },
    atual(): Resultado<T | null> {
      if (chaveAgora() !== chave) return { valor: null, erro: null };
      return { valor, erro };
    },
    assinar(cb: () => void): () => void {
      assinantes.add(cb);
      return () => {
        assinantes.delete(cb);
      };
    },
  };
}
