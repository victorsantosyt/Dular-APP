import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";
import { invalidarNotificacoes } from "@/hooks/useNotificacoes";
import { criarMotorDeSincronizacao, useSincronizacao, type Assunto, type RespostaSincronizacao } from "@/lib/sincronizacaoConta";

function contaPronta(): string | null {
  const s = useAuth.getState();
  return s.bootstrapStatus === "authenticated" ? s.user?.id ?? null : null;
}

/**
 * Montado UMA vez na raiz do app. Mantém a conta em sincronia com o backend
 * enquanto há sessão pronta e o app está em primeiro plano (regras e prazos em
 * lib/sincronizacaoConta). Quando a versão muda, relê a conta canônica
 * (/api/me), que alimenta Home, avisos e selo; as telas abertas relêem os
 * próprios dados pela `revisao` (useAoMudarConta).
 */
export function useSincronizacaoConta(): void {
  const userId = useAuth((s) => (s.bootstrapStatus === "authenticated" ? s.user?.id ?? null : null));
  const pedido = useSincronizacao((s) => s.pedido);
  const motor = useRef<ReturnType<typeof criarMotorDeSincronizacao> | null>(null);

  if (!motor.current) {
    motor.current = criarMotorDeSincronizacao({
      contaAtual: contaPronta,
      appAtivo: () => AppState.currentState === "active",
      consultar: async () => (await api.get<RespostaSincronizacao>("/api/me/sincronizacao")).data ?? {},
      aoMudar: async (conta) => {
        const me = await api.get<{ user?: { id?: string } }>("/api/me");
        const novo = me.data?.user;
        // setUser já recusa conta diferente da sessão; aqui ainda conferimos a origem.
        if (novo?.id === conta && contaPronta() === conta) {
          useAuth.getState().setUser((prev) => (prev && prev.id === conta ? ({ ...prev, ...novo } as typeof prev) : prev));
        }
      },
      agora: () => Date.now(),
      agendar: (fn, ms) => setTimeout(fn, ms),
      cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    });
  }

  // Contador de avisos (sino, badge): um único refetch do cache compartilhado,
  // não um por tela montada.
  useAoMudarConta(["avisos"], invalidarNotificacoes);

  // Troca de conta ou logout: zera a sincronização e o que estava agendado.
  useEffect(() => { motor.current?.iniciar(userId); }, [userId]);

  // Pedido explícito (notificação, ação local): consulta já.
  useEffect(() => { if (pedido > 0) void motor.current?.pedir(); }, [pedido]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void motor.current?.aoPrimeiroPlano();
      else motor.current?.aoSegundoPlano();
    });
    return () => { sub.remove(); motor.current?.parar(); };
  }, []);
}

/**
 * Para telas: roda `recarregar` quando muda, por fora ou por ação local em
 * outra tela, algum dos `assuntos` que a tela mostra — e só eles.
 */
export function useAoMudarConta(assuntos: readonly Assunto[], recarregar: () => void): void {
  const chave = assuntos.join(",");
  const revisao = useSincronizacao((s) => assuntos.reduce((soma, a) => soma + (s.revisoes[a] ?? 0), 0));
  const ultima = useRef(revisao);
  const fn = useRef(recarregar);
  fn.current = recarregar;
  useEffect(() => {
    if (revisao === ultima.current) return;
    ultima.current = revisao;
    fn.current();
  }, [revisao, chave]);
}
