import { destinoDaNotificacao, type DadosNotificacao, type DestinoNotificacao } from "@/lib/destinoNotificacao";

/**
 * Toque numa notificação — da lista, do aviso do próprio app ou do push (app
 * aberto, em segundo plano ou iniciado pelo toque). Um caminho só para os
 * três, sem imports de app: os efeitos entram por `deps` e é testado em Node.
 *
 * - Sessão: push de outra conta (`destinatarioId`) não navega nem marca nada.
 *   Se a conta mudar enquanto espera a navegação ficar pronta, desiste.
 * - Leitura: marca só ESTA notificação (quando há id), nunca todas.
 * - Toques repetidos no mesmo aviso dentro de `JANELA_REPETICAO_MS` contam uma vez.
 * - Destino: só pela tabela de `destinoDaNotificacao` (tipo + papel).
 */
export const JANELA_REPETICAO_MS = 1_500;
export const ESPERA_ENTRE_TENTATIVAS_MS = 300;
export const TENTATIVAS_MAXIMAS = 50; // 15 s: cobre a abertura a frio até a pilha do perfil existir

export type ToqueNotificacao = DadosNotificacao & { destinatarioId?: unknown };

export type ResultadoToque = "navegando" | "informativo" | "outra-sessao" | "repetido" | "sem-sessao";

export type DependenciasDoToque = {
  sessao: () => string | null;
  epoca: () => number;
  papel: () => string | null;
  marcarComoLida: (id: string) => void;
  /** A pilha do perfil já tem a rota? (abertura a frio: ainda não.) */
  rotaDisponivel: (rota: DestinoNotificacao[0]) => boolean;
  navegar: (destino: DestinoNotificacao) => void;
  agendar: (fn: () => void, ms: number) => void;
  agora: () => number;
};

export function criarAbridorDeNotificacao(deps: DependenciasDoToque) {
  let ultimo: { chave: string; em: number } | null = null;

  function chaveDo(t: ToqueNotificacao): string {
    return t.id ? `id:${t.id}` : `${t.tipo}:${t.servicoId ?? ""}`;
  }

  function navegarQuandoPronto(destino: DestinoNotificacao, usuario: string, epoca: number, tentativa = 0) {
    if (deps.sessao() !== usuario || deps.epoca() !== epoca) return; // conta trocou: descarta
    if (deps.rotaDisponivel(destino[0])) {
      deps.navegar(destino);
      return;
    }
    if (tentativa >= TENTATIVAS_MAXIMAS) return;
    deps.agendar(() => navegarQuandoPronto(destino, usuario, epoca, tentativa + 1), ESPERA_ENTRE_TENTATIVAS_MS);
  }

  return function abrir(toque: ToqueNotificacao): ResultadoToque {
    const usuario = deps.sessao();
    if (!usuario) return "sem-sessao";
    const destinatario = toque.destinatarioId;
    if (typeof destinatario === "string" && destinatario && destinatario !== usuario) return "outra-sessao";

    const chave = chaveDo(toque);
    const agora = deps.agora();
    if (ultimo && ultimo.chave === chave && agora - ultimo.em < JANELA_REPETICAO_MS) return "repetido";
    ultimo = { chave, em: agora };

    if (toque.id) deps.marcarComoLida(toque.id);

    const destino = destinoDaNotificacao(toque, deps.papel());
    if (!destino) return "informativo";
    navegarQuandoPronto(destino, usuario, deps.epoca());
    return "navegando";
  };
}

type EstadoDeNavegacao = { routeNames?: readonly string[]; routes?: ReadonlyArray<{ state?: EstadoDeNavegacao }> } | undefined;

/** A rota existe em algum navegador montado (raiz ou aninhado)? */
export function rotaNoEstado(estado: EstadoDeNavegacao, rota: string): boolean {
  if (!estado) return false;
  if (estado.routeNames?.includes(rota)) return true;
  return (estado.routes ?? []).some((r) => rotaNoEstado(r.state, rota));
}
