import type { DocumentVerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureUserRoleProfile } from "@/lib/userProfiles";

/**
 * Decisão sobre um envio de documentos (aprovar, reprovar, pedir reenvio).
 *
 * Atomicidade: a linha do envio é travada (`SELECT ... FOR UPDATE`) no início
 * da transação. Pedidos simultâneos para o mesmo envio esperam o lock e, ao
 * entrar, já veem a decisão do primeiro — nada de "ler, decidir fora do banco
 * e gravar". Na mesma transação: estado, histórico (DecisaoVerificacao),
 * perfil e o aviso à pessoa. Push e SafeScore vêm depois, nas rotas.
 *
 * Regras:
 * - os botões comuns só decidem envio PENDENTE; repetir a MESMA decisão é
 *   idempotente (não gera aviso nem histórico);
 * - mudar uma decisão concluída só pela revisão explícita, com motivo e com a
 *   decisão que o admin viu (`esperado`) — se mudou nesse meio-tempo, conflito;
 * - só o envio mais recente da conta pode ser decidido: decidir com base numa
 *   submissão antiga é recusado.
 */
export type Decisao = "APROVADO" | "REPROVADO" | "REENVIO";

export const STATUS_DA_DECISAO: Record<Decisao, DocumentVerificationStatus> = {
  APROVADO: "APPROVED",
  REPROVADO: "REJECTED",
  REENVIO: "REJECTED",
};

export const ROTULO_DA_DECISAO: Record<Decisao, string> = {
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  REENVIO: "Reenvio solicitado",
};

/** Motivos de reprovação/reenvio. O texto do admin complementa; a categoria é obrigatória. */
export const CATEGORIAS_DE_MOTIVO = {
  IMAGEM_ILEGIVEL: "Imagem ilegível",
  ROSTO_NAO_VISIVEL: "Rosto não visível na selfie",
  DADOS_DIVERGENTES: "Dados não conferem com o documento",
  CORRESPONDENCIA_NAO_CONFIRMADA: "Não foi possível confirmar que a selfie corresponde ao documento",
  OUTRO: "Outro motivo",
} as const;
export type CategoriaDeMotivo = keyof typeof CATEGORIAS_DE_MOTIVO;

export function lerCategoria(v: unknown): CategoriaDeMotivo | null {
  return typeof v === "string" && v in CATEGORIAS_DE_MOTIVO ? (v as CategoriaDeMotivo) : null;
}

/**
 * Conferência manual exigida para aprovar. São marcações do admin que
 * AUXILIAM a análise humana — nada aqui compara rostos automaticamente.
 */
export type Conferencia = { documentoLegivel: boolean; dadosConferem: boolean; selfieCompativel: boolean };

export function lerConferencia(v: unknown): Conferencia | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  return { documentoLegivel: c.documentoLegivel === true, dadosConferem: c.dadosConferem === true, selfieCompativel: c.selfieCompativel === true };
}

/** O envio tem selfie? (Envios anteriores à selfie guardam só frente e verso.) */
export function envioTemSelfie(docUrl: string | null | undefined): boolean {
  try {
    const p = JSON.parse(docUrl ?? "") as Record<string, unknown>;
    return typeof p.selfie === "string" && p.selfie.length > 0;
  } catch {
    return false;
  }
}

// O aviso (lista do app e push) leva só o rótulo fixo: o texto livre do admin
// pode conter dado pessoal e fica só na tela de verificação do próprio titular.
const AVISO: Record<Decisao, { type: "VERIFICACAO_APROVADA" | "VERIFICACAO_REPROVADA"; title: string; body: (rotulo: string) => string }> = {
  APROVADO: { type: "VERIFICACAO_APROVADA", title: "Verificação aprovada", body: () => "Seus documentos foram aprovados." },
  REPROVADO: {
    type: "VERIFICACAO_REPROVADA",
    title: "Verificação não aprovada",
    body: (r) => `Seus documentos não foram aprovados (${r}). Veja os detalhes em Verificação.`,
  },
  REENVIO: {
    type: "VERIFICACAO_REPROVADA",
    title: "Envie os documentos novamente",
    body: (r) => `Precisamos de um novo envio (${r}). Veja os detalhes em Verificação.`,
  },
};

/** Decisão de um envio antigo, gravado antes do campo `decisao`. */
export function decisaoVigente(status: DocumentVerificationStatus, decisao: string | null): Decisao | null {
  if (decisao === "APROVADO" || decisao === "REPROVADO" || decisao === "REENVIO") return decisao;
  if (status === "APPROVED") return "APROVADO";
  if (status === "REJECTED") return "REPROVADO";
  return null;
}

export function lerDecisao(v: unknown): Decisao | null {
  return v === "APROVADO" || v === "REPROVADO" || v === "REENVIO" ? v : null;
}

const SELECT_VERIFICACAO = {
  id: true, userId: true, docType: true, status: true, decisao: true, decididoEm: true, motivoUsuario: true,
  reviewedBy: true, reviewNote: true, createdAt: true, updatedAt: true,
} as const;

export type ResultadoDecisao =
  | { tipo: "decidida"; userId: string; role: string; decisao: Decisao; verification: any; aviso: { id: string; userId: string; type: string; title: string; body: string } }
  | { tipo: "ja-decidida"; userId: string; role: string; decisao: Decisao; verification: any }
  | { tipo: "erro"; status: 400 | 404 | 409; mensagem: string };

export async function decidirVerificacao(input: {
  id: string;
  adminId: string;
  decisao: Decisao;
  motivo: string;
  revisao: boolean;
  /** Na revisão: a decisão que o admin estava vendo. */
  esperado?: Decisao | null;
  /** Obrigatória para aprovar: as três marcações verdadeiras. */
  conferencia?: Conferencia | null;
  /** Obrigatória para reprovar ou pedir reenvio. */
  motivoCategoria?: CategoriaDeMotivo | null;
}): Promise<ResultadoDecisao> {
  const { id, adminId, decisao, motivo, revisao } = input;
  const alvo = STATUS_DA_DECISAO[decisao];
  const conferencia = input.conferencia ?? null;
  const categoria = input.motivoCategoria ?? null;
  if (decisao === "APROVADO" && !(conferencia?.documentoLegivel && conferencia.dadosConferem && conferencia.selfieCompativel)) {
    return { tipo: "erro", status: 400, mensagem: "Para aprovar, confirme as três conferências: documento legível, dados conferem e selfie compatível com a foto do documento." };
  }
  if (decisao !== "APROVADO" && !categoria) {
    return { tipo: "erro", status: 400, mensagem: "Escolha o motivo da reprovação ou do pedido de reenvio." };
  }
  const motivoUsuario = categoria ? `${CATEGORIAS_DE_MOTIVO[categoria]}${motivo ? `: ${motivo}` : ""}` : null;

  return prisma.$transaction(async (tx) => {
    const [linha] = await tx.$queryRaw<Array<{ id: string; userId: string; status: DocumentVerificationStatus; decisao: string | null; docUrl: string | null; createdAt: Date }>>`
      SELECT id, "userId", status, decisao, "docUrl", "createdAt" FROM "DocumentVerification" WHERE id = ${id} FOR UPDATE`;
    if (!linha) return { tipo: "erro", status: 404, mensagem: "Verificação não encontrada." };

    const user = await tx.user.findUnique({ where: { id: linha.userId }, select: { role: true } });
    const role = user?.role;
    if (role !== "EMPREGADOR" && role !== "DIARISTA" && role !== "MONTADOR") {
      return { tipo: "erro", status: 400, mensagem: "Perfil não suportado para verificação documental." };
    }

    const maisRecente = await tx.documentVerification.findFirst({
      where: { userId: linha.userId, id: { not: linha.id }, createdAt: { gt: linha.createdAt } },
      select: { id: true },
    });
    if (maisRecente) {
      return { tipo: "erro", status: 409, mensagem: "Esta conta tem um envio mais recente. Analise o envio atual." };
    }

    const atual = decisaoVigente(linha.status, linha.decisao);
    if (!revisao) {
      if (linha.status !== "PENDING") {
        if (atual === decisao) {
          const verification = await tx.documentVerification.findUniqueOrThrow({ where: { id }, select: SELECT_VERIFICACAO });
          return { tipo: "ja-decidida", userId: linha.userId, role, decisao, verification };
        }
        return {
          tipo: "erro",
          status: 409,
          mensagem: `Esta verificação já foi decidida (${atual ? ROTULO_DA_DECISAO[atual] : linha.status}). Para mudar, use "Revisar decisão", com motivo.`,
        };
      }
    } else {
      if (linha.status === "PENDING" || !atual) return { tipo: "erro", status: 409, mensagem: "Esta verificação ainda não foi decidida." };
      if (input.esperado !== atual) {
        return { tipo: "erro", status: 409, mensagem: "A decisão mudou desde que você abriu a análise. Recarregue antes de revisar." };
      }
      if (atual === decisao) return { tipo: "erro", status: 409, mensagem: "A decisão escolhida é a atual; nada a revisar." };
    }

    // Sem selfie não há como conferir a correspondência: o envio não pode ser
    // aprovado (nem por revisão). Contas já aprovadas não são revogadas — isto
    // só vale para uma nova aprovação.
    if (decisao === "APROVADO" && !envioTemSelfie(linha.docUrl)) {
      return { tipo: "erro", status: 409, mensagem: "Este envio não tem selfie (versão anterior do app). Solicite reenvio para conferir a identidade." };
    }

    const agora = new Date();
    await tx.documentVerification.update({
      where: { id },
      data: {
        status: alvo,
        decisao,
        decididoEm: agora,
        motivoUsuario: decisao === "APROVADO" ? null : motivoUsuario,
        reviewedBy: adminId,
        reviewNote: `KYC ${decisao === "APROVADO" ? "APROVADO" : decisao === "REENVIO" ? "REENVIO SOLICITADO" : "REPROVADO"}${revisao ? " (revisão)" : ""} por admin ${adminId} em ${agora.toISOString()} - ${motivo}`,
      },
    });
    await tx.decisaoVerificacao.create({
      data: {
        verificacaoId: id, adminId, de: linha.status, para: alvo, decisao, revisao, motivo: motivo || null,
        motivoCategoria: categoria,
        conferencia: decisao === "APROVADO" && conferencia ? conferencia : undefined,
      },
    });

    await ensureUserRoleProfile(tx, linha.userId, role);
    if (role === "DIARISTA") {
      await tx.diaristaProfile.update({ where: { userId: linha.userId }, data: { verificacao: decisao === "APROVADO" ? "VERIFICADO" : "REPROVADO" } });
    }
    if (role === "MONTADOR") {
      await tx.montadorPerfil.update({ where: { userId: linha.userId }, data: { verificado: decisao === "APROVADO" } });
    }

    // O aviso nasce na MESMA transação da decisão: ou os dois ficam, ou nenhum.
    const a = AVISO[decisao];
    const aviso = await tx.notification.create({
      data: { userId: linha.userId, type: a.type, title: a.title, body: a.body(categoria ? CATEGORIAS_DE_MOTIVO[categoria] : "") },
      select: { id: true, userId: true, type: true, title: true, body: true },
    });
    const verification = await tx.documentVerification.findUniqueOrThrow({ where: { id }, select: SELECT_VERIFICACAO });
    return { tipo: "decidida", userId: linha.userId, role, decisao, verification, aviso };
  });
}
