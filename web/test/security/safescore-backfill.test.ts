import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planejarBackfill,
  formatarRelatorio,
  scoreLidoHoje,
  scoreDepoisDoBackfill,
  type LinhaUsuario,
} from "../../src/lib/safeScore/backfill";

/**
 * Planejamento do backfill V2 ← legado (PR B, etapa 1). Puro: sem banco. A
 * execução real está em safescore-backfill-db.test.ts.
 */

function linha(p: Partial<LinhaUsuario> & { userId: string }): LinhaUsuario {
  return { scoreLegado: null, eventosLegado: 0, somaPesosLegado: 0, scoreV2: null, tierV2: null, ...p };
}

describe("planejarBackfill — ação por usuário", () => {
  it("legado sem perfil V2 → CRIAR com o score do legado", () => {
    const p = planejarBackfill([linha({ userId: "u", scoreLegado: 300, eventosLegado: 3, somaPesosLegado: -200 })]);
    assert.deepEqual(p.acoes[0], { userId: "u", acao: "CRIAR", de: null, para: 300, tierDe: null, tierPara: "BRONZE" });
  });

  it("V2 diferente do legado → ATUALIZAR para o legado, não para a soma dos eventos", () => {
    // O caso real "Montador QA Teste": legado 640, V2 650, eventos somam 20.
    const p = planejarBackfill([
      linha({ userId: "qa", scoreLegado: 640, eventosLegado: 2, somaPesosLegado: 20, scoreV2: 650, tierV2: "GOLD" }),
    ]);
    assert.equal(p.acoes[0].acao, "ATUALIZAR");
    assert.equal(p.acoes[0].para, 640);
    assert.equal(p.acoes[0].tierPara, "SILVER");
  });

  it("mesmo score mas tier errado → ATUALIZAR", () => {
    const p = planejarBackfill([linha({ userId: "t", scoreLegado: 700, somaPesosLegado: 200, scoreV2: 700, tierV2: "BRONZE" })]);
    assert.equal(p.acoes[0].acao, "ATUALIZAR");
  });

  it("V2 igual ao legado, tier certo → NADA", () => {
    const p = planejarBackfill([linha({ userId: "i", scoreLegado: 550, somaPesosLegado: 50, scoreV2: 550, tierV2: "SILVER" })]);
    assert.equal(p.acoes[0].acao, "NADA");
  });

  it("só V2, sem legado → SEM_LEGADO e o perfil não é tocado", () => {
    const p = planejarBackfill([linha({ userId: "v", scoreV2: 505, tierV2: "SILVER" })]);
    assert.deepEqual(p.acoes[0], { userId: "v", acao: "SEM_LEGADO", de: 505, para: 505, tierDe: "SILVER", tierPara: "SILVER" });
  });

  it("idempotente: planejar sobre o estado já semeado não gera ação", () => {
    const antes = [
      linha({ userId: "a", scoreLegado: 640, somaPesosLegado: 20, scoreV2: 650, tierV2: "GOLD" }),
      linha({ userId: "b", scoreLegado: 300, somaPesosLegado: -200 }),
    ];
    const plano = planejarBackfill(antes);
    const depois = antes.map((l) => {
      const a = plano.acoes.find((x) => x.userId === l.userId)!;
      return { ...l, scoreV2: a.para, tierV2: a.tierPara };
    });
    const segundo = planejarBackfill(depois);
    assert.equal(segundo.contagem.CRIAR + segundo.contagem.ATUALIZAR, 0);
  });
});

describe("planejarBackfill — relatório de divergências (legado × 500 + soma dos eventos)", () => {
  it("acha o ajuste manual do Montador QA Teste: +120", () => {
    const p = planejarBackfill([linha({ userId: "qa", scoreLegado: 640, eventosLegado: 2, somaPesosLegado: 20 })]);
    assert.deepEqual(p.divergencias, [
      { userId: "qa", scoreLegado: 640, esperadoPelosEventos: 520, diferenca: 120, eventos: 2, noLimite: false },
    ]);
  });

  it("não acusa quem bate com os eventos", () => {
    const p = planejarBackfill([linha({ userId: "ok", scoreLegado: 650, eventosLegado: 11, somaPesosLegado: 150 })]);
    assert.deepEqual(p.divergencias, []);
  });

  it("marca quando o score está no limite (0 ou 1000), onde o corte explica a diferença", () => {
    const p = planejarBackfill([linha({ userId: "z", scoreLegado: 0, eventosLegado: 3, somaPesosLegado: -900 })]);
    assert.equal(p.divergencias[0].noLimite, true);
    assert.equal(p.divergencias[0].diferenca, 400);
  });

  it("usuário só com V2 não entra nas divergências do legado", () => {
    const p = planejarBackfill([linha({ userId: "v", scoreV2: 505, tierV2: "SILVER" })]);
    assert.deepEqual(p.divergencias, []);
  });
});

describe("planejarBackfill — score_baixo que muda entre a leitura de hoje e a de depois", () => {
  it("leitura de hoje é V2 primeiro: legado 300 com perfil V2 505 é lido como 505 (não baixo)", () => {
    const l = linha({ userId: "x", scoreLegado: 300, somaPesosLegado: -200, scoreV2: 505, tierV2: "SILVER" });
    assert.equal(scoreLidoHoje(l), 505);
    assert.equal(scoreDepoisDoBackfill(l), 300);
    assert.deepEqual(planejarBackfill([l]).mudancasScoreBaixo, [
      { userId: "x", scoreHoje: 505, scoreDepois: 300, baixoHoje: false, baixoDepois: true },
    ]);
  });

  it("sem perfil V2 a leitura de hoje já é o legado: nada muda", () => {
    const p = planejarBackfill([linha({ userId: "y", scoreLegado: 300, somaPesosLegado: -200 })]);
    assert.deepEqual(p.mudancasScoreBaixo, []);
  });

  it("no limite exato: 400 não é baixo, 399 é", () => {
    const p = planejarBackfill([
      linha({ userId: "a", scoreLegado: 399, somaPesosLegado: -101, scoreV2: 400, tierV2: "SILVER" }),
      linha({ userId: "b", scoreLegado: 400, somaPesosLegado: -100, scoreV2: 399, tierV2: "BRONZE" }),
    ]);
    assert.deepEqual(
      p.mudancasScoreBaixo.map((m) => [m.userId, m.baixoHoje, m.baixoDepois]),
      [["a", false, true], ["b", true, false]],
    );
  });
});

describe("planejarBackfill — auditoria de quem a leitura de hoje trata diferente do legado", () => {
  const linhas = [
    // legado baixo, V2 ok: liberado por engano
    linha({ userId: "lib", scoreLegado: 300, somaPesosLegado: -200, scoreV2: 505, tierV2: "SILVER" }),
    // legado ok, V2 baixo: barrado por engano
    linha({ userId: "bar", scoreLegado: 600, somaPesosLegado: 100, scoreV2: 350, tierV2: "BRONZE" }),
    // igual nos dois
    linha({ userId: "ok", scoreLegado: 550, somaPesosLegado: 50, scoreV2: 550, tierV2: "SILVER" }),
  ];

  it("separa liberados e barrados por engano", () => {
    const p = planejarBackfill(linhas);
    assert.deepEqual(p.liberadosIndevidamente.map((m) => [m.userId, m.scoreDepois, m.scoreHoje]), [["lib", 300, 505]]);
    assert.deepEqual(p.bloqueadosIndevidamente.map((m) => [m.userId, m.scoreDepois, m.scoreHoje]), [["bar", 600, 350]]);
  });

  it("o relatório mostra as duas seções com a auditoria de cada usuário", () => {
    const p = planejarBackfill(linhas);
    const texto = formatarRelatorio(p, {
      host: "h",
      modo: "DRY-RUN",
      forense: [
        {
          userId: "lib",
          perfilV2CriadoEm: new Date("2026-09-14T03:30:00Z"),
          primeiroEventoV2Em: new Date("2026-09-14T03:30:00Z"),
          eventosV2: 1,
          servicosCriadosComoCliente: 2,
          servicosComoProfissional: 0,
        },
      ],
    }).join("\n");
    assert.match(texto, /LIBERADOS por engano .*: 1/);
    assert.match(texto, /lib\s+legado=300\s+lido hoje \(V2\)=505/);
    assert.match(texto, /perfil V2 desde 2026-09-14T03:30:00\.000Z .* serviços criados como cliente desde então=2/);
    assert.match(texto, /BARRADOS por engano .*: 1/);
  });
});

describe("planejarBackfill — distribuição e relatório", () => {
  it("conta faixas e tiers de hoje e de depois", () => {
    const p = planejarBackfill([
      linha({ userId: "a", scoreLegado: 640, somaPesosLegado: 20, scoreV2: 650, tierV2: "GOLD" }),
      linha({ userId: "b", scoreLegado: 150, somaPesosLegado: -350 }),
    ]);
    assert.deepEqual(p.tiers.hoje, { GOLD: 1, BRONZE: 1 });
    assert.deepEqual(p.tiers.depois, { SILVER: 1, BRONZE: 1 });
    assert.deepEqual(p.faixas.depois, { "Confiável": 1, Suspenso: 1 });
  });

  it("o relatório mostra host, modo, contagens, mudanças de score_baixo e divergências", () => {
    const p = planejarBackfill([
      linha({ userId: "qa", scoreLegado: 640, eventosLegado: 2, somaPesosLegado: 20, scoreV2: 650, tierV2: "GOLD" }),
    ]);
    const texto = formatarRelatorio(p, { host: "localhost", modo: "DRY-RUN" }).join("\n");
    assert.match(texto, /Banco: localhost\s+Modo: DRY-RUN/);
    assert.match(texto, /ATUALIZAR perfil V2: 1/);
    assert.match(texto, /Divergências SafeScore\.score × 500 \+ soma dos eventos: 1/);
    assert.match(texto, /qa\s+legado=640\s+esperado=520\s+diferença=\+120/);
    assert.match(texto, /score_baixo .* MUDA .*: 0/);
  });
});
