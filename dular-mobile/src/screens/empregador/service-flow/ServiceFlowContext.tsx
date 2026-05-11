import React, { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type ServiceCategory = "baba" | "cozinheira" | "diarista" | "montador";

export type ServiceDraft = {
  categoria: ServiceCategory;
  dataISO: string;
  horario: string;
  numero: string;
  complemento: string;
  referencia: string;
  observacoes: string;
  chips: string[];
  prioridade: string;
};

type ServiceFlowContextValue = {
  draft: ServiceDraft;
  updateDraft: (patch: Partial<ServiceDraft>) => void;
  resetDraft: () => void;
};

const INITIAL_DRAFT: ServiceDraft = {
  categoria: "montador",
  dataISO: "",
  horario: "",
  numero: "",
  complemento: "",
  referencia: "",
  observacoes: "",
  chips: [],
  prioridade: "Horário flexível (recomendado)",
};

export const SERVICE_LABELS: Record<ServiceCategory, string> = {
  baba: "Babá",
  cozinheira: "Cozinheira",
  diarista: "Diarista",
  montador: "Montador",
};

const ServiceFlowContext = createContext<ServiceFlowContextValue | null>(null);

type Props = {
  children: ReactNode;
};

export function ServiceFlowProvider({ children }: Props) {
  const [draft, setDraft] = useState<ServiceDraft>(INITIAL_DRAFT);

  const value = useMemo<ServiceFlowContextValue>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
      resetDraft: () => setDraft(INITIAL_DRAFT),
    }),
    [draft],
  );

  return <ServiceFlowContext.Provider value={value}>{children}</ServiceFlowContext.Provider>;
}

export function useServiceFlow() {
  const context = useContext(ServiceFlowContext);
  if (!context) {
    throw new Error("useServiceFlow must be used inside ServiceFlowProvider");
  }
  return context;
}
