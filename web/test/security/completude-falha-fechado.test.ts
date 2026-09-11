import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDiaristaProfileCompleteness,
  type DiaristaProfileForCompleteness,
} from "../../src/lib/diaristaProfile";

/** Perfil que passa em tudo, para isolar a variável `status`. */
function perfilCompleto(
  user: DiaristaProfileForCompleteness["user"],
): DiaristaProfileForCompleteness {
  return {
    ativo: true,
    bio: "Faço faxina há dez anos.",
    servicosOferecidos: ["diarista"],
    cidade: "Água Boa",
    estado: "MT",
    atendeTodaCidade: true,
    raioAtendimentoKm: null,
    precoLeve: 12000,
    precoMedio: 15000,
    precoPesada: 18000,
    precoBabaHora: 3000,
    precoCozinheiraBase: 10000,
    taxaMinima: 8000,
    valorACombinar: false,
    bairros: [{ id: "b1" }],
    user,
  };
}

describe("getDiaristaProfileCompleteness — status falha fechado", () => {
  // CONTROLE POSITIVO. Sem ele, um perfil que reprova por qualquer outro
  // motivo faria os casos abaixo passarem sem provar nada sobre o status.
  it("ATIVO com o resto completo é aprovado", () => {
    const r = getDiaristaProfileCompleteness(perfilCompleto({ nome: "Maria", status: "ATIVO" }));
    assert.equal(r.completo, true, `motivos inesperados: ${r.motivos.join(", ")}`);
  });

  it("BLOQUEADO reprova com usuario_bloqueado", () => {
    const r = getDiaristaProfileCompleteness(perfilCompleto({ nome: "Maria", status: "BLOQUEADO" }));
    assert.equal(r.completo, false);
    assert.ok(r.motivos.includes("usuario_bloqueado"));
  });

  it("REMOVIDO reprova com conta_removida", () => {
    const r = getDiaristaProfileCompleteness(perfilCompleto({ nome: "Maria", status: "REMOVIDO" }));
    assert.equal(r.completo, false);
    assert.ok(r.motivos.includes("conta_removida"));
  });

  // O bug corrigido: `profile.user?.status && ...` fazia curto-circuito e
  // deixava estes casos passarem como perfil completo, aparecendo na busca.
  for (const [rotulo, user] of [
    ["status null", { nome: "Maria", status: null }],
    ["user null (perfil consultado sem selecionar user)", null],
  ] as const) {
    it(`reprova com status_indeterminado quando ${rotulo}`, () => {
      const r = getDiaristaProfileCompleteness(
        perfilCompleto(user as DiaristaProfileForCompleteness["user"]),
      );
      assert.equal(r.completo, false, "status indeterminado não pode passar como completo");
      assert.ok(
        r.motivos.includes("status_indeterminado"),
        `motivos: ${r.motivos.join(", ")}`,
      );
    });
  }

  // Um valor novo no enum não deve virar "aprovado" por omissão.
  it("status desconhecido reprova em vez de passar", () => {
    const r = getDiaristaProfileCompleteness(
      perfilCompleto({ nome: "Maria", status: "SUSPENSO_TEMPORARIO" }),
    );
    assert.equal(r.completo, false);
    assert.ok(r.motivos.includes("status_indeterminado"));
  });
});
