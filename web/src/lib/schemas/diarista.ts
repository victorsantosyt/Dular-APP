import { z } from "zod";

export const updatePrecosSchema = z.object({
  precoLeve: z.number().int().min(1000).max(500000),
  precoPesada: z.number().int().min(1000).max(800000),
  bio: z.string().max(300).optional(),
});

export const updateBairrosSchema = z.object({
  cidade: z.string().min(2),
  uf: z.string().length(2),
  bairros: z.array(z.string().min(2)).min(1).max(50),
});

export const updateDisponibilidadeSchema = z.object({
  slots: z
    .array(
      z.object({
        diaSemana: z.number().int().min(0).max(6),
        turno: z.enum(["MANHA", "TARDE"]),
        ativo: z.boolean().optional(),
      })
    )
    .min(1)
    .max(28),
});
