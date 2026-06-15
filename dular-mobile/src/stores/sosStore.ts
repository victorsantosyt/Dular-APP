import { create } from "zustand";

/**
 * sosStore — guarda o último SOS acionado (dados locais).
 *
 * Etapa 2 (SosFlowScreen) grava aqui no sucesso; Etapa 3 (SafeScoreScreen) lê
 * para o "Acompanhamento de SOS". Em memória por enquanto — quando o backend de
 * SOS/protocolo existir, isto vira fetch real.
 */
export type SosRecord = {
  protocolo: string;
  tipoLabel: string;
  prioridade: string;
  status: "EM_ANALISE";
  criadoEm: string; // ISO
};

type SosState = {
  lastSos: SosRecord | null;
  setLastSos: (record: SosRecord) => void;
};

export const useSosStore = create<SosState>((set) => ({
  lastSos: null,
  setLastSos: (record) => set({ lastSos: record }),
}));
