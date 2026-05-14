import type { AppIconName } from "@/components/ui";

export type MontadorEspecialidadeId =
  | "montagem"
  | "reparos"
  | "eletrica"
  | "hidraulica"
  | "pintura"
  | "carpintaria";

export type MontadorEspecialidade = {
  id: MontadorEspecialidadeId;
  label: string;
  icon: AppIconName;
  categoriaBackend: string;
};

export const MONTADOR_ESPECIALIDADES: MontadorEspecialidade[] = [
  { id: "montagem", label: "Montagem de móveis", icon: "Package", categoriaBackend: "MONTADOR_MONTAGEM" },
  { id: "reparos", label: "Pequenos reparos", icon: "Wrench", categoriaBackend: "MONTADOR_REPAROS" },
  { id: "eletrica", label: "Instalação elétrica", icon: "Zap", categoriaBackend: "MONTADOR_ELETRICA" },
  { id: "hidraulica", label: "Instalação hidráulica", icon: "Droplets", categoriaBackend: "MONTADOR_HIDRAULICA" },
  { id: "pintura", label: "Pintura", icon: "Paintbrush", categoriaBackend: "MONTADOR_PINTURA" },
  { id: "carpintaria", label: "Carpintaria", icon: "Hammer", categoriaBackend: "MONTADOR_CARPINTARIA" },
];

export function getMontadorEspecialidadeById(id?: string | null) {
  return MONTADOR_ESPECIALIDADES.find((item) => item.id === id) ?? null;
}
