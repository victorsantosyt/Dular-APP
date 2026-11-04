import { navRef } from "@/navigation/nav";
import { useAuth } from "@/stores/authStore";
import { marcarNotificacaoComoLida } from "@/hooks/useNotificacoes";
import { criarAbridorDeNotificacao, rotaNoEstado, type ToqueNotificacao, type ResultadoToque } from "@/lib/abrirNotificacao";
import { epocaSessao, sessaoAtual } from "@/lib/sessaoAtual";

/** Instância única do app: a mesma proteção contra toque repetido vale para lista, aviso e push. */
const abrir = criarAbridorDeNotificacao({
  sessao: sessaoAtual,
  epoca: epocaSessao,
  papel: () => {
    const { role, user } = useAuth.getState();
    return role ?? user?.role ?? null;
  },
  marcarComoLida: (id) => {
    void marcarNotificacaoComoLida(id);
  },
  rotaDisponivel: (rota) => navRef.isReady() && rotaNoEstado(navRef.getRootState() as never, rota),
  navegar: ([rota, params]) => {
    (navRef.navigate as unknown as (name: string, params?: object) => void)(rota, params);
  },
  agendar: (fn, ms) => {
    setTimeout(fn, ms);
  },
  agora: () => Date.now(),
});

export function abrirNotificacao(toque: ToqueNotificacao): ResultadoToque {
  return abrir(toque);
}
