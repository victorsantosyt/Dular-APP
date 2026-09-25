/**
 * Duração estimada por categoria e intensidade. Tabela de referência aprovada
 * em 25/09/2026; ajustar aqui quando o negócio mudar os valores. `max` em
 * horas alimenta o aviso de conflito de agenda do profissional.
 */
type Faixa = { texto: string; max: number };

const POR_CATEGORIA: Record<string, Faixa> = {
  FAXINA_LEVE: { texto: "De 3h a 4h", max: 4 },
  FAXINA_COMPLETA: { texto: "De 5h a 6h", max: 6 },
  FAXINA_PESADA: { texto: "De 7h a 8h", max: 8 },
  BABA_DIURNA: { texto: "Até 8h", max: 8 },
  BABA_NOTURNA: { texto: "Até 10h", max: 10 },
  BABA_INTEGRAL: { texto: "Até 12h", max: 12 },
  COZINHEIRA_DIARIA: { texto: "De 3h a 4h", max: 4 },
  COZINHEIRA_EVENTO: { texto: "De 6h a 8h", max: 8 },
  PASSA_ROUPA_BASICO: { texto: "De 2h a 3h", max: 3 },
  PASSA_ROUPA_COMPLETO: { texto: "De 4h a 5h", max: 5 },
};

/** Nichos sem intensidade: a duração é do nicho. */
const POR_NICHO: Record<string, Faixa> = {
  lavadeira: { texto: "De 3h a 4h", max: 4 },
  cuidadora: { texto: "Até 8h", max: 8 },
  montador: { texto: "De 1h a 4h (varia com o serviço)", max: 4 },
};

/** Tipo do backend (ServicoTipo) → nicho, para serviços já criados. */
const NICHO_DO_TIPO: Record<string, string> = {
  LAVADEIRA: "lavadeira",
  CUIDADORA: "cuidadora",
  MONTADOR: "montador",
};

function faixa(nicho: string, categoriaBackend?: string | null): Faixa | null {
  if (categoriaBackend?.startsWith("MONTADOR_")) return POR_NICHO.montador;
  if (categoriaBackend && POR_CATEGORIA[categoriaBackend]) return POR_CATEGORIA[categoriaBackend];
  return POR_NICHO[nicho] ?? null;
}

/** `categoria` é a do fluxo ("diarista", "montador"…). */
export function duracaoEstimada(categoria: string, categoriaBackend?: string | null): string | null {
  return faixa(categoria, categoriaBackend)?.texto ?? null;
}

/** Duração máxima em horas de um serviço já criado (tipo + categoria do backend). */
export function duracaoMaximaHoras(tipo: string, categoria?: string | null): number | null {
  return faixa(NICHO_DO_TIPO[tipo] ?? "", categoria)?.max ?? null;
}
