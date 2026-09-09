import { prisma } from "@/lib/prisma";

/**
 * Contas de demonstração para a revisão das lojas.
 *
 * POR QUE EXISTEM
 *
 * O revisor da App Store / Google Play precisa CRIAR fluxos para avaliar o
 * app, não só abrir telas. Dois portões o impedem hoje:
 *
 *   1. O perfil de diarista só aparece na busca com KYC aprovado, e a
 *      aprovação é humana — o revisor manda o documento e fica esperando.
 *   2. Criar serviço exige bairro cadastrado, e a operação cobre uma cidade
 *      só. Um revisor em qualquer outro lugar bate em "Bairro não cadastrado".
 *
 * O QUE A FLAG ABRE — E SÓ
 *
 *   - o filtro de KYC na busca de diaristas;
 *   - a validação de bairro na criação de serviço.
 *
 * Não concede admin, não pula autenticação, não libera plano pago, não
 * altera cobrança e não afeta SafeScore. Uma conta demo comprometida vale o
 * mesmo que uma conta comum comprometida, mais esses dois portões.
 *
 * POR QUE NÃO É VARIÁVEL DE AMBIENTE
 *
 * Já existe uma: `AUTO_VERIFY_PROFILES` (lib/autoVerificacao.ts), para E2E.
 * Ligada por engano em produção, ela aprova o KYC de TODO MUNDO — o raio de
 * dano é a base inteira. Uma coluna por usuário limita o dano à conta que a
 * tem, e ligar em massa exige UPDATE sem WHERE no banco de produção.
 *
 * COMO É ATIVADA
 *
 * Só pelo seed `prisma/seed-demo.ts`, que grava em telefones fixos e
 * conhecidos. NENHUMA rota da API escreve neste campo — nem a de perfil, nem
 * a de admin. Não há caminho pelo qual o próprio usuário a ative.
 */

/** A conta tem o portão aberto? Falso para qualquer usuário comum. */
export async function ehContaDemo(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { contaDemo: true },
  });
  return u?.contaDemo === true;
}
