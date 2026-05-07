import { api } from "@/lib/api";

export type SafeScoreTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type TrustSignals = {
  tier: SafeScoreTier;
  isVerified: boolean;
  totalServicos: number;
  emObservacao: boolean;
  lastUpdated: string | null;
};

export type PublicScore = {
  faixa: string;
  cor: string;
  bloqueado: boolean;
  tier: SafeScoreTier;
  totalServicos: number;
  verificado: boolean;
};

export async function getTrustSignals(userId: string): Promise<TrustSignals> {
  const res = await api.get(`/api/usuarios/${userId}/trust-signals`);
  return res.data;
}

export async function getPublicScore(userId: string): Promise<PublicScore> {
  const res = await api.get(`/api/usuarios/${userId}/score`);
  return res.data;
}

export type UserRestriction = {
  id: string;
  type: "SHADOW_BAN" | "LIMIT_BOOKINGS" | "SUSPEND" | "BLOCK";
  reason: string;
  expiresAt: string | null;
  createdAt: string;
};

export async function getMyRestrictions(): Promise<UserRestriction[]> {
  const res = await api.get("/api/me/restrictions");
  return res.data.restrictions ?? [];
}
