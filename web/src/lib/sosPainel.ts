import type { SafetyEventStatus } from "@prisma/client";
import type { Tone } from "@/design-system/ui";

/**
 * Regras de exibição do SOS no painel admin, compartilhadas pela página de
 * SOS, pela fila de risco e pela rota que muda o status.
 */

/** Status de SOS na ordem do atendimento. */
export const SOS_STATUS: readonly SafetyEventStatus[] = ["ACIONADO", "EM_ATENDIMENTO", "RESOLVIDO"];

export const SOS_STATUS_ROTULO: Record<SafetyEventStatus, string> = {
  ACIONADO: "Acionado",
  EM_ATENDIMENTO: "Em atendimento",
  RESOLVIDO: "Resolvido",
};

export const SOS_STATUS_TOM: Record<SafetyEventStatus, Tone> = {
  ACIONADO: "critical",
  EM_ATENDIMENTO: "high",
  RESOLVIDO: "success",
};

/** SOS gravado antes da coluna `status` existir tem status nulo: conta como ACIONADO. */
export function statusDoSos(status: SafetyEventStatus | null | undefined): SafetyEventStatus {
  return status ?? "ACIONADO";
}

/** Texto de uma chave do `meta` (Json livre) do SafetyEvent, ou null. */
export function textoDoMeta(meta: unknown, chave: string): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const valor = (meta as Record<string, unknown>)[chave];
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Link de mapa para a coordenada do SOS, ou null quando não há coordenada. */
export function linkDoMapa(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * De onde veio o SOS_SILENT. `registrarMotivoGrave` (lib/safetyMotivo.ts)
 * sempre grava `meta.motivo`; o botão de SOS nunca grava.
 */
export type OrigemDoSos = "BOTAO" | "MOTIVO_GRAVE";

export function origemDoSos(meta: unknown): OrigemDoSos {
  return textoDoMeta(meta, "motivo") ? "MOTIVO_GRAVE" : "BOTAO";
}

/** Na fila de risco, só o SOS do botão é CRITICA; motivo grave é ALTA. */
export function prioridadeNaFila(meta: unknown): "CRITICA" | "ALTA" {
  return origemDoSos(meta) === "MOTIVO_GRAVE" ? "ALTA" : "CRITICA";
}

const ROTULO_DO_MOTIVO: Record<string, string> = {
  problema_seguranca: "Problema de segurança",
  comportamento_inadequado: "Comportamento inadequado",
};

const ROTULO_DA_ACAO: Record<string, string> = {
  CANCELADO: "ao cancelar",
  RECUSADO: "ao recusar",
};

/** Motivo grave legível (ex.: "Problema de segurança"), ou null se o SOS não for motivo grave. */
export function motivoGraveLegivel(meta: unknown): string | null {
  const motivo = textoDoMeta(meta, "motivo");
  return motivo ? (ROTULO_DO_MOTIVO[motivo] ?? motivo) : null;
}

/** Linha do selo "Motivo grave": motivo e ação (ex.: "Problema de segurança · ao cancelar"). */
export function descricaoDoMotivoGrave(meta: unknown): string | null {
  const motivo = motivoGraveLegivel(meta);
  if (!motivo) return null;
  const acao = ROTULO_DA_ACAO[textoDoMeta(meta, "acao") ?? ""];
  return acao ? `${motivo} · ${acao}` : motivo;
}
