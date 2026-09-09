import { z } from "zod";

// Não há `registerSchema`: o cadastro por telefone+senha foi removido.
// O app entra por OAuth (Google/Apple) e a única conta com senha é a de
// ADMIN, criada por outro ADMIN em /api/admin/admins/create.

export const loginSchema = z.object({
  login: z.string().min(4), // email ou telefone
  senha: z.string().min(6),
});
