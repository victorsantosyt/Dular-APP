import React, { createContext, ReactNode, useContext, useMemo, useState } from "react";
import type { ServiceFlowTipo } from "@/theme/serviceFlowTheme";

export type ServiceCategory =
  | "baba"
  | "cozinheira"
  | "diarista"
  | "montador"
  | "cuidadora"
  | "passadeira"
  | "lavadeira";

/**
 * Tipo do profissional alvo da contratação. Derivado da categoria escolhida —
 * Babá/Cozinheira/Diarista entram como "DIARISTA" (modelo de serviço doméstico),
 * Montador entra como "MONTADOR".
 *
 * Manter esse tipo separado de `ServiceCategory` permite que telas do flow
 * bifurquem por tipo (chips, observações, copy do botão) sem precisar olhar
 * a categoria específica.
 */
export type TipoProfissional = ServiceFlowTipo;

/** Preços do profissional carregados no fluxo, para montar a tabela de valores
 *  por intensidade. leve/medio/pesada em CENTAVOS; baba/cozinheira em REAIS. */
export type PrecoInfo = {
  leve: number | null;
  medio: number | null;
  pesada: number | null;
  babaHora: number | null;
  cozinheiraBase: number | null;
  valorACombinar: boolean;
  /** Montador: preço por especialidade { [id]: { preco(centavos)|null, aCombinar } }. */
  precosEspecialidades?: Record<string, { preco: number | null; aCombinar: boolean }>;
};

export type ServiceDraft = {
  categoria: ServiceCategory;
  tipo: ServiceFlowTipo;
  tipoProfissional: TipoProfissional;
  /** Quando o flow inicia a partir do perfil público de um profissional,
   *  guardamos o id para envio na confirmação. Opcional. */
  profissionalId?: string;
  profissionalNome?: string;
  /** Serviços que a profissional selecionada oferece (ServicoOferecido[]).
   *  Usado para a tela "Escolha o serviço" listar só o que ela faz. */
  servicosOferecidosProf?: string[];
  /** Preços do profissional para a tabela de valores por intensidade. */
  precoInfo?: PrecoInfo;
  /** Valor escolhido pelo empregador (em REAIS) na tabela de intensidades. */
  valorSelecionado?: number;
  /** Rótulo da intensidade escolhida (ex.: "Limpeza pesada"). */
  intensidadeLabel?: string;
  especialidadeId?: string;
  especialidadeLabel?: string;
  categoriaBackend?: string;
  /** Preços por intensidade da diarista (centavos), vindos do perfil público.
   *  Usados no passo "Escolha a intensidade" para exibir o valor de cada opção. */
  precos?: { leve: number | null; medio: number | null; pesada: number | null };
  /** Rótulo de preço estimado vindo do perfil público do profissional.
   *  Ex.: "a partir de R$ 80,00 (leve)" ou "A combinar". Nunca um número
   *  fixo hardcoded — se ausente, exibe "A combinar". */
  precoEstimadoLabel?: string;
  dataISO: string;
  horario: string;
  /** Endereço do atendimento. cidade/uf/bairro são pré-preenchidos a partir
   *  da localização real salva do Empregador (authUser); rua/numero/complemento
   *  são informados no fluxo. Nunca usar valores fixos. */
  rua: string;
  numero: string;
  complemento: string;
  referencia: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
  chips: string[];
  prioridade: string;
};

type ServiceFlowContextValue = {
  draft: ServiceDraft;
  updateDraft: (patch: Partial<ServiceDraft>) => void;
  resetDraft: () => void;
};

export function tipoProfissionalFromCategoria(
  categoria: ServiceCategory,
): TipoProfissional {
  return categoria === "montador" ? "MONTADOR" : "DIARISTA";
}

const INITIAL_DRAFT: ServiceDraft = {
  categoria: "diarista",
  tipo: "DIARISTA",
  tipoProfissional: "DIARISTA",
  dataISO: "",
  horario: "",
  rua: "",
  numero: "",
  complemento: "",
  referencia: "",
  bairro: "",
  cidade: "",
  uf: "",
  observacoes: "",
  chips: [],
  prioridade: "Horário flexível (recomendado)",
};

export const SERVICE_LABELS: Record<ServiceCategory, string> = {
  baba: "Babá",
  cozinheira: "Cozinheira",
  diarista: "Diarista",
  montador: "Montador",
  cuidadora: "Cuidadora",
  passadeira: "Passadeira",
  lavadeira: "Lavadeira",
};

const ServiceFlowContext = createContext<ServiceFlowContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** Pré-seleção opcional vinda da rota — usada quando o flow é aberto a
   *  partir de um card de categoria ou do perfil público de um profissional. */
  initialCategoria?: ServiceCategory;
  initialTipo?: ServiceFlowTipo;
  initialProfissionalId?: string;
  initialProfissionalNome?: string;
  /** Rótulo de preço já formatado vindo do perfil público — repassado direto
   *  ao draft inicial sem transformação. */
  initialPrecoEstimadoLabel?: string;
  /** Preços por intensidade da diarista (centavos), vindos do perfil público. */
  initialPrecos?: { leve: number | null; medio: number | null; pesada: number | null };
  /** Serviços oferecidos pela profissional (do perfil público). */
  initialServicosOferecidos?: string[];
  /** Preços do profissional (do perfil público) para a tabela de valores. */
  initialPrecoInfo?: PrecoInfo;
};

export function ServiceFlowProvider({
  children,
  initialCategoria,
  initialTipo,
  initialProfissionalId,
  initialProfissionalNome,
  initialPrecoEstimadoLabel,
  initialPrecos,
  initialServicosOferecidos,
  initialPrecoInfo,
}: Props) {
  const [draft, setDraft] = useState<ServiceDraft>(() => {
    if (!initialCategoria && !initialTipo && !initialProfissionalId) return INITIAL_DRAFT;
    const categoria =
      initialProfissionalId && initialCategoria
        ? initialCategoria
        : initialTipo === "MONTADOR"
          ? "montador"
          : INITIAL_DRAFT.categoria;
    const tipo = initialTipo ?? tipoProfissionalFromCategoria(categoria);
    return {
      ...INITIAL_DRAFT,
      categoria,
      tipo,
      tipoProfissional: tipo,
      ...(initialProfissionalId ? { profissionalId: initialProfissionalId } : {}),
      ...(initialProfissionalNome ? { profissionalNome: initialProfissionalNome } : {}),
      ...(initialPrecoEstimadoLabel ? { precoEstimadoLabel: initialPrecoEstimadoLabel } : {}),
      ...(initialPrecos ? { precos: initialPrecos } : {}),
      ...(initialServicosOferecidos?.length ? { servicosOferecidosProf: initialServicosOferecidos } : {}),
      ...(initialPrecoInfo ? { precoInfo: initialPrecoInfo } : {}),
    };
  });

  const value = useMemo<ServiceFlowContextValue>(
    () => ({
      draft,
      updateDraft: (patch) =>
        setDraft((current) => {
          const hasProfissionalId = Object.prototype.hasOwnProperty.call(patch, "profissionalId");
          const hasProfissionalNome = Object.prototype.hasOwnProperty.call(patch, "profissionalNome");
          const next = { ...current, ...patch };
          if (!hasProfissionalId && current.profissionalId) {
            next.profissionalId = current.profissionalId;
          }
          if (!hasProfissionalNome && current.profissionalNome) {
            next.profissionalNome = current.profissionalNome;
          }
          // Sincroniza tipoProfissional com a categoria automaticamente.
          if (patch.categoria && !patch.tipoProfissional) {
            const tipo = tipoProfissionalFromCategoria(patch.categoria);
            next.tipo = tipo;
            next.tipoProfissional = tipo;
            if (tipo === "DIARISTA") {
              if (current.tipo === "MONTADOR" && !hasProfissionalId) {
                next.profissionalId = undefined;
              }
              if (current.tipo === "MONTADOR" && !hasProfissionalNome) {
                next.profissionalNome = undefined;
              }
              next.especialidadeId = undefined;
              next.especialidadeLabel = undefined;
              next.categoriaBackend = undefined;
            }
          }
          if (patch.tipo && !patch.tipoProfissional) {
            next.tipoProfissional = patch.tipo;
            if (patch.tipo === "MONTADOR" && !patch.categoria) {
              next.categoria = "montador";
            }
          }
          if (patch.tipoProfissional && !patch.tipo) {
            next.tipo = patch.tipoProfissional;
          }
          return next;
        }),
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
