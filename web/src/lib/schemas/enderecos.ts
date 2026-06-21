import { z } from "zod";

// TipoEndereco SEM acento (espelha o enum do Prisma).
export const enderecoSchema = z.object({
  tipo: z.enum(["RESIDENCIAL", "EMPRESARIAL"]),
  cep: z.string().trim().min(8).max(9),
  rua: z.string().trim().min(1).max(200),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(120).nullable().optional(),
  bairro: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  uf: z.string().trim().length(2),
  pontoReferencia: z.string().trim().max(200).nullable().optional(),
});

export type EnderecoInput = z.infer<typeof enderecoSchema>;
