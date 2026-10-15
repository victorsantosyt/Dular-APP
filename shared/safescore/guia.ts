/**
 * SafeScore: definições compartilhadas entre o servidor (web) e o app.
 *
 * Fonte ÚNICA dos níveis, das faixas de reputação e do texto do guia "Como
 * funciona o SafeScore". O servidor calcula com estas faixas e devolve o guia
 * em /api/me/safescore; o app mostra o guia direto daqui, sem rede.
 *
 * Sem dependências: nada de Prisma, Next ou React Native neste arquivo.
 */

export const TIER_LABELS = { BRONZE: "Bronze", SILVER: "Prata", GOLD: "Ouro", PLATINUM: "Platina" } as const;

export type FaixaSafeScore = { min: number; label: string; cor: string; bloqueado: boolean };

/** Faixas de reputação, da maior para a menor; a primeira cujo `min` o score alcança vale. */
export const FAIXAS_SAFESCORE: readonly FaixaSafeScore[] = [
  { min: 800, label: "Confiança Máxima", cor: "#22c55e", bloqueado: false },
  { min: 600, label: "Confiável", cor: "#3b82f6", bloqueado: false },
  { min: 400, label: "Em Observação", cor: "#f59e0b", bloqueado: false },
  { min: 200, label: "Risco Alto", cor: "#ef4444", bloqueado: true },
  { min: -Infinity, label: "Suspenso", cor: "#7f1d1d", bloqueado: true },
];

export function faixaDoScore(score: number): FaixaSafeScore {
  return FAIXAS_SAFESCORE.find((faixa) => score >= faixa.min) ?? FAIXAS_SAFESCORE[FAIXAS_SAFESCORE.length - 1];
}

/** "A, B, C e D" */
function listar(itens: readonly string[]): string {
  return itens.length < 2 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export const SAFE_SCORE_GUIDE: readonly { title: string; text: string }[] = [
  { title: "O que é o SafeScore", text: "É um indicador de reputação baseado no histórico registrado na plataforma. Ele não garante segurança nem prevê a conduta de uma pessoa." },
  { title: "Fatores do cálculo", text: "Serviços confirmados, avaliações, verificação documental, cancelamentos tardios, faltas, tempo de plataforma e decisões sobre denúncias podem compor o histórico, conforme os critérios vigentes na plataforma." },
  { title: "Níveis e selos", text: `Os níveis são ${Object.values(TIER_LABELS).join(", ")}. O nível é determinado pelo cálculo da reputação e é diferente do selo de identidade verificada.` },
  { title: "Serviços concluídos", text: "A contagem inclui serviços confirmados pelo empregador ou já finalizados, em que você participou como cliente ou profissional. Um serviço apenas marcado como concluído, ainda sem confirmação, não entra nessa contagem." },
  { title: "Verificação de identidade", text: "Não enviada: falta enviar a documentação. Pendente: documentos em análise. Reprovada: a análise não aprovou os documentos. Verificada: a documentação foi aprovada. Essa verificação não é garantia de conduta." },
  { title: "Status da reputação", text: `As faixas são ${listar(FAIXAS_SAFESCORE.map((faixa) => faixa.label))}. Elas refletem o cálculo da reputação. Restrições ativas e a sinalização de observação da conta também são informadas e podem limitar o uso da plataforma.` },
  { title: "Acompanhamento de SOS", text: "Consulte o protocolo, a data e o andamento dos registros: Acionado, Em atendimento ou Resolvido. Registros antigos sem status seguem a regra de Acionado. Esta tela acompanha ocorrências; o acionamento continua no fluxo de SOS. Solicitar ajuda não é um evento de penalização do SafeScore." },
];
