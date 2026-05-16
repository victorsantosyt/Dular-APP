import { z } from "zod";

export const criarServicoSchema = z.object({
  tipo: z.enum(["FAXINA", "BABA", "COZINHEIRA", "PASSA_ROUPA", "MONTADOR"]),
  categoria: z
    .enum([
      "FAXINA_LEVE",
      "FAXINA_PESADA",
      "FAXINA_COMPLETA",
      "BABA_DIURNA",
      "BABA_NOTURNA",
      "BABA_INTEGRAL",
      "COZINHEIRA_DIARIA",
      "COZINHEIRA_EVENTO",
      "PASSA_ROUPA_BASICO",
      "PASSA_ROUPA_COMPLETO",
      "MONTADOR_MONTAGEM",
      "MONTADOR_REPAROS",
      "MONTADOR_ELETRICA",
      "MONTADOR_HIDRAULICA",
      "MONTADOR_PINTURA",
      "MONTADOR_CARPINTARIA",
    ])
    .optional(),
  dataISO: z.string().min(10), // "2026-01-08" ou ISO completo
  turno: z.enum(["MANHA", "TARDE"]),
  cidade: z.string().min(2),
  uf: z.string().length(2),
  bairro: z.string().min(2),
  // userId do profissional. Para tipo DIARISTA usar diaristaUserId; para
  // tipo MONTADOR aceita-se também montadorUserId (alias preferido). Pelo
  // menos um dos dois precisa estar presente — validado no endpoint.
  diaristaUserId: z.string().min(8).optional(),
  montadorUserId: z.string().min(8).optional(),
  // endereço completo só depois do aceite (pode enviar já, mas armazenamos só após ACEITO)
  enderecoCompleto: z.string().min(5).optional(),
  observacoes: z.string().max(1000).optional(),
  temPet: z.boolean().optional(),
  quartos3Mais: z.boolean().optional(),
  banheiros2Mais: z.boolean().optional(),
});

/**
 * Motivos canônicos para cancelar/recusar. Mantemos como string + lista
 * suggesta para não forçar migração (e permitir compat com mobile antigo
 * que envia frase livre). O orquestrador depende dessas tags para emitir
 * SafetyEvent / SafeScoreEvent quando o motivo é grave.
 */
export const MOTIVOS_CANCELAMENTO = [
  "indisponibilidade",
  "endereco_incompativel",
  "comportamento_inadequado",
  "problema_seguranca",
  "outro",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number];

export const MOTIVOS_GRAVES: ReadonlyArray<MotivoCancelamento> = [
  "comportamento_inadequado",
  "problema_seguranca",
];

export const cancelarServicoSchema = z.object({
  motivo: z.string().trim().min(3).max(300),
  observacao: z.string().trim().max(500).optional(),
});

export const recusarServicoSchema = z.object({
  motivo: z.string().trim().min(3).max(300),
  observacao: z.string().trim().max(500).optional(),
});

export const avaliarServicoSchema = z.object({
  notaGeral: z.number().int().min(1).max(5),
  pontualidade: z.number().int().min(1).max(5),
  qualidade: z.number().int().min(1).max(5),
  comunicacao: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
});
