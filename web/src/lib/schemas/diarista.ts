import { z } from "zod";
import { ufCanonica } from "@/lib/localizacaoBrasil";

export const updatePrecosSchema = z.object({
  precoLeve: z.number().int().min(1000).max(500000),
  precoMedio: z.number().int().min(1000).max(650000).optional(),
  precoPesada: z.number().int().min(1000).max(800000),
  bio: z.string().max(300).optional(),
});

export const updateBairrosSchema = z.object({
  cidade: z.string().min(2),
  // UF canônica de duas letras (sigla ou nome completo exato); inválida é recusada.
  uf: z.string().transform((v, ctx) => {
    const uf = ufCanonica(v);
    if (!uf) {
      ctx.addIssue({ code: "custom", message: "UF inválida." });
      return z.NEVER;
    }
    return uf;
  }),
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
