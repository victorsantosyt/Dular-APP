import type { DocumentVerificationStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signGetUrl } from "@/lib/s3Objects";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";
import { getDiaristaProfileCompleteness } from "@/lib/diaristaProfile";
import { getMontadorProfileCompleteness } from "@/lib/montadorProfile";

export type VerificationFlowType = "PRIMEIRA_VERIFICACAO" | "RENOVACAO_REENVIO";
export type AdminVerificationStatus = DocumentVerificationStatus | "ALL";
export type AdminVerificationRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ALL";

const REVIEW_ROLES = ["EMPREGADOR", "DIARISTA", "MONTADOR"] as const;

type ReviewRole = (typeof REVIEW_ROLES)[number];

const roleDocType: Record<ReviewRole, string> = {
  EMPREGADOR: "EMPREGADOR_KYC",
  DIARISTA: "DIARISTA_KYC",
  MONTADOR: "MONTADOR_KYC",
};

function isReviewRole(role: UserRole | null | undefined): role is ReviewRole {
  return role === "EMPREGADOR" || role === "DIARISTA" || role === "MONTADOR";
}

function normalizeDocType(docType: string, role: UserRole | null | undefined) {
  if (isReviewRole(role)) return roleDocType[role];
  return docType;
}

function dateIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function statusWhere(status: AdminVerificationStatus) {
  return status === "ALL" ? undefined : status;
}

function roleWhere(role: AdminVerificationRole) {
  return role === "ALL" ? { in: [...REVIEW_ROLES] } : role;
}

function profileLocation(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? null;
}

function buildProfileSummary(user: any) {
  if (user.role === "EMPREGADOR") {
    const profile = user.empregadorPerfil;
    return {
      cadastroCompleto: Boolean(user.nome?.trim() && (user.telefone?.trim() || user.email?.trim())),
      cidade: profileLocation(profile?.cidadeAtual, profile?.cidade),
      estado: profileLocation(profile?.estadoAtual, profile?.estado),
      bairro: profileLocation(profile?.bairroAtual),
      servicosOferecidos: [] as string[],
      especialidades: [] as string[],
      ativo: profile?.ativo ?? true,
    };
  }

  if (user.role === "DIARISTA") {
    const profile = user.diaristaProfile;
    const completude = profile
      ? getDiaristaProfileCompleteness({
          ativo: profile.ativo,
          bio: profile.bio,
          servicosOferecidos: profile.servicosOferecidos ?? [],
          cidade: profile.cidade,
          estado: profile.estado,
          atendeTodaCidade: profile.atendeTodaCidade,
          raioAtendimentoKm: profile.raioAtendimentoKm,
          precoLeve: profile.precoLeve ?? 0,
          precoMedio: profile.precoMedio ?? 0,
          precoPesada: profile.precoPesada ?? 0,
          precoBabaHora: profile.precoBabaHora,
          precoCozinheiraBase: profile.precoCozinheiraBase,
          taxaMinima: profile.taxaMinima,
          valorACombinar: profile.valorACombinar,
          bairros: profile.bairros ?? [],
          user: { nome: user.nome, status: user.status },
        })
      : { completo: false };
    return {
      cadastroCompleto: completude.completo,
      cidade: profileLocation(profile?.cidadeAtual, profile?.cidade),
      estado: profileLocation(profile?.estadoAtual, profile?.estado),
      bairro: profileLocation(profile?.bairroAtual, profile?.bairros?.[0]?.bairro?.nome),
      servicosOferecidos: profile?.servicosOferecidos ?? [],
      especialidades: [] as string[],
      ativo: profile?.ativo ?? false,
    };
  }

  if (user.role === "MONTADOR") {
    const profile = user.montadorPerfil;
    const completude = profile
      ? getMontadorProfileCompleteness({
          nome: user.nome,
          bio: profile.bio,
          especialidades: profile.especialidades,
          cidade: profile.cidade,
          estado: profile.estado,
          bairros: profile.bairros,
          atendeTodaCidade: profile.atendeTodaCidade,
          ativo: profile.ativo,
          userStatus: user.status,
        })
      : { completo: false };
    return {
      cadastroCompleto: completude.completo,
      cidade: profileLocation(profile?.cidadeAtual, profile?.cidade),
      estado: profileLocation(profile?.estadoAtual, profile?.estado),
      bairro: profileLocation(profile?.bairroAtual, profile?.bairros?.[0]),
      servicosOferecidos: [] as string[],
      especialidades: profile?.especialidades ?? [],
      ativo: profile?.ativo ?? false,
    };
  }

  return {
    cadastroCompleto: false,
    cidade: null,
    estado: null,
    bairro: null,
    servicosOferecidos: [] as string[],
    especialidades: [] as string[],
    ativo: false,
  };
}

function userSelect() {
  return {
    id: true,
    nome: true,
    email: true,
    telefone: true,
    role: true,
    status: true,
    createdAt: true,
    empregadorPerfil: {
      select: {
        cidade: true,
        estado: true,
        cidadeAtual: true,
        estadoAtual: true,
        bairroAtual: true,
        ativo: true,
        localizacaoPermitida: true,
      },
    },
    diaristaProfile: {
      select: {
        verificacao: true,
        ativo: true,
        bio: true,
        servicosOferecidos: true,
        cidade: true,
        estado: true,
        cidadeAtual: true,
        estadoAtual: true,
        bairroAtual: true,
        atendeTodaCidade: true,
        raioAtendimentoKm: true,
        anosExperiencia: true,
        precoLeve: true,
        precoMedio: true,
        precoPesada: true,
        precoBabaHora: true,
        precoCozinheiraBase: true,
        taxaMinima: true,
        cobraDeslocamento: true,
        valorACombinar: true,
        observacaoPreco: true,
        localizacaoPermitida: true,
        bairros: { select: { id: true, bairro: { select: { nome: true, cidade: true, uf: true } } } },
      },
    },
    montadorPerfil: {
      select: {
        verificado: true,
        ativo: true,
        bio: true,
        especialidades: true,
        cidade: true,
        estado: true,
        cidadeAtual: true,
        estadoAtual: true,
        bairroAtual: true,
        atendeTodaCidade: true,
        bairros: true,
        raioAtendimentoKm: true,
        anosExperiencia: true,
        precoBase: true,
        taxaMinima: true,
        cobraDeslocamento: true,
        observacaoPreco: true,
        valorACombinar: true,
        localizacaoPermitida: true,
      },
    },
  } as const;
}

async function getFlowTypes(rows: Array<{ id: string; userId: string; status: DocumentVerificationStatus; createdAt: Date }>) {
  const pending = rows.filter((row) => row.status === "PENDING");
  if (pending.length === 0) return new Map<string, VerificationFlowType>();

  const result = new Map<string, VerificationFlowType>();
  await Promise.all(
    pending.map(async (row) => {
      const previousApproved = await prisma.documentVerification.findFirst({
        where: {
          userId: row.userId,
          status: "APPROVED",
          createdAt: { lt: row.createdAt },
        },
        select: { id: true },
      });
      result.set(row.id, previousApproved ? "RENOVACAO_REENVIO" : "PRIMEIRA_VERIFICACAO");
    }),
  );
  return result;
}

export async function getVerificationStats() {
  const [pending, approved, rejected, allPendingRows] = await Promise.all([
    prisma.documentVerification.count({
      where: { status: "PENDING", user: { role: { in: [...REVIEW_ROLES] } } },
    }),
    prisma.documentVerification.count({
      where: { status: "APPROVED", user: { role: { in: [...REVIEW_ROLES] } } },
    }),
    prisma.documentVerification.count({
      where: { status: "REJECTED", user: { role: { in: [...REVIEW_ROLES] } } },
    }),
    prisma.documentVerification.findMany({
      where: { status: "PENDING", user: { role: { in: [...REVIEW_ROLES] } } },
      select: { id: true, userId: true, status: true, createdAt: true },
    }),
  ]);
  const flowTypes = await getFlowTypes(allPendingRows);
  const renewals = Array.from(flowTypes.values()).filter((flow) => flow === "RENOVACAO_REENVIO").length;
  return { pending, approved, rejected, renewals };
}

export async function listAdminVerificacoes(input: {
  status?: string | null;
  role?: string | null;
  q?: string | null;
  page?: string | null;
  limit?: string | null;
}) {
  const status = input.status === "APPROVED" || input.status === "REJECTED" || input.status === "ALL"
    ? input.status
    : "PENDING";
  const role = input.role === "EMPREGADOR" || input.role === "DIARISTA" || input.role === "MONTADOR"
    ? input.role
    : "ALL";
  const page = parsePositiveInt(input.page ?? null, 1, 10_000);
  const limit = parsePositiveInt(input.limit ?? null, 25, 100);
  const q = input.q?.trim() ?? "";

  const where: any = {
    ...(statusWhere(status) ? { status: statusWhere(status) } : {}),
    user: { role: roleWhere(role) },
  };

  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { userId: { contains: q, mode: "insensitive" } },
      { docType: { contains: q, mode: "insensitive" } },
      { user: { nome: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { telefone: { contains: q, mode: "insensitive" } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [rows, total, stats] = await Promise.all([
    prisma.documentVerification.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        docType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: userSelect() },
      },
    }),
    prisma.documentVerification.count({ where }),
    getVerificationStats(),
  ]);

  const flowTypes = await getFlowTypes(rows);
  const items = await Promise.all(
    rows.map(async (row) => {
      const guardian = await getGuardianStatusForUser(row.userId);
      const flowType = flowTypes.get(row.id) ?? "PRIMEIRA_VERIFICACAO";
      return {
        id: row.id,
        userId: row.userId,
        user: {
          id: row.user.id,
          nome: row.user.nome,
          email: row.user.email,
          telefone: row.user.telefone,
          role: row.user.role,
          status: row.user.status,
          createdAt: row.user.createdAt,
        },
        docType: normalizeDocType(row.docType, row.user.role),
        rawDocType: row.docType,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        flowType,
        guardian,
        profileSummary: buildProfileSummary(row.user),
      };
    }),
  );

  return { items, total, page, limit, stats };
}

function parseDocUrl(docUrl: string | null | undefined) {
  const value = docUrl?.trim();
  if (!value) return { frente: null as string | null, verso: null as string | null, uploadedAt: null as string | null };

  try {
    const parsed = JSON.parse(value) as { frente?: unknown; verso?: unknown; uploadedAt?: unknown };
    return {
      frente: typeof parsed.frente === "string" ? parsed.frente : null,
      verso: typeof parsed.verso === "string" ? parsed.verso : null,
      uploadedAt: typeof parsed.uploadedAt === "string" ? parsed.uploadedAt : null,
    };
  } catch {
    return { frente: value, verso: null as string | null, uploadedAt: null as string | null };
  }
}

async function signDocument(key: string | null) {
  if (!key) return null;
  return { key, signedUrl: await signGetUrl(key, 5 * 60) };
}

export async function getAdminVerificacaoDetail(id: string) {
  const verification = await prisma.documentVerification.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      docType: true,
      docUrl: true,
      status: true,
      reviewedBy: true,
      reviewNote: true,
      createdAt: true,
      updatedAt: true,
      user: { select: userSelect() },
    },
  });

  if (!verification) return null;

  const [guardian, history] = await Promise.all([
    getGuardianStatusForUser(verification.userId),
    prisma.documentVerification.findMany({
      where: { userId: verification.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        docType: true,
        status: true,
        reviewedBy: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const flowTypes = await getFlowTypes([
    {
      id: verification.id,
      userId: verification.userId,
      status: verification.status,
      createdAt: verification.createdAt,
    },
  ]);
  const docs = parseDocUrl(verification.docUrl);
  const [frente, verso] = await Promise.all([signDocument(docs.frente), signDocument(docs.verso)]);

  return {
    verification: {
      id: verification.id,
      userId: verification.userId,
      docType: normalizeDocType(verification.docType, verification.user.role),
      rawDocType: verification.docType,
      status: verification.status,
      reviewedBy: verification.reviewedBy,
      reviewNote: verification.reviewNote,
      createdAt: dateIso(verification.createdAt),
      updatedAt: dateIso(verification.updatedAt),
      flowType: flowTypes.get(verification.id) ?? "PRIMEIRA_VERIFICACAO",
    },
    user: {
      id: verification.user.id,
      nome: verification.user.nome,
      email: verification.user.email,
      telefone: verification.user.telefone,
      role: verification.user.role,
      status: verification.user.status,
      createdAt: dateIso(verification.user.createdAt),
    },
    profileSummary: buildProfileSummary(verification.user),
    profileDetails: {
      empregador: verification.user.empregadorPerfil,
      diarista: verification.user.diaristaProfile,
      montador: verification.user.montadorPerfil,
    },
    guardian,
    documents: {
      frente,
      verso,
      uploadedAt: docs.uploadedAt,
    },
    history: history.map((item) => ({
      ...item,
      docType: normalizeDocType(item.docType, verification.user.role),
      rawDocType: item.docType,
      createdAt: dateIso(item.createdAt),
      updatedAt: dateIso(item.updatedAt),
    })),
  };
}
