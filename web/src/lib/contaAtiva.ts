import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import type { JwtPayload } from "@/lib/auth";

/**
 * Sessão que também confirma que a conta segue ativa.
 *
 * Por que existe: o JWT carrega apenas `{ userId, role }` e vale 7 dias. Nada
 * dentro dele diz se a conta foi bloqueada ou excluída depois da emissão, e
 * `requireAuth` só confere assinatura e validade do token. O resultado,
 * medido contra build de produção antes desta correção:
 *
 *   - conta BLOQUEADA lia a conversa do chat e ENVIOU mensagem (201, gravada);
 *   - conta REMOVIDA (anonimizada por LGPD) repovoou nome, telefone, CPF,
 *     e-mail, data de nascimento e gênero — os seis campos que a exclusão
 *     tinha anulado.
 *
 * O `DELETE /api/me` limpa o cookie e o app descarta o token guardado, mas
 * nada disso invalida um token já emitido: quem o tiver em mãos continua
 * dentro por até 7 dias. Revogar exige perguntar ao banco, e é o que esta
 * função faz.
 *
 * Por que não mexer em `requireAuth`: ele é síncrono e chamado sem `await` em
 * 67 arquivos. Torná-lo assíncrono devolveria uma Promise — que é truthy —
 * e `auth.role` viraria `undefined` em todos eles, sem erro de compilação e
 * sem falha visível. Esta função nasce ao lado, e as rotas migram uma a uma.
 */

export type StatusInativo = "BLOQUEADO" | "REMOVIDO" | "DESCONHECIDO";

export class ContaInativaError extends Error {
  readonly statusDaConta: StatusInativo;

  constructor(statusDaConta: StatusInativo) {
    super(`ContaInativa:${statusDaConta}`);
    this.name = "ContaInativaError";
    this.statusDaConta = statusDaConta;
  }
}

/**
 * Valida o token E confirma no banco que a conta está ATIVA.
 *
 * Lança `Unauthorized` (token inválido/ausente) ou `ContaInativaError`.
 * Use `respostaDeSessao` no catch para traduzir os dois em resposta HTTP.
 */
export async function requireAuthAtivo(req: Request): Promise<JwtPayload> {
  const auth = requireAuth(req);
  await assertContaAtiva(auth.userId);
  return auth;
}

/**
 * Confirma que a conta está ATIVA. Separada de `requireAuthAtivo` para os
 * casos em que o userId já veio de outra validação (sessão do next-auth).
 */
export async function assertContaAtiva(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  // Falha FECHADO, e a comparação é `!== "ATIVO"` de propósito.
  //
  // A tentação é escrever `if (user?.status && user.status !== "ATIVO")`, que
  // é o que está em diaristaProfile.ts e deixa passar quando o campo é nulo ou
  // ausente. Aqui, usuário inexistente, status nulo ou valor futuro que
  // ninguém previu — todos recusam. Só a igualdade literal com "ATIVO" libera.
  if (!user || user.status !== "ATIVO") {
    const s = user?.status;
    const classificado: StatusInativo =
      s === "BLOQUEADO" || s === "REMOVIDO" ? s : "DESCONHECIDO";
    throw new ContaInativaError(classificado);
  }
}

const MENSAGEM: Record<StatusInativo, string> = {
  BLOQUEADO:
    "Sua conta está bloqueada. Fale com o suporte se acha que houve engano.",
  REMOVIDO:
    "Esta conta foi excluída. Crie uma nova conta para usar o Dular novamente.",
  DESCONHECIDO: "Sua conta não está ativa.",
};

/** Código e mensagem de um ContaInativaError, para rotas com `fail()` próprio. */
export function codigoDaConta(e: ContaInativaError): {
  codigo: "CONTA_BLOQUEADA" | "CONTA_REMOVIDA" | "CONTA_INATIVA";
  message: string;
} {
  const codigo =
    e.statusDaConta === "BLOQUEADO"
      ? ("CONTA_BLOQUEADA" as const)
      : e.statusDaConta === "REMOVIDO"
        ? ("CONTA_REMOVIDA" as const)
        : ("CONTA_INATIVA" as const);
  return { codigo, message: MENSAGEM[e.statusDaConta] };
}

/**
 * Traduz os erros de sessão em resposta HTTP, com códigos distintos.
 *
 * Dizer "bloqueada" ou "excluída" não vaza nada: quem chega aqui apresentou um
 * token válido para exatamente esta conta, então já é o dono dela. Devolver
 * 401 genérico só faria o app tratar como credencial vencida e mandar a pessoa
 * repetir o login para bater na mesma parede sem entender por quê.
 *
 * Retorna null quando o erro não é de sessão — deixe o chamador tratar.
 */
export function respostaDeSessao(e: unknown): NextResponse | null {
  if (e instanceof ContaInativaError) {
    const { codigo, message } = codigoDaConta(e);
    return NextResponse.json({ ok: false, error: codigo, message }, { status: 403 });
  }

  const msg = e instanceof Error ? e.message : "";
  if (msg === "Unauthorized") {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  return null;
}
