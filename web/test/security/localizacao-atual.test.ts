import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { cidadeEhNomeDeEstado, sinaisDaLocalizacaoAtual, ufValida } from "../../src/lib/localizacaoBrasil";

describe("sinais de localização atual gravada errada (município e UF)", () => {
  it("Água Boa–MA com área Água Boa–MT: mesma cidade, outra UF, e UF de corte", () => {
    assert.deepEqual(
      sinaisDaLocalizacaoAtual({ atual: { cidade: "Água Boa", estado: "MA" }, area: { cidade: "Agua Boa", estado: "MT" } }),
      ["MESMA_CIDADE_OUTRA_UF", "UF_DE_CORTE_DIVERGENTE"],
    );
  });

  it("par correto não acusa nada; cidade diferente da área com UF própria também não", () => {
    assert.deepEqual(sinaisDaLocalizacaoAtual({ atual: { cidade: "Água Boa", estado: "MT" }, area: { cidade: "Água Boa", estado: "MT" } }), []);
    assert.deepEqual(sinaisDaLocalizacaoAtual({ atual: { cidade: "Cuiabá", estado: "MT" }, area: { cidade: "Água Boa", estado: "MT" } }), []);
    // Profissional que está mesmo no Maranhão, com área no Maranhão: nada.
    assert.deepEqual(sinaisDaLocalizacaoAtual({ atual: { cidade: "São Luís", estado: "MA" }, area: { cidade: "São Luís", estado: "MA" } }), []);
  });

  it("endereço cadastrado também serve de referência", () => {
    const s = sinaisDaLocalizacaoAtual({
      atual: { cidade: "Curitiba", estado: "PA" },
      area: { cidade: null, estado: null },
      endereco: { cidade: "Curitiba", uf: "PR" },
    });
    assert.deepEqual(s, ["MESMA_CIDADE_OUTRA_UF", "UF_DE_CORTE_DIVERGENTE"]);
  });

  it("UF inexistente (MI, SA, RI) e cidade que é nome de estado", () => {
    assert.deepEqual(sinaisDaLocalizacaoAtual({ atual: { cidade: "Belo Horizonte", estado: "MI" }, area: { cidade: null, estado: null } }), ["UF_INVALIDA"]);
    assert.deepEqual(sinaisDaLocalizacaoAtual({ atual: { cidade: "Mato Grosso", estado: "MT" }, area: { cidade: null, estado: null } }), ["CIDADE_E_NOME_DE_ESTADO"]);
  });

  it("validações usadas na gravação", () => {
    assert.equal(ufValida("mt"), true);
    assert.equal(ufValida("MI"), false);
    assert.equal(ufValida("SÃ"), false);
    assert.equal(cidadeEhNomeDeEstado("Mato Grosso"), true);
    assert.equal(cidadeEhNomeDeEstado("Água Boa"), false);
  });
});

async function getPATCH() {
  const mod = await import("../../src/app/api/me/localizacao/route");
  return mod.PATCH;
}

function patch(body: unknown) {
  return new Request("http://test/api/me/localizacao", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...makeAuthHeaders("u-dia", "DIARISTA") },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/me/localizacao — não grava município/UF impossíveis", () => {
  beforeEach(() => resetMockPrisma());

  for (const [caso, body] of [
    ["UF inexistente (corte de 'Minas Gerais')", { cidade: "Belo Horizonte", estado: "MI", localizacaoPermitida: true }],
    ["nome de estado como cidade", { cidade: "Mato Grosso", estado: "MT", localizacaoPermitida: true }],
  ] as const) {
    it(`recusa ${caso} sem tocar no perfil`, async () => {
      mockPrisma.user.findUnique = async () => ({ id: "u-dia", status: "ATIVO" });
      let gravou = false;
      mockPrisma.diaristaProfile.upsert = async () => {
        gravou = true;
        return {};
      };
      const PATCH = await getPATCH();
      const res = await PATCH(patch(body));
      assert.equal(res.status, 400);
      assert.equal(gravou, false);
    });
  }

  it("controle: município e UF válidos passam da validação e chegam à gravação", async () => {
    mockPrisma.user.findUnique = async () => ({ id: "u-dia", status: "ATIVO" });
    let gravado: any = null;
    mockPrisma.diaristaProfile.upsert = async (args: any) => {
      gravado = args.update;
      return { cidadeAtual: args.update.cidadeAtual, estadoAtual: args.update.estadoAtual, bairroAtual: null, localizacaoPermitida: true, localizacaoAtualizadaEm: new Date() };
    };
    const PATCH = await getPATCH();
    await PATCH(patch({ cidade: "Água Boa", estado: "mt", localizacaoPermitida: true }));
    assert.equal(gravado?.cidadeAtual, "Água Boa");
    assert.equal(gravado?.estadoAtual, "MT");
  });
});
