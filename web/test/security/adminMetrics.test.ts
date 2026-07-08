import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBetaMetrics,
  inicioDaSemana,
  mediana,
  type EventoRow,
  type ProfissionalRow,
  type ServicoRow,
} from "../../src/lib/adminMetrics";

// Quarta-feira 2026-07-08 11:00 no fuso do piloto (América/Cuiabá, UTC-4).
const AGORA = new Date("2026-07-08T15:00:00Z");
// Segunda-feira 00:00 local da semana corrente = 04:00 UTC.
const SEMANA_CORRENTE = new Date("2026-07-06T04:00:00Z");
const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

function servico(over: Partial<ServicoRow> & { id: string }): ServicoRow {
  return {
    createdAt: new Date(AGORA.getTime() - 10 * DIA_MS),
    status: "SOLICITADO",
    diaristaId: null,
    montadorId: null,
    paymentStatus: "WAITING_PAYMENT",
    ...over,
  };
}

function evento(servicoId: string, toStatus: EventoRow["toStatus"], createdAt: Date): EventoRow {
  return { servicoId, toStatus, createdAt };
}

function compute(
  servicos: ServicoRow[],
  eventos: EventoRow[] = [],
  profissionais: ProfissionalRow[] = [],
) {
  return computeBetaMetrics({ servicos, eventos, profissionais, agora: AGORA });
}

describe("adminMetrics — inicioDaSemana (fuso do piloto, UTC-4)", () => {
  it("quarta-feira cai na segunda 00:00 local (04:00 UTC)", () => {
    assert.equal(inicioDaSemana(AGORA).getTime(), SEMANA_CORRENTE.getTime());
  });

  it("segunda 03:59 UTC ainda é domingo local → semana anterior", () => {
    const r = inicioDaSemana(new Date("2026-07-06T03:59:00Z"));
    assert.equal(r.toISOString(), "2026-06-29T04:00:00.000Z");
  });

  it("segunda 04:00 UTC é a virada exata da semana local", () => {
    const r = inicioDaSemana(new Date("2026-07-06T04:00:00Z"));
    assert.equal(r.toISOString(), "2026-07-06T04:00:00.000Z");
  });

  it("domingo local pertence à semana iniciada na segunda anterior", () => {
    // Domingo 2026-07-12 20:00 local = 2026-07-13T00:00Z
    const r = inicioDaSemana(new Date("2026-07-13T00:00:00Z"));
    assert.equal(r.getTime(), SEMANA_CORRENTE.getTime());
  });
});

describe("adminMetrics — mediana", () => {
  it("vazio → null", () => assert.equal(mediana([]), null));
  it("ímpar → elemento central", () => assert.equal(mediana([10, 1, 2]), 2));
  it("par → média dos centrais", () => assert.equal(mediana([5, 1]), 3));
});

describe("adminMetrics — North Star (concluídos por semana)", () => {
  it("bucketiza por semana local, 8 semanas, mais antiga primeiro", () => {
    const servicos = [servico({ id: "a" }), servico({ id: "b" }), servico({ id: "c" })];
    const eventos = [
      evento("a", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS)),
      evento("b", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() + 2 * DIA_MS)),
      evento("c", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() - 3 * DIA_MS)),
    ];
    const m = compute(servicos, eventos);
    assert.equal(m.semanas.length, 8);
    assert.equal(m.semanas[0].inicio.getTime(), SEMANA_CORRENTE.getTime() - 7 * SEMANA_MS);
    assert.equal(m.semanas[7].concluidos, 2);
    assert.equal(m.semanas[6].concluidos, 1);
    assert.equal(m.northStar.semanaAtual, 2);
    assert.equal(m.northStar.semanaAnterior, 1);
    assert.equal(m.northStar.variacaoPct, 100);
    assert.equal(m.semanas[7].rotulo, "06/07");
  });

  it("conclusão conta UMA vez, na data do PRIMEIRO evento terminal", () => {
    const eventos = [
      // FINALIZADO (avaliação) nesta semana, mas o CONCLUIDO foi semana passada.
      evento("a", "FINALIZADO", new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS)),
      evento("a", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() - 2 * DIA_MS)),
    ];
    const m = compute([servico({ id: "a" })], eventos);
    assert.equal(m.northStar.semanaAtual, 0);
    assert.equal(m.northStar.semanaAnterior, 1);
    assert.equal(m.totalConcluidos, 1);
  });

  it("totalConcluidos vem dos eventos (independe do status atual do serviço)", () => {
    // Admin cancelou à força um serviço já concluído: o evento de conclusão fica.
    const servicos = [servico({ id: "a", status: "CANCELADO" })];
    const eventos = [evento("a", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS))];
    const m = compute(servicos, eventos);
    assert.equal(m.totalConcluidos, 1);
    assert.equal(m.northStar.semanaAtual, 1);
    assert.equal(compute([servico({ id: "x" })]).totalConcluidos, 0);
  });

  it("variação indefinida (semana anterior = 0) → null", () => {
    const eventos = [evento("a", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS))];
    const m = compute([servico({ id: "a" })], eventos);
    assert.equal(m.northStar.variacaoPct, null);
  });
});

describe("adminMetrics — liquidez (28 dias)", () => {
  it("aceite por evento, por status e exclusões (RASCUNHO, fora da janela)", () => {
    const servicos = [
      servico({ id: "semAceite", status: "SOLICITADO" }),
      servico({ id: "aceitoEvt", status: "SOLICITADO" }),
      servico({ id: "aceitoStatus", status: "EM_ANDAMENTO" }),
      servico({ id: "rascunho", status: "RASCUNHO" }),
      servico({ id: "velho", status: "CONCLUIDO", createdAt: new Date(AGORA.getTime() - 40 * DIA_MS) }),
      servico({ id: "canceladoAposAceite", status: "CANCELADO" }),
    ];
    const eventos = [
      evento("aceitoEvt", "ACEITO", new Date(AGORA.getTime() - 9 * DIA_MS)),
      evento("canceladoAposAceite", "ACEITO", new Date(AGORA.getTime() - 8 * DIA_MS)),
    ];
    const m = compute(servicos, eventos);
    assert.equal(m.liquidez.solicitados, 4);
    assert.equal(m.liquidez.aceitos, 3);
    assert.equal(m.liquidez.pct, 75);
  });

  it("sem solicitados na janela → pct null", () => {
    const m = compute([servico({ id: "velho", createdAt: new Date(AGORA.getTime() - 60 * DIA_MS) })]);
    assert.equal(m.liquidez.pct, null);
  });
});

describe("adminMetrics — retenção de profissionais (2 últimas semanas fechadas)", () => {
  const W1 = new Date(SEMANA_CORRENTE.getTime() - 2 * SEMANA_MS + 1 * DIA_MS); // base
  const W2 = new Date(SEMANA_CORRENTE.getTime() - 1 * SEMANA_MS + 1 * DIA_MS); // retorno

  it("retido = ativo nas duas semanas; semana corrente (parcial) não entra", () => {
    const servicos = [
      servico({ id: "a1", diaristaId: "profA" }),
      servico({ id: "a2", montadorId: "profA" }), // volta como montador — mesma pessoa
      servico({ id: "b1", diaristaId: "profB" }),
      servico({ id: "c1", diaristaId: "profC" }), // só na semana corrente
    ];
    const eventos = [
      evento("a1", "CONCLUIDO", W1),
      evento("a2", "CONCLUIDO", W2),
      evento("b1", "CONCLUIDO", W1),
      evento("c1", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS)),
    ];
    const m = compute(servicos, eventos);
    assert.equal(m.retencao.ativosSemanaBase, 2);
    assert.equal(m.retencao.retidos, 1);
    assert.equal(m.retencao.pct, 50);
  });

  it("sem ativos na semana-base → pct null", () => {
    const m = compute([servico({ id: "a" })], [
      evento("a", "CONCLUIDO", new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS)),
    ]);
    assert.equal(m.retencao.pct, null);
    assert.equal(m.retencao.ativosSemanaBase, 0);
  });
});

describe("adminMetrics — tempo cadastro → 1º serviço concluído", () => {
  it("mediana em dias sobre profissionais com conclusão; sem conclusão fica fora", () => {
    const cadastroA = new Date(SEMANA_CORRENTE.getTime() - 12 * DIA_MS);
    const cadastroB = new Date(SEMANA_CORRENTE.getTime() - 22 * DIA_MS);
    const servicos = [
      servico({ id: "a1", diaristaId: "profA" }),
      servico({ id: "b1", montadorId: "profB" }),
    ];
    const eventos = [
      // profA: 1ª conclusão 10 dias após o cadastro (2ª conclusão não conta)
      evento("a1", "CONCLUIDO", new Date(cadastroA.getTime() + 10 * DIA_MS)),
      evento("a1", "FINALIZADO", new Date(cadastroA.getTime() + 15 * DIA_MS)),
      // profB: 20 dias
      evento("b1", "CONCLUIDO", new Date(cadastroB.getTime() + 20 * DIA_MS)),
    ];
    const profissionais: ProfissionalRow[] = [
      { id: "profA", createdAt: cadastroA },
      { id: "profB", createdAt: cadastroB },
      { id: "profSemServico", createdAt: cadastroA },
    ];
    const m = compute(servicos, eventos, profissionais);
    assert.equal(m.tempoCadastroPrimeiroServico.amostra, 2);
    assert.equal(m.tempoCadastroPrimeiroServico.medianaDias, 15);
  });

  it("sem amostra → null", () => {
    const m = compute([], [], [{ id: "p", createdAt: AGORA }]);
    assert.equal(m.tempoCadastroPrimeiroServico.medianaDias, null);
    assert.equal(m.tempoCadastroPrimeiroServico.amostra, 0);
  });
});

describe("adminMetrics — pagamentos dos serviços concluídos", () => {
  it("conta por paymentStatus apenas serviços concluídos", () => {
    const quando = new Date(SEMANA_CORRENTE.getTime() + 1 * DIA_MS);
    const servicos = [
      servico({ id: "c1", status: "CONCLUIDO", paymentStatus: "PAYMENT_CONFIRMED" }),
      servico({ id: "c2", status: "FINALIZADO", paymentStatus: "PAYMENT_DISPUTED" }),
      servico({ id: "c3", status: "CONCLUIDO", paymentStatus: "PAYMENT_REPORTED" }),
      servico({ id: "c4", status: "CONCLUIDO", paymentStatus: "WAITING_PAYMENT" }),
      // Em andamento: não entra na contagem de pagamentos.
      servico({ id: "x1", status: "EM_ANDAMENTO", paymentStatus: "WAITING_PAYMENT" }),
    ];
    const eventos = [evento("c1", "CONCLUIDO", quando)];
    const m = compute(servicos, eventos);
    assert.deepEqual(m.pagamentos, { aguardando: 1, informados: 1, confirmados: 1, contestados: 1 });
  });
});
