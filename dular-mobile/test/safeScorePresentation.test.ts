import assert from "node:assert/strict";
import test from "node:test";
import { getSafeScoreEmblemState } from "../src/lib/safeScorePresentation";
import type { SafeScoreOverview } from "../src/api/safeScoreOverviewApi";

function overview(overrides: Partial<SafeScoreOverview> = {}): SafeScoreOverview {
  return {
    status: "Confiável", mensagem: "Histórico registrado", restrito: false,
    reputation: { faixa: "Confiável", tier: "GOLD", nivel: "Ouro", status: "Confiável", mensagem: "Histórico registrado", bloqueado: false, restrito: false },
    totalServicos: 1, identidade: "VERIFICADO", guide: [], ...overrides,
  };
}

test("escudo não anuncia verificação sem dados ou sem cálculo", () => {
  assert.equal(getSafeScoreEmblemState(null), "unavailable");
  assert.equal(getSafeScoreEmblemState(overview({ reputation: null })), "unavailable");
});

test("restrição prevalece sobre identidade verificada e até sobre cálculo ausente", () => {
  assert.equal(getSafeScoreEmblemState(overview({ restrito: true })), "restricted");
  assert.equal(getSafeScoreEmblemState(overview({ restrito: true, reputation: null })), "restricted");
  const blocked = overview();
  blocked.reputation!.bloqueado = true;
  assert.equal(getSafeScoreEmblemState(blocked), "restricted");
});

test("observação tem símbolo de atenção mesmo com identidade aprovada", () => {
  assert.equal(getSafeScoreEmblemState(overview({ status: "Em Observação" })), "observation");
});

test("check só aparece com identidade aprovada e sem observação ou restrição", () => {
  assert.equal(getSafeScoreEmblemState(overview()), "verified");
  for (const identidade of ["PENDENTE", "NAO_ENVIADO", "REPROVADO"] as const) {
    assert.equal(getSafeScoreEmblemState(overview({ identidade })), "neutral");
  }
});

// Conta sem cálculo (sem registro de SafeScore): textos aprovados, sem
// "indisponível" no título, no status nem no nível. A tela usa react-native
// (não roda no node), então os textos são conferidos no fonte.
test("sem cálculo: título, status e nível com os textos aprovados", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const fonte = readFileSync(join(import.meta.dirname, "..", "src", "screens", "perfil", "SafeScoreView.tsx"), "utf8");
  assert.match(fonte, /unavailable \? "Sem histórico\\nde reputação"/);
  assert.match(fonte, /data\.status \?\? "Ainda não calculado"/);
  assert.match(fonte, /reputation\?\.nivel \?\? "Ainda não calculado"/);
  assert.doesNotMatch(fonte, /\?\? "Indisponível"/);
  // Serviços e identidade continuam vindo dos dados reais.
  assert.match(fonte, /\{data\.totalServicos\}/);
  assert.match(fonte, /IDENTITY_LABELS\[data\.identidade\]/);
});
