/**
 * Fallback da conversa aberta: consulta a API em intervalo SÓ enquanto o canal
 * da sala não está de fato operacional.
 *
 * Antes o gate era o estado da CONEXÃO Ably. Conexão "connected" não prova que
 * a sala funciona: o canal pode falhar (ex.: token sem permissão para uma sala
 * criada depois dele) e aí nem evento nem consulta — a conversa congelava.
 */
export type EstadoRealtime = { conexao: string; canal: string; assinado: boolean };

export function canalOperacional(e: EstadoRealtime): boolean {
  return e.conexao === "connected" && e.canal === "attached" && e.assinado;
}

type Agendar = (fn: () => void, ms: number) => unknown;
type Cancelar = (id: unknown) => void;

export function criarFallback(opcoes: {
  intervaloMs: number;
  buscar: () => void;
  agendar?: Agendar;
  cancelar?: Cancelar;
}) {
  const agendar: Agendar = opcoes.agendar ?? ((fn, ms) => setInterval(fn, ms));
  const cancelar: Cancelar = opcoes.cancelar ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>));
  let id: unknown = null;
  let parado = false;

  return {
    /**
     * Informa se o canal está operacional. Liga o intervalo (uma vez só) quando
     * não está e desliga quando volta. Em toda TRANSIÇÃO faz uma busca na hora:
     * ao cair, para não esperar o primeiro tick; ao voltar, para recuperar o que
     * chegou no intervalo em que o canal esteve fora.
     */
    atualizar(operacional: boolean): void {
      if (parado) return;
      if (operacional) {
        if (id !== null) {
          cancelar(id);
          id = null;
          opcoes.buscar();
        }
        return;
      }
      if (id === null) {
        id = agendar(() => {
          if (!parado) opcoes.buscar();
        }, opcoes.intervaloMs);
        opcoes.buscar();
      }
    },
    parar(): void {
      parado = true;
      if (id !== null) {
        cancelar(id);
        id = null;
      }
    },
    get consultando(): boolean {
      return id !== null;
    },
  };
}
