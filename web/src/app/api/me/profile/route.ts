import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/apiResponse";
import { z } from "zod";

function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (mod: number) => {
    let sum = 0;
    for (let i = 0; i < mod - 1; i++) {
      sum += Number(digits[i]) * (mod - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  return calc(10) === Number(digits[9]) && calc(11) === Number(digits[10]);
}

const schema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  cpf: z.string().refine((v) => validarCPF(v), "CPF inválido"),
  dataNascimento: z.string().date("Data inválida"),
  telefone: z
    .string()
    .min(10, "Telefone inválido")
    .max(15, "Telefone inválido"),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Não autorizado", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("bad_request", parsed.error.issues[0].message, 400);
  }

  const { nome, cpf, dataNascimento, telefone } = parsed.data;
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
