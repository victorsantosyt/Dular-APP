export const MONTADOR_ESPECIALIDADES = [
  "montagem",
  "reparos",
  "eletrica",
  "hidraulica",
  "pintura",
  "carpintaria",
] as const;

export type MontadorEspecialidade = (typeof MONTADOR_ESPECIALIDADES)[number];

const LABEL_TO_ID: Record<string, MontadorEspecialidade> = {
  montagem: "montagem",
  "montagem de móveis": "montagem",
  "montagem de moveis": "montagem",
  reparos: "reparos",
  "pequenos reparos": "reparos",
  eletrica: "eletrica",
  "elétrica": "eletrica",
  "instalação elétrica": "eletrica",
  "instalacao eletrica": "eletrica",
  hidraulica: "hidraulica",
  "hidráulica": "hidraulica",
  "instalação hidráulica": "hidraulica",
  "instalacao hidraulica": "hidraulica",
  pintura: "pintura",
  carpintaria: "carpintaria",
};

export const MONTADOR_ESPECIALIDADE_LABELS: Record<MontadorEspecialidade, string> = {
  montagem: "Montagem de móveis",
  reparos: "Pequenos reparos",
  eletrica: "Instalação elétrica",
  hidraulica: "Instalação hidráulica",
  pintura: "Pintura",
  carpintaria: "Carpintaria",
};

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeEspecialidades(values?: unknown[] | null): MontadorEspecialidade[] {
  const result = new Set<MontadorEspecialidade>();
  for (const raw of values ?? []) {
    const normalized = normalizeText(raw);
    const id = LABEL_TO_ID[normalized];
    if (id) result.add(id);
  }
  return Array.from(result);
}

export function cleanStringArray(values?: unknown[] | null, max = 30) {
  const result = new Set<string>();
  for (const raw of values ?? []) {
    const value = String(raw ?? "").trim();
    if (value.length >= 2) result.add(value.slice(0, 80));
    if (result.size >= max) break;
  }
  return Array.from(result);
}

export function calcularCompletudeMontador(input: {
  nome?: string | null;
  bio?: string | null;
  especialidades?: string[] | null;
  cidade?: string | null;
  estado?: string | null;
  bairros?: string[] | null;
  ativo?: boolean | null;
  userStatus?: string | null;
}) {
  const requisitos = {
    nome: Boolean(input.nome?.trim()),
    apresentacao: Boolean(input.bio?.trim()),
    especialidades: (input.especialidades ?? []).length > 0,
    areaAtendimento: Boolean(input.cidade?.trim() && input.estado?.trim() && (input.bairros ?? []).length > 0),
    ativo: input.ativo === true && input.userStatus !== "BLOQUEADO",
  };

  const total = Object.keys(requisitos).length;
  const completos = Object.values(requisitos).filter(Boolean).length;
  return {
    completo: completos === total,
    progresso: Math.round((completos / total) * 100),
    requisitos,
  };
}

