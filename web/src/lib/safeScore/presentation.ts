import { prisma } from "@/lib/prisma";
import { getFaixa } from "@/lib/safeScore";
import { scoreToTier } from "./applyEvent";

export const TIER_LABELS = { BRONZE: "Bronze", SILVER: "Prata", GOLD: "Ouro", PLATINUM: "Platina" } as const;

export async function readScorePresentation(userId: string) {
  const profile = await prisma.safeScoreProfile.findUnique({
    where: { userId }, select: { currentScore: true },
  });
  const legacy = profile ? null : await prisma.safeScore.findUnique({
    where: { userId }, select: { score: true },
  });
  const score = profile?.currentScore ?? legacy?.score;
  if (score == null) return null;
  const faixa = getFaixa(score);
  const tier = scoreToTier(score);
  return { faixa: faixa.label, cor: faixa.cor, bloqueado: faixa.bloqueado, tier, nivel: TIER_LABELS[tier] };
}

export function countCompletedServices(userId: string) {
  return prisma.servico.count({ where: {
    status: { in: ["CONFIRMADO", "FINALIZADO"] },
    OR: [{ clientId: userId }, { diaristaId: userId }, { montadorId: userId }],
  } });
}

export const SAFE_SCORE_GUIDE = [
  { title: "O que é o SafeScore", text: "É um indicador de reputação baseado no histórico registrado na plataforma. Ele não garante segurança nem prevê a conduta de uma pessoa." },
  { title: "Fatores do cálculo", text: "Serviços confirmados, avaliações, verificação documental, cancelamentos tardios, faltas, tempo de plataforma e decisões sobre denúncias podem compor o histórico, conforme os critérios vigentes na plataforma." },
  { title: "Níveis e selos", text: `Os níveis são ${Object.values(TIER_LABELS).join(", ")}. O nível é determinado pelo cálculo da reputação e é diferente do selo de identidade verificada.` },
  { title: "Serviços concluídos", text: "A contagem inclui serviços confirmados pelo empregador ou já finalizados, em que você participou como cliente ou profissional. Um serviço apenas marcado como concluído, ainda sem confirmação, não entra nessa contagem." },
  { title: "Verificação de identidade", text: "Não enviada: falta enviar a documentação. Pendente: documentos em análise. Reprovada: a análise não aprovou os documentos. Verificada: a documentação foi aprovada. Essa verificação não é garantia de conduta." },
  { title: "Status da reputação", text: "As faixas são Confiança Máxima, Confiável, Em Observação, Risco Alto e Suspenso. Elas refletem o cálculo da reputação. Restrições ativas e a sinalização de observação da conta também são informadas e podem limitar o uso da plataforma." },
  { title: "Acompanhamento de SOS", text: "Consulte o protocolo, a data e o andamento dos registros: Acionado, Em atendimento ou Resolvido. Registros antigos sem status seguem a regra de Acionado. Esta tela acompanha ocorrências; o acionamento continua no fluxo de SOS. Solicitar ajuda não é um evento de penalização do SafeScore." },
];

export async function canReadScore(
  viewer: { userId: string; role: string },
  alvo: { id: string; role: string | null },
): Promise<boolean> {
  if (viewer.userId === alvo.id) return true;
  if (viewer.role === "ADMIN") return true;
  if (alvo.role === "DIARISTA" || alvo.role === "MONTADOR") return true;

  const vinculo = await prisma.servico.findFirst({
    where: {
      clientId: alvo.id,
      OR: [{ diaristaId: viewer.userId }, { montadorId: viewer.userId }],
    },
    select: { id: true },
  });
  return vinculo !== null;
}
