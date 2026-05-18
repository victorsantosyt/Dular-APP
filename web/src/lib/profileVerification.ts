/**
 * Verificação documental: helper central para os 3 papéis.
 *
 * Regra única (T-18.5):
 *   - documento enviado != documento aprovado
 *   - apenas VERIFICADO/APROVADO libera ações críticas
 *   - REPROVADO bloqueia tanto quanto PENDENTE/NAO_ENVIADO
 *   - auto-aprovação só em QA/E2E (AUTO_VERIFY_PROFILES=true)
 *
 * EMPREGADOR não tem campo `verificacao` no `EmpregadorPerfil` — a fonte
 * da verdade é a última linha de `DocumentVerification` do user (mesmo padrão
 * usado em /api/me). Sem migration: a tabela DocumentVerification já é
 * polimórfica por userId. Para DIARISTA usamos `DiaristaProfile.verificacao`,
 * para MONTADOR `MontadorPerfil.verificado`.
 */
import { prisma } from "@/lib/prisma";

export type VerificationStatus = "VERIFICADO" | "PENDENTE" | "REPROVADO" | "NAO_ENVIADO";

export const VERIFICACAO_OBRIGATORIA_MESSAGE =
  "Envie e aprove seus documentos para solicitar serviços.";
export const VERIFICACAO_OBRIGATORIA_PROFISSIONAL_MESSAGE =
  "Profissional ainda não verificado. Aguarde a aprovação dos documentos.";

export class VerificacaoObrigatoriaError extends Error {
  readonly code = "VERIFICACAO_OBRIGATORIA" as const;
  readonly status: VerificationStatus;
  readonly httpStatus: number;
  constructor(message: string, status: VerificationStatus, httpStatus = 403) {
    super(message);
    this.name = "VerificacaoObrigatoriaError";
    this.status = status;
    this.httpStatus = httpStatus;
  }
}

function mapDocumentStatus(status?: string | null): VerificationStatus {
  if (!status) return "NAO_ENVIADO";
  const s = String(status).toUpperCase();
  if (s === "APPROVED" || s === "APROVADO" || s === "VERIFICADO") return "VERIFICADO";
  if (s === "REJECTED" || s === "REPROVADO") return "REPROVADO";
  if (s === "PENDING" || s === "PENDENTE") return "PENDENTE";
  return "NAO_ENVIADO";
}

/** Empregador: lê a última DocumentVerification do user. */
export async function getEmpregadorVerificationStatus(
  userId: string,
): Promise<VerificationStatus> {
  const doc = await prisma.documentVerification.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { status: true, docUrl: true },
  });
  if (!doc) return "NAO_ENVIADO";
  const mapped = mapDocumentStatus(doc.status);
  // Sem docUrl, considera não enviado mesmo que exista linha residual.
  if (mapped === "PENDENTE" && !doc.docUrl) return "NAO_ENVIADO";
  return mapped;
}

/** Diarista: usa DiaristaProfile.verificacao (default PENDENTE no schema). */
export async function getDiaristaVerificationStatus(
  userId: string,
): Promise<VerificationStatus> {
  const profile = await prisma.diaristaProfile.findUnique({
    where: { userId },
    select: { verificacao: true, docUrl: true },
  });
  if (!profile) return "NAO_ENVIADO";
  if (profile.verificacao === "VERIFICADO") return "VERIFICADO";
  if (profile.verificacao === "REPROVADO") return "REPROVADO";
  // PENDENTE sem docUrl é estado default do schema: tratamos como NAO_ENVIADO
  if (!profile.docUrl) return "NAO_ENVIADO";
  return "PENDENTE";
}

/** Montador: usa MontadorPerfil.verificado + documentoFrente/Verso/selfieDoc. */
export async function getMontadorVerificationStatus(
  userId: string,
): Promise<VerificationStatus> {
  const profile = await prisma.montadorPerfil.findUnique({
    where: { userId },
    select: {
      verificado: true,
      documentoFrente: true,
      documentoVerso: true,
      selfieDoc: true,
    },
  });
  if (!profile) return "NAO_ENVIADO";
  if (profile.verificado) return "VERIFICADO";
  const algumDoc = Boolean(
    profile.documentoFrente || profile.documentoVerso || profile.selfieDoc,
  );
  return algumDoc ? "PENDENTE" : "NAO_ENVIADO";
}

/**
 * Empregador só pode criar serviço se documentos estão VERIFICADOS.
 * Lança VerificacaoObrigatoriaError (HTTP 403, code VERIFICACAO_OBRIGATORIA).
 */
export async function assertCanCreateServico(user: {
  userId: string;
  role: string;
}): Promise<void> {
  if (user.role !== "EMPREGADOR") return; // outros papéis não criam serviço
  const status = await getEmpregadorVerificationStatus(user.userId);
  if (status !== "VERIFICADO") {
    throw new VerificacaoObrigatoriaError(VERIFICACAO_OBRIGATORIA_MESSAGE, status);
  }
}

/**
 * Profissional (DIARISTA/MONTADOR) só pode receber/aceitar serviço se
 * a verificação documental está APROVADA.
 */
export async function assertProfessionalCanReceiveServico(professional: {
  userId: string;
  role: "DIARISTA" | "MONTADOR";
}): Promise<void> {
  const status =
    professional.role === "DIARISTA"
      ? await getDiaristaVerificationStatus(professional.userId)
      : await getMontadorVerificationStatus(professional.userId);
  if (status !== "VERIFICADO") {
    throw new VerificacaoObrigatoriaError(
      VERIFICACAO_OBRIGATORIA_PROFISSIONAL_MESSAGE,
      status,
    );
  }
}

export function verificacaoErrorResponseBody(err: VerificacaoObrigatoriaError) {
  return {
    ok: false as const,
    error: err.code,
    message: err.message,
    verificacaoStatus: err.status,
  };
}
