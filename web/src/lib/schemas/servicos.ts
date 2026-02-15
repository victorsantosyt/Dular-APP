import { z } from "zod";

export const criarServicoSchema = z.object({
  tipo: z.enum(["FAXINA", "BABA", "COZINHEIRA", "PASSA_ROUPA"]),
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
    ])
    .optional(),
  dataISO: z.string().min(10), // "2026-01-08" ou ISO completo
  turno: z.enum(["MANHA", "TARDE"]),
  cidade: z.string().min(2),
  uf: z.string().length(2),
  bairro: z.string().min(2),
  diaristaUserId: z.string().min(8), // userId do diarista escolhido
  // endereço completo só depois do aceite (pode enviar já, mas armazenamos só após ACEITO)
  enderecoCompleto: z.string().min(5).optional(),
  observacoes: z.string().max(1000).optional(),
  temPet: z.boolean().optional(),
  quartos3Mais: z.boolean().optional(),
  banheiros2Mais: z.boolean().optional(),
});

export const cancelarServicoSchema = z.object({
  motivo: z.string().min(3).max(300).optional(),
});

export const avaliarServicoSchema = z.object({
  notaGeral: z.number().int().min(1).max(5),
  pontualidade: z.number().int().min(1).max(5),
  qualidade: z.number().int().min(1).max(5),
  comunicacao: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
});
