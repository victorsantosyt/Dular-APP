import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  descricaoDoMotivoGrave,
  linkDoMapa,
  motivoGraveLegivel,
  origemDoSos,
  prioridadeNaFila,
  statusDoSos,
  textoDoMeta,
} from "../../src/lib/sosPainel";

/**
 * Regras de exibição do SOS no painel (lib/sosPainel.ts): status dos SOS
 * antigos, origem (botão × motivo grave), prioridade na fila de risco e os
 * textos do selo.
 */

const DO_BOTAO = { tipo: "Emergência 190", mensagem: "Botão de emergência", prioridade: "CRITICA" };
const DE_MOTIVO_GRAVE = {
  motivo: "problema_seguranca",
  observacao: "relato",
  acao: "CANCELADO",
  reportedUserId: "u1",
};

describe("sosPainel — regras de exibição do SOS", () => {
  it("status nulo (SOS anterior à coluna) conta como ACIONADO", () => {
    assert.equal(statusDoSos(null), "ACIONADO");
    assert.equal(statusDoSos(undefined), "ACIONADO");
    assert.equal(statusDoSos("RESOLVIDO"), "RESOLVIDO");
  });

  it("origem: meta.motivo presente é motivo grave; ausente, vazio ou meta nulo é o botão", () => {
    assert.equal(origemDoSos(DE_MOTIVO_GRAVE), "MOTIVO_GRAVE");
    assert.equal(origemDoSos(DO_BOTAO), "BOTAO");
    assert.equal(origemDoSos(null), "BOTAO");
    assert.equal(origemDoSos({ motivo: "   " }), "BOTAO");
  });

  it("prioridade na fila de risco: botão CRITICA, motivo grave ALTA", () => {
    assert.equal(prioridadeNaFila(DO_BOTAO), "CRITICA");
    assert.equal(prioridadeNaFila(null), "CRITICA");
    assert.equal(prioridadeNaFila(DE_MOTIVO_GRAVE), "ALTA");
  });

  it("selo do motivo grave: motivo legível e ação", () => {
    assert.equal(motivoGraveLegivel(DE_MOTIVO_GRAVE), "Problema de segurança");
    assert.equal(descricaoDoMotivoGrave(DE_MOTIVO_GRAVE), "Problema de segurança · ao cancelar");
    assert.equal(
      descricaoDoMotivoGrave({ motivo: "comportamento_inadequado", acao: "RECUSADO" }),
      "Comportamento inadequado · ao recusar",
    );
    // Motivo desconhecido aparece cru, sem inventar rótulo; ação ausente some da linha.
    assert.equal(descricaoDoMotivoGrave({ motivo: "motivo_novo" }), "motivo_novo");
    assert.equal(descricaoDoMotivoGrave(DO_BOTAO), null);
  });

  it("textoDoMeta ignora valor que não é texto, texto vazio e meta que não é objeto", () => {
    assert.equal(textoDoMeta({ tipo: " Emergência 190 " }, "tipo"), "Emergência 190");
    assert.equal(textoDoMeta({ tipo: 190 }, "tipo"), null);
    assert.equal(textoDoMeta({ tipo: "" }, "tipo"), null);
    assert.equal(textoDoMeta(["tipo"], "tipo"), null);
    assert.equal(textoDoMeta("tipo", "tipo"), null);
  });

  it("link do mapa só com as duas coordenadas (0 é coordenada válida)", () => {
    assert.equal(linkDoMapa(-14.05, -52.16), "https://www.google.com/maps/search/?api=1&query=-14.05,-52.16");
    assert.equal(linkDoMapa(0, 0), "https://www.google.com/maps/search/?api=1&query=0,0");
    assert.equal(linkDoMapa(null, -52.16), null);
    assert.equal(linkDoMapa(-14.05, null), null);
  });
});
