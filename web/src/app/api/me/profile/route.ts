import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/apiResponse";
import { validarCPF } from "@/lib/pixKey";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  cpf: z.string().refine((v) => validarCPF(v), "CPF inválido"),
  dataNascimento: z.string().date("Data inválida"),
  telefone: z
    .string()
    .min(10, "Telefone inválido")
    .max(15, "Telefone inválido"),
  genero: z.enum(["MASCULINO", "FEMININO"]).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Não autorizado", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("bad_request", parsed.error.issues[0].message, 400);
  }

  const { nome, cpf, dataNascimento, telefone, genero } = parsed.data;
  const cpfDigits = cpf.replace(/\D/g, "");
  const telefoneDigits = telefone.replace(/\D/g, "");

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        nome: nome.trim(),
        cpf: cpfDigits,
        dataNascimento: new Date(dataNascimento),
        telefone: telefoneDigits,
        ...(genero ? { genero } : {}),
      },
      select: { id: true, nome: true, role: true },
    });

    return ok({ user });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return fail("conflict", "CPF ou telefone já cadastrado", 409);
    }
    return fail("server_error", "Erro ao salvar", 500);
  }
}
