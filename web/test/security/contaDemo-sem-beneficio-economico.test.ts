import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * `contaDemo` NUNCA concede benefício econômico.
 *
 * Ela ignora dois gates e só esses dois: verificação (KYC) e restrição
 * geográfica. Não libera plano pago, não pula paywall, não concede crédito,
 * não altera limite de uso.
 *
 * A tentação é real e chega pelo caminho mais razoável do mundo: "o revisor da
 * loja precisa ver a experiência de assinante". A resposta é o sandbox da
 * própria loja (Apple Sandbox / Google License Testing), nunca uma flag no
 * banco — uma flag que libera plano é indistinguível de um plano de graça, e
 * quem a receber por engano deixa de pagar sem que nada apareça no faturamento.
 */
describe("contaDemo não concede benefício econômico", () => {
  beforeEach(() => resetMockPrisma());

  it("checkFeatureAccess devolve o MESMO resultado com e sem contaDemo", async () => {
    const { checkFeatureAccess } = await import("../../src/lib/featureGate");

    async function medir(contaDemo: boolean) {
      resetMockPrisma();
      // Sem assinatura: plano FREE.
      mockPrisma.subscription.findUnique = async () => null;
      mockPrisma.user.findUnique = async () => ({
        id: "u1",
        role: "EMPREGADOR",
        contaDemo,
      });
      mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
      mockPrisma.servico.count = async () => 5;

      return checkFeatureAccess("u1", "SOLICITACOES_MES");
    }

    const comum = await medir(false);
    const demo = await medir(true);

    assert.deepEqual(demo, comum, "a conta demo recebeu tratamento diferente no gate de plano");
    // E o resultado tem de ser o do plano gratuito estourado: se a flag
    // liberasse, `allowed` viraria true e o teste acima passaria por igualdade
    // errada nos dois lados.
    assert.equal(comum.allowed, false);
    assert.equal(comum.plan, "FREE");
    assert.equal(comum.limit, 5);
  });

  it("contaDemo no limite do plano não muda nada", async () => {
    const { checkFeatureAccess } = await import("../../src/lib/featureGate");

    resetMockPrisma();
    mockPrisma.subscription.findUnique = async () => null;
    mockPrisma.user.findUnique = async () => ({ id: "u2", role: "DIARISTA", contaDemo: true });
    mockPrisma.featureLimit.findUnique = async () => ({ limit: 5, enabled: true });
    mockPrisma.servico.count = async () => 2;

    const r = await checkFeatureAccess("u2", "SOLICITACOES_MES");
    assert.equal(r.plan, "FREE", "conta demo não pode receber plano pago");
    assert.equal(r.limit, 5, "conta demo não pode receber limite maior");
  });

  it("nenhum módulo de plano/cobrança conhece contaDemo", () => {
    // A garantia de comportamento acima só cobre o caminho que o teste
    // percorre. Esta é a que cobre o resto: se alguém acrescentar um desvio
    // por contaDemo em qualquer lugar do faturamento, isto quebra.
    const modulos = [
      "src/lib/featureGate.ts",
      "src/lib/subscription.ts",
      "src/lib/billing.ts",
      "src/lib/stripe.ts",
      "src/lib/planos.ts",
      "src/app/api/webhooks/stripe/route.ts",
    ];

    const infratores: string[] = [];
    for (const rel of modulos) {
      const caminho = join(process.cwd(), rel);
      if (!existsSync(caminho)) continue;
      if (readFileSync(caminho, "utf8").includes("contaDemo")) infratores.push(rel);
    }

    assert.deepEqual(
      infratores,
      [],
      `contaDemo não pode aparecer em módulo de plano/cobrança: ${infratores.join(", ")}`,
    );
  });

  it("contaDemo só é lida onde deve: KYC de busca e bairro de serviço", () => {
    // Documenta os DOIS portões, e falha se aparecer um terceiro. Se o novo
    // uso for legítimo, esta lista é o lugar de dizer isso em voz alta.
    const permitidos = [
      "src/lib/contaDemo.ts",
      "src/lib/autoVerificacaoGuard.ts", // só cita no texto do erro
      "src/app/api/diaristas/buscar/route.ts",
      "src/app/api/montadores/buscar/route.ts",
      "src/app/api/servicos/route.ts",
    ].sort();

    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const saida = execSync("grep -rl contaDemo src --include=*.ts --include=*.tsx || true", {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    const achados = saida.split("\n").map((l) => l.trim()).filter(Boolean).sort();
    assert.deepEqual(
      achados,
      permitidos,
      "contaDemo apareceu em arquivo novo — confirme que não é benefício econômico e atualize a lista",
    );
  });
});
