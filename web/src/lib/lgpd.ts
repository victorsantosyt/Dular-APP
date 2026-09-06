import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3Objects";

/**
 * Exclusão de conta a pedido do titular (LGPD, art. 18).
 *
 * NÃO é DELETE físico, por dois motivos que se reforçam:
 *
 * 1. A política de privacidade promete preservar serviços concluídos,
 *    avaliações e incidentes de segurança "de forma desvinculada de você",
 *    porque eles são necessários para a integridade do histórico das outras
 *    pessoas envolvidas e para eventual defesa em processo.
 * 2. O banco impõe isso: 7 FKs para `User` são RESTRICT (ChatMessage.senderId,
 *    IncidentReport.reportedUserId/reportedById, SafeScore.userId e os três
 *    papéis em Servico). Um DELETE em User falha na primeira tentativa.
 *
 * Então "excluir" = apagar o que é dado pessoal, desvincular o resto e marcar
 * a conta como REMOVIDO (o login já barra qualquer status != ATIVO).
 */

/** Nome público que substitui o do titular nos registros preservados. */
export const NOME_ANONIMO = "Conta removida";

export type ResumoExclusao = {
  userId: string;
  apagados: Record<string, number>;
  anonimizados: Record<string, number>;
  arquivosS3: { removidos: number; falharam: number };
};

/** Extrai as chaves do S3 guardadas no `docUrl` (JSON `{frente, verso}`). */
function chavesDoDocUrl(docUrl: string | null | undefined): string[] {
  if (!docUrl) return [];
  try {
    const p = JSON.parse(docUrl) as Record<string, unknown>;
    return [p.frente, p.verso].filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/**
 * Anonimiza o usuário e apaga os dados pessoais que não precisamos manter.
 *
 * Preservado (desvinculado): Servico, Avaliacao, AvaliacaoEmpregador,
 * IncidentReport, SafetyEvent, SafeScore/ScoreEvento e UserRestriction — este
 * último porque é registro de moderação, não dado do titular.
 *
 * O conteúdo das mensagens de chat é MANTIDO de propósito: a política lista o
 * chat como registro em caso de disputa, e com o remetente anonimizado ele já
 * fica "desvinculado". Se a decisão mudar, basta limpar `content` aqui.
 */
export async function anonimizarUsuario(userId: string): Promise<ResumoExclusao> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      diaristaProfile: { select: { docUrl: true } },
      documentVerifications: { select: { docUrl: true } },
    },
  });
  if (!usuario) throw new Error("USUARIO_NAO_ENCONTRADO");
  if (usuario.status === "REMOVIDO") throw new Error("JA_REMOVIDO");

  // 1) Documentos de identidade no S3. Fora da transação de propósito: o
  //    storage não é transacional e uma falha de rede não pode impedir a
  //    exclusão dos dados no banco.
  const chaves = new Set<string>([
    ...chavesDoDocUrl(usuario.diaristaProfile?.docUrl),
    ...usuario.documentVerifications.flatMap((d) => chavesDoDocUrl(d.docUrl)),
  ]);
  const arquivosS3 = { removidos: 0, falharam: 0 };
  for (const chave of chaves) {
    try {
      await deleteObject(chave);
      arquivosS3.removidos++;
    } catch {
      // Registrar e seguir: o objeto órfão é resolvido por limpeza no bucket,
      // e travar aqui deixaria os dados pessoais no banco.
      arquivosS3.falharam++;
    }
  }

  const apagados: Record<string, number> = {};
  const anonimizados: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    // 2) O que é puramente pessoal e não sobrevive à exclusão.
    apagados.enderecos = (await tx.enderecoUsuario.deleteMany({ where: { userId } })).count;
    apagados.dadosPagamento = (await tx.paymentInfo.deleteMany({ where: { userId } })).count;
    apagados.contasOAuth = (await tx.oAuthAccount.deleteMany({ where: { userId } })).count;
    apagados.notificacoes = (await tx.notification.deleteMany({ where: { userId } })).count;
    apagados.verificacoes = (await tx.documentVerification.deleteMany({ where: { userId } })).count;
    apagados.favoritos = (
      await tx.empregadorFavorito.deleteMany({
        where: { OR: [{ empregadorUserId: userId }, { profissionalUserId: userId }] },
      })
    ).count;

    // 3) Endereço e observações ficam gravados no próprio serviço, que é
    //    preservado — então precisam ser limpos lá também.
    anonimizados.servicosComoCliente = (
      await tx.servico.updateMany({
        where: { clientId: userId },
        data: { enderecoCompleto: null, observacoes: null },
      })
    ).count;

    // 4) Perfis: some da busca e perde bio, foto e localização.
    anonimizados.perfilDiarista = (
      await tx.diaristaProfile.updateMany({
        where: { userId },
        data: {
          ativo: false, bio: null, fotoUrl: null, docUrl: null,
          cidade: null, estado: null, latitude: null, longitude: null,
          cidadeAtual: null, estadoAtual: null, bairroAtual: null,
          localizacaoPermitida: false, localizacaoAtualizadaEm: null,
        },
      })
    ).count;
    anonimizados.perfilEmpregador = (
      await tx.empregadorPerfil.updateMany({
        where: { userId },
        data: {
          ativo: false, fotoPerfil: null,
          cidade: null, estado: null, latitude: null, longitude: null,
          cidadeAtual: null, estadoAtual: null, bairroAtual: null,
        },
      })
    ).count;
    anonimizados.perfilMontador = (
      await tx.montadorPerfil.updateMany({
        where: { userId },
        data: {
          bio: null, cidade: null, estado: null, latitude: null, longitude: null,
          cidadeAtual: null, estadoAtual: null, bairroAtual: null,
        },
      })
    ).count;

    // 5) O titular. `telefone`, `cpf` e `email` são @unique — precisam ir a
    //    null (e não a um placeholder) para não colidir na próxima exclusão.
    await tx.user.update({
      where: { id: userId },
      data: {
        nome: NOME_ANONIMO,
        telefone: null, cpf: null, email: null,
        dataNascimento: null, genero: null,
        senhaHash: null, avatarUrl: null, pushToken: null, lastSeenAt: null,
        status: "REMOVIDO",
      },
    });
    anonimizados.usuario = 1;
  });

  return { userId, apagados, anonimizados, arquivosS3 };
}
