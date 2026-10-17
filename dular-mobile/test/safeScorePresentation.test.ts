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

// Acentos suavizados só no SafeScore: saturação menor no roxo e no rosa,
// verde e neutro intactos, texto de destaque com contraste ≥ 4,5:1 em todos
// os fundos da tela (cartão, fundo tingido e fundo da tela).
test("acentos suavizados mantêm contraste e só mexem nos temas saturados", async () => {
  const { suavizarTemaSafeScore, fundosDoTexto, contraste, saturacao, CONTRASTE_MINIMO } = await import("../src/lib/safeScorePresentation");
  const { getProfileTheme } = await import("../src/theme/profileTheme");
  const temas = {
    lavanda: getProfileTheme({ role: "EMPREGADOR" }),
    feminino: getProfileTheme({ role: "DIARISTA", genero: "FEMININO" }),
    masculino: getProfileTheme({ role: "MONTADOR", genero: "MASCULINO" }),
    neutro: getProfileTheme({ role: "DIARISTA" }),
  };
  for (const [nome, base] of Object.entries(temas)) {
    const suave = suavizarTemaSafeScore(base);
    for (const fundo of fundosDoTexto(base)) {
      assert.ok(contraste(suave.textAccent, fundo) >= CONTRASTE_MINIMO, `${nome}: contraste ${contraste(suave.textAccent, fundo).toFixed(2)} sobre ${fundo}`);
    }
    assert.equal(suave.background, base.background, `${nome}: fundo não muda`);
    assert.equal(suave.primarySoft, base.primarySoft, `${nome}: tom claro não muda`);
  }
  for (const nome of ["lavanda", "feminino"] as const) {
    assert.ok(saturacao(suavizarTemaSafeScore(temas[nome]).primary) < saturacao(temas[nome].primary), `${nome}: menos saturado`);
  }
  for (const nome of ["masculino", "neutro"] as const) {
    assert.deepEqual(suavizarTemaSafeScore(temas[nome]), temas[nome], `${nome}: inalterado`);
  }
});
