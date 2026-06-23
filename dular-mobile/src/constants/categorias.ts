import type { AppIconName } from "@/components/ui";
import type { ServicoOferecido } from "@/types/diarista";

/**
 * categorias.ts — FONTE ÚNICA de categorias de serviço do app (mobile).
 *
 * Toda tela que lista/usa categorias (Home e Buscar do empregador, "Ver todos",
 * "O que você oferece" da diarista, mapeamento categoria→tipo) deve consumir
 * esta estrutura — nada de listas hardcoded duplicadas.
 *
 * Contrato com o backend:
 *  - `tipo`   = enum ServicoTipo (Prisma).
 *  - `oferta` = valor de DiaristaProfile.servicosOferecidos (String[]); null p/ montador.
 */

export type CategoriaKey =
  | "diarista"
  | "baba"
  | "cuidadora"
  | "cozinheira"
  | "passadeira"
  | "lavadeira"
  | "montador";

export type ServicoTipoEnum =
  | "FAXINA"
  | "BABA"
  | "CUIDADORA"
  | "COZINHEIRA"
  | "PASSA_ROUPA"
  | "LAVADEIRA"
  | "MONTADOR";

export type Categoria = {
  key: CategoriaKey;
  tipo: ServicoTipoEnum;
  /** Nicho gravado em servicosOferecidos (null = montador, perfil separado). */
  oferta: ServicoOferecido | null;
  label: string;
  subtitle: string;
  icon: AppIconName;
  /** Cor de fundo do card de categoria (busca do empregador). */
  bg: string;
  /** Cor do ícone do card. */
  fg: string;
  /** Qual perfil profissional atende a categoria. */
  profissional: "diarista" | "montador";
};

export const CATEGORIAS: Categoria[] = [
  { key: "diarista",   tipo: "FAXINA",      oferta: "DIARISTA",   label: "Diarista",   subtitle: "Limpeza e organização",   icon: "BrushCleaning",   bg: "#FFF1F5", fg: "#F7658B", profissional: "diarista" },
  { key: "baba",       tipo: "BABA",        oferta: "BABA",       label: "Babá",       subtitle: "Cuidados com crianças",    icon: "Baby",           bg: "#F2ECFF", fg: "#7B5CFA", profissional: "diarista" },
  { key: "cuidadora",  tipo: "CUIDADORA",   oferta: "CUIDADORA",  label: "Cuidadora",  subtitle: "Cuidados a idosos/pessoas", icon: "Heart",          bg: "#EAF7EF", fg: "#2BA15F", profissional: "diarista" },
  { key: "cozinheira", tipo: "COZINHEIRA",  oferta: "COZINHEIRA", label: "Cozinheira", subtitle: "Preparo de refeições",     icon: "ChefHat",        bg: "#FFF0E2", fg: "#F47A1F", profissional: "diarista" },
  { key: "passadeira", tipo: "PASSA_ROUPA", oferta: "PASSADEIRA", label: "Passadeira", subtitle: "Passar roupa",             icon: "Shirt",          bg: "#EAF0FF", fg: "#5566E0", profissional: "diarista" },
  { key: "lavadeira",  tipo: "LAVADEIRA",   oferta: "LAVADEIRA",  label: "Lavadeira",  subtitle: "Lavar roupa",              icon: "WashingMachine", bg: "#E6F7F8", fg: "#1AA6B7", profissional: "diarista" },
  { key: "montador",   tipo: "MONTADOR",    oferta: null,         label: "Montador",   subtitle: "Montagem e reparos",       icon: "Wrench",         bg: "#E3F4EF", fg: "#2E6E61", profissional: "montador" },
];

/** Categorias atendidas pelo perfil da profissional de casa (diarista). */
export const CATEGORIAS_DIARISTA = CATEGORIAS.filter((c) => c.profissional === "diarista");

export const CATEGORIA_BY_KEY: Record<CategoriaKey, Categoria> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.key, c]),
) as Record<CategoriaKey, Categoria>;

/** key (UI) → tipo (enum backend). */
export const CATEGORIA_TO_TIPO: Record<CategoriaKey, ServicoTipoEnum> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.key, c.tipo]),
) as Record<CategoriaKey, ServicoTipoEnum>;

/** Opções de "O que você oferece" da diarista (id = valor em servicosOferecidos). */
export const OFERTAS_DIARISTA = CATEGORIAS_DIARISTA.map((c) => ({
  id: c.oferta as ServicoOferecido,
  title: c.label,
  subtitle: c.subtitle,
  icon: c.icon,
}));
