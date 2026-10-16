import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as compartilhado from "../../../shared/safescore/guia";
import { SAFE_SCORE_GUIDE, TIER_LABELS } from "../../src/lib/safeScore/presentation";
import { getFaixa } from "../../src/lib/safeScore";

/**
 * O guia "Como funciona o SafeScore", os níveis e as faixas saem de UMA fonte
 * (shared/safescore/guia.ts), lida pelo servidor e pelo app. O texto e os
 * limites abaixo são os que estavam no servidor antes da mudança: o contrato
 * de /api/me/safescore (campo `guide`, exigido pelo app vc 5) não pode mudar.
 */

const GUIA_ANTERIOR = [
  ["O que é o SafeScore", "É um indicador de reputação baseado no histórico registrado na plataforma. Ele não garante segurança nem prevê a conduta de uma pessoa."],
  ["Fatores do cálculo", "Serviços confirmados, avaliações, verificação documental, cancelamentos tardios, faltas, tempo de plataforma e decisões sobre denúncias podem compor o histórico, conforme os critérios vigentes na plataforma."],
  ["Níveis e selos", "Os níveis são Bronze, Prata, Ouro, Platina. O nível é determinado pelo cálculo da reputação e é diferente do selo de identidade verificada."],
  ["Serviços concluídos", "A contagem inclui serviços confirmados pelo empregador ou já finalizados, em que você participou como cliente ou profissional. Um serviço apenas marcado como concluído, ainda sem confirmação, não entra nessa contagem."],
  ["Verificação de identidade", "Não enviada: falta enviar a documentação. Pendente: documentos em análise. Reprovada: a análise não aprovou os documentos. Verificada: a documentação foi aprovada. Essa verificação não é garantia de conduta."],
  ["Status da reputação", "As faixas são Confiança Máxima, Confiável, Em Observação, Risco Alto e Suspenso. Elas refletem o cálculo da reputação. Restrições ativas e a sinalização de observação da conta também são informadas e podem limitar o uso da plataforma."],
  ["Acompanhamento de SOS", "Consulte o protocolo, a data e o andamento dos registros: Acionado, Em atendimento ou Resolvido. Registros antigos sem status seguem a regra de Acionado. Esta tela acompanha ocorrências; o acionamento continua no fluxo de SOS. Solicitar ajuda não é um evento de penalização do SafeScore."],
];

describe("SafeScore: fonte única compartilhada", () => {
  it("o guia devolvido pelo servidor é o mesmo texto de antes, bloco a bloco", () => {
    assert.deepEqual(SAFE_SCORE_GUIDE.map((b) => [b.title, b.text]), GUIA_ANTERIOR);
  });

  it("servidor reexporta o objeto do módulo compartilhado (não uma cópia)", () => {
    assert.equal(SAFE_SCORE_GUIDE, compartilhado.SAFE_SCORE_GUIDE);
    assert.equal(TIER_LABELS, compartilhado.TIER_LABELS);
    assert.deepEqual(TIER_LABELS, { BRONZE: "Bronze", SILVER: "Prata", GOLD: "Ouro", PLATINUM: "Platina" });
  });

  it("getFaixa mantém limites, rótulos, cores e bloqueio", () => {
    const casos: [number, string, string, boolean][] = [
      [1000, "Confiança Máxima", "#22c55e", false],
      [800, "Confiança Máxima", "#22c55e", false],
      [799.99, "Confiável", "#3b82f6", false],
      [600, "Confiável", "#3b82f6", false],
      [599, "Em Observação", "#f59e0b", false],
      [400, "Em Observação", "#f59e0b", false],
      [399, "Risco Alto", "#ef4444", true],
      [200, "Risco Alto", "#ef4444", true],
      [199, "Suspenso", "#7f1d1d", true],
      [0, "Suspenso", "#7f1d1d", true],
      [-10, "Suspenso", "#7f1d1d", true],
    ];
    for (const [score, label, cor, bloqueado] of casos) {
      assert.deepEqual(getFaixa(score), { label, cor, bloqueado }, `score ${score}`);
    }
  });

  it("o módulo compartilhado não depende de servidor nem de app", () => {
    const fonte = readFileSync(join(import.meta.dirname, "..", "..", "..", "shared", "safescore", "guia.ts"), "utf8");
    assert.doesNotMatch(fonte, /^\s*import\s/m, "shared/safescore/guia.ts não pode importar nada");
  });
});
