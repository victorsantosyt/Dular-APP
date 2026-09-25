/**
 * Sincronização da conversa aberta sem perder evento.
 *
 * Antes, um `new_message` que chegava durante um GET em voo era DESCARTADO. Se
 * esse GET tinha lido o banco antes da mensagem 2, ela só aparecia no próximo
 * evento ou foco — com o canal funcionando não há consulta periódica, então
 * podia não aparecer nunca.
 *
 * Aqui, pedido durante uma busca marca "sincronizar de novo": a busca atual
 * termina, roda UMA busca extra (vários pedidos viram essa mesma), e a
 * promessa de cada pedido só resolve quando a busca que o cobre termina.
 * `parar()` (saída da tela, troca de conversa) aborta a busca e não inicia
 * nenhuma outra; resultados de depois do parar não devem ser aplicados — quem
 * executa confere `signal.aborted`.
 */
export function criarSincronizador(executar: (signal: AbortSignal) => Promise<void>) {
  let rodando = false;
  let deNovo = false;
  let parado = false;
  let controle: AbortController | null = null;
  // Quem pediu antes da busca atual começar espera ela; quem pediu durante
  // espera a busca extra.
  let loteAtual: Array<() => void> = [];
  let proximoLote: Array<() => void> = [];

  async function ciclo(): Promise<void> {
    do {
      deNovo = false;
      const lote = loteAtual;
      controle = new AbortController();
      try {
        await executar(controle.signal);
      } catch {
        // Falha de rede: quem chamou decide (o fallback volta a tentar).
      }
      lote.forEach((r) => r());
      loteAtual = proximoLote;
      proximoLote = [];
    } while (deNovo && !parado);
    // Parado no meio: libera quem ainda esperava.
    loteAtual.forEach((r) => r());
    loteAtual = [];
    rodando = false;
  }

  return {
    sincronizar(): Promise<void> {
      if (parado) return Promise.resolve();
      return new Promise<void>((r) => {
        if (rodando) {
          deNovo = true;
          proximoLote.push(r);
          return;
        }
        rodando = true;
        loteAtual = [r];
        void ciclo();
      });
    },
    parar(): void {
      parado = true;
      deNovo = false;
      controle?.abort();
    },
    get ocupado(): boolean {
      return rodando;
    },
  };
}

type ComId = { id: string; criadaEm: string; status?: string };

/**
 * Aplica a lista do servidor sem apagar o que ainda está só no aparelho: a
 * mensagem otimista ("enviando"/"erro", id `temp-…`) continua visível até o
 * POST responder. Sem duplicar por id e em ordem de criação.
 */
export function mesclarMensagens<M extends ComId>(servidor: readonly M[], locais: readonly M[]): M[] {
  const porId = new Map<string, M>();
  for (const m of servidor) porId.set(m.id, m);
  for (const m of locais) {
    if (m.id.startsWith("temp-") && (m.status === "enviando" || m.status === "erro") && !porId.has(m.id)) {
      porId.set(m.id, m);
    }
  }
  return [...porId.values()].sort((a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime());
}

/** Resposta do POST: troca a otimista pela real sem duplicar se o GET já a trouxe. */
export function confirmarEnvio<M extends ComId>(lista: readonly M[], tempId: string, real: M): M[] {
  const resto = lista.filter((m) => m.id !== tempId && m.id !== real.id);
  return [...resto, real].sort((a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime());
}
