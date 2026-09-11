import { auth } from "@/lib/auth-oauth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/apiResponse";
import { requireAuth } from "@/lib/requireAuth";
import { assertContaAtiva, ContaInativaError, codigoDaConta } from "@/lib/contaAtiva";
import { validarCPF } from "@/lib/pixKey";
import { z } from "zod";

/**
 * `nome` e `telefone` são OPCIONAIS: esta rota nasceu para o formulário de
 * onboarding da web, que manda tudo de uma vez, mas o app precisa completar
 * só o que falta (CPF e nascimento) sem reenviar dados que já tem. Exigir os
 * quatro campos obrigava o cliente a reenviar nome/telefone e arriscava
 * sobrescrevê-los com valores desatualizados.
 */
const schema = z.object({
  nome: z.string().min(3, "Nome muito curto").optional(),
  cpf: z.string().refine((v) => validarCPF(v), "CPF inválido").optional(),
  dataNascimento: z.string().date("Data inválida").optional(),
  telefone: z
    .string()
    .min(10, "Telefone inválido")
    .max(15, "Telefone inválido")
    .optional(),
  genero: z.enum(["MASCULINO", "FEMININO"]).optional(),
});

/**
 * Resolve o usuário aceitando as DUAS autenticações da plataforma: o Bearer /
 * cookie `dular_token` do app (via requireAuth) e a sessão NextAuth da web.
 * Antes só havia NextAuth, então o mobile levava 401 e esta rota ficava
 * inalcançável para ele — era por isso que CPF e data de nascimento contavam
 * na completude do perfil sem existir nenhuma tela capaz de preenchê-los.
 */
async function resolverUsuario(req: Request): Promise<string | null> {
  try {
    return requireAuth(req).userId;
  } catch {
    const session = await auth();
    return session?.user?.id ?? null;
  }
}

export async function PATCH(req: Request) {
  const userId = await resolverUsuario(req);
  if (!userId) return fail("unauthorized", "Não autorizado", 401);

  // Esta rota grava nome, CPF, data de nascimento, telefone e gênero — cinco
  // dos seis campos que a exclusão por LGPD anula. Sem esta checagem, uma
  // conta REMOVIDO se desanonimizava sozinha com o token que ainda tinha.
  // A checagem fica DEPOIS de resolverUsuario de propósito: assim vale para as
  // duas autenticações (Bearer do app e sessão NextAuth da web) num ponto só.
  try {
    await assertContaAtiva(userId);
  } catch (e) {
    if (e instanceof ContaInativaError) {
      const { codigo, message } = codigoDaConta(e);
      return fail(codigo, message, 403);
    }
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("bad_request", parsed.error.issues[0].message, 400);
  }

  const { nome, cpf, dataNascimento, telefone, genero } = parsed.data;

  const data: {
    nome?: string;
    cpf?: string;
    dataNascimento?: Date;
    telefone?: string;
    genero?: "MASCULINO" | "FEMININO";
  } = {};
  if (nome !== undefined) data.nome = nome.trim();
  if (cpf !== undefined) data.cpf = cpf.replace(/\D/g, "");
  if (dataNascimento !== undefined) data.dataNascimento = new Date(dataNascimento);
  if (telefone !== undefined) data.telefone = telefone.replace(/\D/g, "");
  if (genero !== undefined) data.genero = genero;

  if (Object.keys(data).length === 0) {
    return fail("bad_request", "Nada para atualizar", 400);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, nome: true, role: true, cpf: true, dataNascimento: true },
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
