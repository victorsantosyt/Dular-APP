/**
 * Duração estimada por categoria e intensidade. Tabela de referência aprovada
 * em 25/09/2026; ajustar aqui quando o negócio mudar os valores.
 */
const POR_CATEGORIA: Record<string, string> = {
  FAXINA_LEVE: "De 3h a 4h",
  FAXINA_COMPLETA: "De 5h a 6h",
  FAXINA_PESADA: "De 7h a 8h",
  BABA_DIURNA: "Até 8h",
  BABA_NOTURNA: "Até 10h",
  BABA_INTEGRAL: "Até 12h",
  COZINHEIRA_DIARIA: "De 3h a 4h",
  COZINHEIRA_EVENTO: "De 6h a 8h",
  PASSA_ROUPA_BASICO: "De 2h a 3h",
  PASSA_ROUPA_COMPLETO: "De 4h a 5h",
};

/** Nichos sem intensidade: a duração é do nicho. */
const POR_NICHO: Record<string, string> = {
  lavadeira: "De 3h a 4h",
  cuidadora: "Até 8h",
  montador: "De 1h a 4h (varia com o serviço)",
};

export function duracaoEstimada(categoria: string, categoriaBackend?: string | null): string | null {
  if (categoriaBackend?.startsWith("MONTADOR_")) return POR_NICHO.montador;
  if (categoriaBackend && POR_CATEGORIA[categoriaBackend]) return POR_CATEGORIA[categoriaBackend];
  return POR_NICHO[categoria] ?? null;
}
