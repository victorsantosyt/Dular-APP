import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useAoMudarConta } from "@/hooks/useSincronizacaoConta";
import { useAuth } from "@/stores/authStore";
import { apresentacaoDoPlano, type AssinaturaPlano } from "@/components/ui/assinaturaPlano";
export { apresentacaoDoPlano, planoAtualDoCatalogo } from "@/components/ui/assinaturaPlano";

// Compartilha apenas respostas confirmadas da mesma conta: o perfil também
// atualiza quando o paywall está aberto inline, sem um novo evento de foco.
let ordemConsulta = 0;
const assinantes = new Set<(userId: string, data: AssinaturaPlano, ordem: number) => void>();

export function useAssinaturaPlano() {
  const userId = useAuth((state) => state.user?.id ?? null);
  const [resultado, setResultado] = useState<{ userId: string; data: AssinaturaPlano } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const versao = useRef(0);
  const ultimaResposta = useRef(0);
  const conta = useRef(userId);
  conta.current = userId;

  useEffect(() => {
    const receber = (id: string, data: AssinaturaPlano, ordem: number) => {
      if (conta.current !== id || ordem < ultimaResposta.current) return;
      ultimaResposta.current = ordem;
      setResultado({ userId: id, data });
      setErro(false);
    };
    assinantes.add(receber);
    return () => { assinantes.delete(receber); };
  }, []);

  const atualizar = useCallback(async (): Promise<AssinaturaPlano | null> => {
    const consulta = ++versao.current;
    const ordem = ++ordemConsulta;
    if (!userId) { setCarregando(false); setResultado(null); setErro(false); return null; }
    setCarregando(true);
    setErro(false);
    try {
      const res = await api.get<AssinaturaPlano>("/api/me/subscription");
      if (consulta !== versao.current || conta.current !== userId) return null;
      for (const receber of assinantes) receber(userId, res.data, ordem);
      return res.data;
    } catch {
      if (consulta === versao.current && conta.current === userId && ordem >= ultimaResposta.current) {
        setResultado(null);
        setErro(true);
      }
      return null;
    } finally {
      if (consulta === versao.current && conta.current === userId) setCarregando(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void atualizar();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void atualizar();
    });
    return () => {
      ++versao.current;
      listener.remove();
    };
  }, [atualizar]));

  // Assinatura mudou por fora (loja, painel) ou por compra em outra tela: relê.
  useAoMudarConta(() => { void atualizar(); });

  const data = resultado?.userId === userId ? resultado.data : null;
  return { data, apresentacao: apresentacaoDoPlano(data), carregando, erro, atualizar };
}
