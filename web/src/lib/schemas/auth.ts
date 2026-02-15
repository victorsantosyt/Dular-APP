import { z } from "zod";

export const registerSchema = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10),
  senha: z.string().min(6),
  role: z.enum(["CLIENTE", "DIARISTA"]),
});

export const loginSchema = z.object({
  login: z.string().min(4), // email ou telefone
  senha: z.string().min(6),
});
