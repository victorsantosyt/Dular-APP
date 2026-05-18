/**
 * SafeScore Guardian — motor central de validação para os 3 perfis.
 *
 * Esta é a camada de DECISÃO. As fontes de dados primárias seguem nos
 * helpers existentes (`profileVerification.ts`, `safeScore.ts`,
 * `montadorProfile.ts`, `diaristaProfile.ts`). O Guardian compõe:
 *
 *   - User.status (BLOQUEADO derrota tudo)
 *   - DocumentVerification mais recente
 *   - DiaristaProfile.verificacao / MontadorPerfil.verificado
 *   - SafeScoreProfile (novo) → tier; fallback SafeScore legado
 *   - UserRestrictions ativas (SHADOW_BAN / LIMIT_BOOKINGS / SUSPEND / BLOCK)
 *   - Perfil completo por role
 *
 * Saída: matriz de permissões + motivos legíveis.
 *
 * Sem migration. Sem mock. Sem auto-aprovação em produção.
 * AUTO_VERIFY_PROFILES segue exclusivo de QA/E2E via autoVerificacao.ts.
 */
import { prisma } from "@/lib/prisma";
import type { UserRole, UserRestrictionType } from "@prisma/client";
import {
  getDiaristaVerificationStatus,
  getEmpregadorVerificationStatus,
  getMontadorVerificationStatus,
  type VerificationStatus,
} from "@/lib/profileVerification";
import { calcularCompletudeMontador } from "@/lib/montadorProfile";
import { getDiaristaProfileCompleteness } from "@/lib/diaristaProfile";

export type GuardianTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "BLOCKED";

export type GuardianRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

export type GuardianPermissions = {
  ok: boolean;
  score: number;
  tier: GuardianTier;
  verificationStatus: VerificationStatus;
  canCreateServico: boolean;
  canAppearInSearch: boolean;
  canReceiveServico: boolean;
  canAcceptServico: boolean;
  motivos: string[];
};

export const GUARDIAN_BLOCKED_MESSAGE =
  "Sua conta precisa concluir a verificação de segurança para continuar.";

export class GuardianBlockedError extends Error {
  readonly code = "GUARDIAN_BLOCKED" as const;
  readonly httpStatus: number;
  readonly motivos: string[];
  readonly verificationStatus: VerificationStatus;
  readonly safeScore: { score: number; tier: GuardianTier };
  constructor(
    message: string,
    args: {
      motivos: string[];
      verificationStatus: VerificationStatus;
      score: number;
      tier: GuardianTier;
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = "GuardianBlockedError";
    this.httpStatus = args.httpStatus ?? 403;
    this.motivos = args.motivos;
    this.verificationStatus = args.verificationStatus;
    this.safeScore = { score: args.score, tier: args.tier };
  }
}

export function guardianErrorResponseBody(err: GuardianBlockedError) {
  return {
    ok: false as const,
    error: err.code,
    message: err.message,
    motivos: err.motivos,
    verificationStatus: err.verificationStatus,
    safeScore: err.safeScore,
  };
}

type ActiveRestriction = { type: UserRestrictionType; reason: string };

async function getActiveRestrictions(userId: string): Promise<ActiveRestriction[]> {
  const now = new Date();
  const rows = await prisma.userRestriction.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { type: true, reason: true },
  });
  return rows;
}

async function getScoreAndTier(
  userId: string,
): Promise<{ score: number; tier: GuardianTier }> {
  // dual-read: SafeScoreProfile (novo) → fallback SafeScore legado
  const profile = await prisma.safeScoreProfile.findUnique({
    where: { userId },
    select: { currentScore: true, tier: true },
  });
  if (profile) {
    return { score: profile.currentScore, tier: profile.tier as GuardianTier };
  }
  const legacy = await prisma.safeScore.findUnique({
    where: { userId },
    select: { score: true },
  });
  if (legacy) {
    return { score: legacy.score, tier: scoreToGuardianTier(legacy.score) };
  }
  return { score: 500, tier: "BRONZE" };
}

function scoreToGuardianTier(score: number): GuardianTier {
  if (score >= 850) return "PLATINUM";
  if (score >= 650) return "GOLD";
  if (score >= 400) return "SILVER";
  return "BRONZE";
}

// Score abaixo desse limite bloqueia ações sensíveis mesmo com KYC aprovado.
// Espelha o limiar do getFaixa legado em safeScore.ts ("Risco Alto" < 400).
const SCORE_BLOQUEIO = 400;

async function getVerificationByRole(
  userId: string,
  role: GuardianRole,
): Promise<VerificationStatus> {
  if (role === "EMPREGADOR") return getEmpregadorVerificationStatus(userId);
  if (role === "DIARISTA") return getDiaristaVerificationStatus(userId);
  return getMontadorVerificationStatus(userId);
}

async function getProfileCompletenessByRole(
  userId: string,
  role: GuardianRole,
): Promise<{ completo: boolean; motivos: string[] }> {
  if (role === "EMPREGADOR") {
    // Empregador não tem completude obrigatória para o Guardian — apenas
    // verificação documental gate-aria criação de serviço.
    return { completo: true, motivos: [] };
  }
  if (role === "DIARISTA") {
    const profile = await prisma.diaristaProfile.findUnique({
      where: { userId },
      select: {
        ativo: true,
        bio: true,
        servicosOferecidos: true,
        cidade: true,
        estado: true,
        atendeTodaCidade: true,
        raioAtendimentoKm: true,
        precoLeve: true,
        precoMedio: true,
        precoPesada: true,
        precoBabaHora: true,
        precoCozinheiraBase: true,
        taxaMinima: true,
        valorACombinar: true,
        bairros: { select: { id: true } },
        user: { select: { nome: true, status: true } },
      },
    });
    if (!profile) return { completo: false, motivos: ["sem_perfil_diarista"] };
    const result = getDiaristaProfileCompleteness({
      ativo: profile.ativo,
      bio: profile.bio,
      servicosOferecidos: profile.servicosOferecidos,
      cidade: profile.cidade,
      estado: profile.estado,
      atendeTodaCidade: profile.atendeTodaCidade,
      raioAtendimentoKm: profile.raioAtendimentoKm,
      precoLeve: profile.precoLeve,
      precoMedio: profile.precoMedio,
      precoPesada: profile.precoPesada,
      precoBabaHora: profile.precoBabaHora,
      precoCozinheiraBase: profile.precoCozinheiraBase,
      taxaMinima: profile.taxaMinima,
      valorACombinar: profile.valorACombinar,
      bairros: profile.bairros,
      user: profile.user,
    });
    return { completo: result.completo, motivos: result.motivos };
  }
  // MONTADOR
  const profile = await prisma.montadorPerfil.findUnique({
    where: { userId },
    select: {
      ativo: true,
      bio: true,
      especialidades: true,
      cidade: true,
      estado: true,
      atendeTodaCidade: true,
      bairros: true,
      user: { select: { nome: true, status: true } },
    },
  });
  if (!profile) return { completo: false, motivos: ["sem_perfil_montador"] };
  const c = calcularCompletudeMontador({
    nome: profile.user?.nome,
    bio: profile.bio,
    especialidades: profile.especialidades,
    cidade: profile.cidade,
    estado: profile.estado,
    bairros: profile.bairros,
    atendeTodaCidade: profile.atendeTodaCidade,
    ativo: profile.ativo,
    userStatus: profile.user?.status,
  });
  if (c.completo) return { completo: true, motivos: [] };
  const motivos: string[] = [];
  if (!c.requisitos.nome) motivos.push("falta_nome");
  if (!c.requisitos.apresentacao) motivos.push("falta_bio");
  if (!c.requisitos.especialidades) motivos.push("falta_especialidades");
  if (!c.requisitos.areaAtendimento) motivos.push("falta_area_atendimento");
  if (!c.requisitos.ativo) motivos.push("perfil_inativo");
  return { completo: false, motivos };
}

/**
 * Avalia permissões do Guardian para um user. Não persiste nada.
 * Função pura sobre o estado atual do banco.
 */
export async function getGuardianStatusForUser(
  userId: string,
): Promise<GuardianPermissions> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });

  if (!user) {
    return blocked({
      score: 0,
      tier: "BLOCKED",
      verificationStatus: "NAO_ENVIADO",
      motivos: ["usuario_nao_encontrado"],
    });
  }

  if (!isGuardianRole(user.role)) {
    // ADMIN/sem-role: não passa pelas gates aqui. Devolve ok sem permissões
    // de profissional/empregador (callers que precisem dessas permissões
    // devem checar o role antes).
    const { score, tier } = await getScoreAndTier(userId);
    return {
      ok: true,
      score,
      tier,
      verificationStatus: "NAO_ENVIADO",
      canCreateServico: false,
      canAppearInSearch: false,
      canReceiveServico: false,
      canAcceptServico: false,
      motivos: [],
    };
  }

  const role: GuardianRole = user.role;

  // 1) Hard-block: User.status === BLOQUEADO derrota tudo.
  if (user.status === "BLOQUEADO") {
    return blocked({
      score: 0,
      tier: "BLOCKED",
      verificationStatus: "NAO_ENVIADO",
      motivos: ["usuario_bloqueado"],
    });
  }

  // 2) Coleta dados em paralelo.
  const [verificationStatus, restrictions, scoreTier, completude] = await Promise.all([
    getVerificationByRole(userId, role),
    getActiveRestrictions(userId),
    getScoreAndTier(userId),
    getProfileCompletenessByRole(userId, role),
  ]);

  const motivos: string[] = [];
  let tier: GuardianTier = scoreTier.tier;
  let score = scoreTier.score;

  // 3) Restrições ativas
  const hardBan = restrictions.some(
    (r) => r.type === "SUSPEND" || r.type === "BLOCK",
  );
  const shadow = restrictions.some((r) => r.type === "SHADOW_BAN");
  const limitBookings = restrictions.some((r) => r.type === "LIMIT_BOOKINGS");

  if (hardBan) {
    motivos.push("restricao_ativa_suspend_block");
    tier = "BLOCKED";
  }

  // 4) Score baixo: SCORE_BLOQUEIO (espelha getFaixa < 400 do legado)
  const scoreBaixo = score < SCORE_BLOQUEIO;
  if (scoreBaixo) motivos.push("score_baixo");

  // 5) Verificação documental
  if (verificationStatus === "NAO_ENVIADO") motivos.push("documento_nao_enviado");
  else if (verificationStatus === "PENDENTE") motivos.push("documento_aguardando_analise");
  else if (verificationStatus === "REPROVADO") motivos.push("documento_reprovado");

  // 6) Completude (só pesa para profissional)
  if (role !== "EMPREGADOR" && !completude.completo) {
    motivos.push("perfil_incompleto");
    for (const m of completude.motivos) motivos.push(m);
  }

  if (shadow) motivos.push("restricao_shadow_ban");
  if (limitBookings) motivos.push("restricao_limit_bookings");

  // 7) Decide permissões por role.
  // Empregador:
  //   - canCreateServico: precisa de VERIFICADO + sem hardBan + sem LIMIT_BOOKINGS + score viável
  //   - demais flags: n/a (false)
  // Profissional (DIARISTA/MONTADOR):
  //   - canAppearInSearch: VERIFICADO + perfil completo + sem hardBan + sem SHADOW_BAN + score viável
  //   - canReceiveServico: VERIFICADO + sem hardBan + score viável (não pesa SHADOW)
  //   - canAcceptServico: == canReceiveServico
  const verificado = verificationStatus === "VERIFICADO";
  const baseLiberado = !hardBan && !scoreBaixo;

  let canCreateServico = false;
  let canAppearInSearch = false;
  let canReceiveServico = false;
  let canAcceptServico = false;

  if (role === "EMPREGADOR") {
    canCreateServico = baseLiberado && verificado && !limitBookings;
  } else {
    canAppearInSearch = baseLiberado && verificado && completude.completo && !shadow;
    canReceiveServico = baseLiberado && verificado;
    canAcceptServico = canReceiveServico;
  }

  const ok =
    role === "EMPREGADOR"
      ? canCreateServico
      : canAppearInSearch && canReceiveServico;

  return {
    ok,
    score,
    tier,
    verificationStatus,
    canCreateServico,
    canAppearInSearch,
    canReceiveServico,
    canAcceptServico,
    motivos,
  };
}

/** Alias para o nome solicitado no T-18.6. */
export async function getGuardianPermissions(userId: string) {
  return getGuardianStatusForUser(userId);
}

export async function assertGuardianCanCreateServico(userId: string): Promise<void> {
  const status = await getGuardianStatusForUser(userId);
  if (!status.canCreateServico) {
    throw new GuardianBlockedError(GUARDIAN_BLOCKED_MESSAGE, {
      motivos: status.motivos,
      verificationStatus: status.verificationStatus,
      score: status.score,
      tier: status.tier,
    });
  }
}

export async function assertGuardianProfessionalCanReceiveServico(
  userId: string,
  role: "DIARISTA" | "MONTADOR",
): Promise<void> {
  const status = await getGuardianStatusForUser(userId);
  if (!isGuardianRole(role)) return;
  if (!status.canReceiveServico) {
    throw new GuardianBlockedError(
      "Profissional ainda não está liberado pelo Guardian para receber serviços.",
      {
        motivos: status.motivos,
        verificationStatus: status.verificationStatus,
        score: status.score,
        tier: status.tier,
      },
    );
  }
}

export async function assertGuardianProfessionalCanAcceptServico(
  userId: string,
  role: "DIARISTA" | "MONTADOR",
): Promise<void> {
  const status = await getGuardianStatusForUser(userId);
  if (!isGuardianRole(role)) return;
  if (!status.canAcceptServico) {
    throw new GuardianBlockedError(
      "Profissional ainda não está liberado pelo Guardian para aceitar serviços.",
      {
        motivos: status.motivos,
        verificationStatus: status.verificationStatus,
        score: status.score,
        tier: status.tier,
      },
    );
  }
}

function blocked(args: {
  score: number;
  tier: GuardianTier;
  verificationStatus: VerificationStatus;
  motivos: string[];
}): GuardianPermissions {
  return {
    ok: false,
    score: args.score,
    tier: args.tier,
    verificationStatus: args.verificationStatus,
    canCreateServico: false,
    canAppearInSearch: false,
    canReceiveServico: false,
    canAcceptServico: false,
    motivos: args.motivos,
  };
}

function isGuardianRole(role: UserRole | string | null | undefined): role is GuardianRole {
  return role === "EMPREGADOR" || role === "DIARISTA" || role === "MONTADOR";
}
