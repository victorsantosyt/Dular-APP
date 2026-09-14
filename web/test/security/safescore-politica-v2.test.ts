import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Prisma, ScoreEventoTipo, type IncidenteGravidade } from "@prisma/client";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { EVENT_TYPE_V2, aplicarEvento, resolverPeso } from "../../src/lib/safeScore";
import { applyEvent, pesoDaPolitica } from "../../src/lib/safeScore/applyEvent";

/**
 * Política V2 1.1.0 x legado (lib/safeScore.ts).
 *
 * A política testada é a da MIGRATION, lida do arquivo — é o que chega ao
 * banco. Uma cópia dos pesos aqui dentro provaria só que o teste concorda
 * consigo mesmo.
 */

function lerPoliticaDaMigration(): Record<string, unknown> {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  const pasta = fs.readdirSync(dir).find((d) => d.endsWith("_safescore_politica_1_1_0"));
  if (!pasta) throw new Error("migration *_safescore_politica_1_1_0 não encontrada");
  const sql = fs.readFileSync(path.join(dir, pasta, "migration.sql"), "utf8");
  const bloco = sql.match(/\$pesos\$([\s\S]*?)\$pesos\$/);
  if (!bloco) throw new Error("bloco $pesos$ não encontrado na migration");
  return JSON.parse(bloco[1]);
}

const POLITICA = lerPoliticaDaMigration();

const GRADUADOS: ScoreEventoTipo[] = ["AVALIACAO_POSITIVA", "AVALIACAO_NEGATIVA", "DENUNCIA_CONFIRMADA"];

describe("política 1.1.0 — conteúdo", () => {
  it("é exatamente a política aprovada", () => {
    assert.deepEqual(POLITICA, {
      avaliacao_positiva: { "5": 15, "4": 8, "3": 0 },
      avaliacao_negativa: { "3": 0, "2": -10, "1": -20 },
      servico_concluido: 5,
      tempo_plataforma: 3,
      kyc_aprovado: 50,
      kyc_rejeitado: -20,
      denuncia_confirmada: { BAIXA: -30, MEDIA: -80, ALTA: -150, CRITICA: -300 },
      denuncia_arquivada: 10,
      cancelamento_tardio: -15,
      no_show: -25,
      checkin_realizado: 5,
      incidente_aberto: -50,
      motivo_problema_seguranca: 0,
      motivo_comportamento_inadequado: 0,
    });
  });

  it("todo tipo do enum legado tem chave própria na política", () => {
    const chaves = Object.values(ScoreEventoTipo).map((t) => EVENT_TYPE_V2[t]);
    for (const chave of chaves) assert.ok(chave in POLITICA, `sem chave na política: ${chave}`);
    // Sem colisão: antes NO_SHOW caía em cancelamento_tardio e TEMPO_PLATAFORMA
    // em servico_concluido, com o peso do outro evento.
    assert.equal(new Set(chaves).size, chaves.length, "dois tipos legados na mesma chave");
  });
});

describe("V2 1.1.0 = legado, tipo a tipo", () => {
  for (const tipo of Object.values(ScoreEventoTipo).filter((t) => !GRADUADOS.includes(t))) {
    it(`${tipo}: peso fixo igual nos dois ledgers`, () => {
      const { peso, parametro } = resolverPeso(tipo);
      assert.equal(parametro, undefined);
      assert.equal(pesoDaPolitica(POLITICA, EVENT_TYPE_V2[tipo]), peso);
    });
  }

  it("KYC_REJEITADO vale -20 nos dois", () => {
    assert.equal(resolverPeso("KYC_REJEITADO").peso, -20);
    assert.equal(pesoDaPolitica(POLITICA, EVENT_TYPE_V2.KYC_REJEITADO), -20);
  });

  const ESPERADO_POR_NOTA: Record<"AVALIACAO_POSITIVA" | "AVALIACAO_NEGATIVA", Record<number, number>> = {
    AVALIACAO_POSITIVA: { 1: 0, 2: 0, 3: 0, 4: 8, 5: 15 },
    AVALIACAO_NEGATIVA: { 1: -20, 2: -10, 3: 0, 4: 0, 5: 0 },
  };

  for (const tipo of ["AVALIACAO_POSITIVA", "AVALIACAO_NEGATIVA"] as const) {
    for (const nota of [1, 2, 3, 4, 5]) {
      it(`${tipo} nota ${nota} → ${ESPERADO_POR_NOTA[tipo][nota]}`, () => {
        const { peso, parametro } = resolverPeso(tipo, { nota });
        assert.equal(peso, ESPERADO_POR_NOTA[tipo][nota], "legado");
        assert.equal(pesoDaPolitica(POLITICA, EVENT_TYPE_V2[tipo], parametro), ESPERADO_POR_NOTA[tipo][nota], "V2");
      });
    }

    // Fora do domínio que as rotas aceitam (int 1..5), mas o legado tem regra
    // para isso: nota ausente vale 0. O V2 tem que dar o mesmo número.
    for (const nota of [undefined, Number.NaN, 0, 4.5, 6]) {
      it(`${tipo} nota ${String(nota)}: V2 igual ao legado`, () => {
        const { peso, parametro } = resolverPeso(tipo, { nota });
        assert.equal(pesoDaPolitica(POLITICA, EVENT_TYPE_V2[tipo], parametro), peso);
      });
    }
  }

  const ESPERADO_POR_GRAVIDADE: Record<IncidenteGravidade, number> = {
    BAIXA: -30,
    MEDIA: -80,
    ALTA: -150,
    CRITICA: -300,
  };
  for (const gravidade of Object.keys(ESPERADO_POR_GRAVIDADE) as IncidenteGravidade[]) {
    it(`DENUNCIA_CONFIRMADA ${gravidade} → ${ESPERADO_POR_GRAVIDADE[gravidade]}`, () => {
      const { peso, parametro } = resolverPeso("DENUNCIA_CONFIRMADA", { gravidade });
      assert.equal(peso, ESPERADO_POR_GRAVIDADE[gravidade], "legado");
      assert.equal(pesoDaPolitica(POLITICA, "denuncia_confirmada", parametro), ESPERADO_POR_GRAVIDADE[gravidade], "V2");
    });
  }

  it("DENUNCIA_CONFIRMADA sem gravidade cai em MEDIA nos dois", () => {
    const { peso, parametro } = resolverPeso("DENUNCIA_CONFIRMADA");
    assert.equal(peso, -80);
    assert.equal(parametro, "MEDIA");
    assert.equal(pesoDaPolitica(POLITICA, "denuncia_confirmada", parametro), -80);
  });
});

describe("pesoDaPolitica — formato número | {parametro: peso}", () => {
  it("chave ausente → 0", () => assert.equal(pesoDaPolitica(POLITICA, "nao_existe"), 0));
  it("graduado sem parâmetro → 0", () => assert.equal(pesoDaPolitica(POLITICA, "denuncia_confirmada"), 0));
  it("parâmetro que o objeto não tem → 0", () =>
    assert.equal(pesoDaPolitica(POLITICA, "denuncia_confirmada", "GRAVISSIMA"), 0));
  it("não lê propriedade herdada", () =>
    assert.equal(pesoDaPolitica(POLITICA, "denuncia_confirmada", "toString"), 0));
  it("política ausente ou inválida → 0", () => {
    assert.equal(pesoDaPolitica(null, "kyc_aprovado"), 0);
    assert.equal(pesoDaPolitica("x", "kyc_aprovado"), 0);
  });
});

// ── Replay dos 33 eventos reais ─────────────────────────────────────────────

type EventoReal = {
  usuario: string;
  tipo: ScoreEventoTipo;
  pesoLegado: number;
  referencia: string;
  nota?: number;
  gravidade?: IncidenteGravidade;
};

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "test/security/fixtures/safescore-eventos-locais.json"), "utf8"),
) as { total: number; eventos: EventoReal[] };

describe("replay dos eventos reais do banco local contra a 1.1.0", () => {
  it("são os 33 eventos exportados", () => {
    assert.equal(FIXTURE.eventos.length, 33);
    assert.equal(FIXTURE.total, 33);
  });

  it("evento a evento: o peso V2 é o peso que o legado gravou", () => {
    for (const e of FIXTURE.eventos) {
      const { peso, parametro } = resolverPeso(e.tipo, { nota: e.nota, gravidade: e.gravidade });
      assert.equal(peso, e.pesoLegado, `resolver não reproduz o histórico: ${JSON.stringify(e)}`);
      assert.equal(
        pesoDaPolitica(POLITICA, EVENT_TYPE_V2[e.tipo], parametro),
        e.pesoLegado,
        `V2 diverge do legado: ${JSON.stringify(e)}`,
      );
    }
  });

  it("total por usuário: V2 = legado, descontada só a repetição do mesmo fato", () => {
    const legado = new Map<string, number>();
    const v2 = new Map<string, number>();
    const vistos = new Set<string>();
    const repeticoes: EventoReal[] = [];

    for (const e of FIXTURE.eventos) {
      legado.set(e.usuario, (legado.get(e.usuario) ?? 0) + e.pesoLegado);
      // Mesma composição da chave de idempotência de aplicarEvento.
      const chave = `${e.usuario}:${e.tipo}:${e.referencia}`;
      if (vistos.has(chave)) {
        repeticoes.push(e);
        continue;
      }
      vistos.add(chave);
      const { parametro } = resolverPeso(e.tipo, { nota: e.nota, gravidade: e.gravidade });
      v2.set(e.usuario, (v2.get(e.usuario) ?? 0) + pesoDaPolitica(POLITICA, EVENT_TYPE_V2[e.tipo], parametro));
    }

    // O caso real: KYC aprovado duas vezes para o mesmo documento, 5 s de
    // diferença. O legado somou +100; o V2, com chave determinística, +50.
    assert.equal(repeticoes.length, 1);
    assert.equal(repeticoes[0].tipo, "KYC_APROVADO");
    assert.equal(repeticoes[0].pesoLegado, 50);

    for (const [usuario, totalLegado] of legado) {
      const repetido = repeticoes.filter((r) => r.usuario === usuario).reduce((s, r) => s + r.pesoLegado, 0);
      assert.equal(v2.get(usuario), totalLegado - repetido, `total divergente para ${usuario}`);
    }
  });
});

// ── Chave de idempotência e parâmetro passados pelo aplicarEvento ───────────

describe("aplicarEvento → applyEvent", () => {
  let chaves: string[];
  let criados: Array<Record<string, any>>;
  let legado: Array<Record<string, any>>;
  let usuariosAtualizados: Array<Record<string, any>>;
  let score: number;

  beforeEach(() => {
    resetMockPrisma();
    chaves = [];
    criados = [];
    legado = [];
    usuariosAtualizados = [];
    score = 500;
    const m = mockPrisma as any;
    // O `$transaction` do mock central entrega ao callback o objeto em que foi
    // criado, não o singleton que este teste configura abaixo.
    m.$transaction = async (cb: any) => (typeof cb === "function" ? cb(m) : Promise.all(cb));
    m.avaliacao = { findUnique: async () => null };
    m.incidentReport = { findUnique: async () => null };
    m.safeScore.upsert = async () => ({ id: "ss-1", score: 500 });
    m.safeScore.update = async (args: any) => ({ id: "ss-1", score: args.data.score });
    m.scoreEvento = {
      create: async (args: any) => {
        legado.push(args.data);
        return {};
      },
      findUnique: async () => null,
    };
    m.user.update = async (args: any) => {
      usuariosAtualizados.push(args.data);
      return {};
    };
    m.safeScorePolicyVersion = { findFirst: async () => ({ id: "policy_v1_1_0", weights: POLITICA }) };
    m.safeScoreProfile.createMany = async () => ({ count: 1 });
    m.safeScoreProfile.update = async (args: any) => {
      const c = args.data.currentScore;
      score = typeof c === "object" ? score + c.increment : c;
      return { currentScore: score };
    };
    m.safeScoreEvent = {
      create: async (args: any) => {
        chaves.push(args.data.idempotencyKey);
        criados.push(args.data);
        return {};
      },
      findUnique: async () => null,
    };
  });

  it("a mesma chamada gera a mesma chave, sem timestamp", async () => {
    await aplicarEvento("u-1", "KYC_APROVADO", "doc-1", "Documentos aprovados.");
    await aplicarEvento("u-1", "KYC_APROVADO", "doc-1", "Documentos aprovados.");
    assert.deepEqual(chaves, ["u-1:KYC_APROVADO:doc-1", "u-1:KYC_APROVADO:doc-1"]);
  });

  it("legado grava a chave do fato: tipo:referência, sem-ref quando falta", async () => {
    await aplicarEvento("u-1", "KYC_APROVADO", "doc-1");
    await aplicarEvento("u-1", "TEMPO_PLATAFORMA");
    assert.deepEqual(
      legado.map((d) => d.chaveIdempotencia),
      ["KYC_APROVADO:doc-1", "TEMPO_PLATAFORMA:sem-ref"],
    );
  });

  it("legado: fato já contado não relança, não reaplica a suspensão e ainda passa pelo V2", async () => {
    const m = mockPrisma as any;
    m.scoreEvento.create = async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
    };
    m.safeScore.findUnique = async () => ({ id: "ss-1", score: 150 });
    m.scoreEvento.findUnique = async () => ({ id: "ja-contado" });

    const r = await aplicarEvento("u-1", "DENUNCIA_CONFIRMADA", "inc-1", "gravidade=CRITICA");

    assert.equal(r.score, 150);
    assert.ok(!usuariosAtualizados.some((d) => d.status === "BLOQUEADO"), "score < 200 repetido não pode suspender de novo");
    assert.deepEqual(chaves, ["u-1:DENUNCIA_CONFIRMADA:inc-1"], "o V2 ainda recebe a chamada, idempotente");
  });

  it("legado: P2002 que não é deste fato é relançado", async () => {
    const m = mockPrisma as any;
    m.scoreEvento.create = async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
    };
    m.safeScore.findUnique = async () => ({ id: "ss-1", score: 500 });
    m.scoreEvento.findUnique = async () => null;
    await assert.rejects(
      aplicarEvento("u-1", "KYC_APROVADO", "doc-1"),
      (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002",
    );
  });

  it("sem referência, a chave usa sem-ref", async () => {
    await aplicarEvento("u-1", "TEMPO_PLATAFORMA");
    assert.deepEqual(chaves, ["u-1:TEMPO_PLATAFORMA:sem-ref"]);
  });

  it("avaliação: o V2 recebe a faixa da nota e aplica o peso graduado", async () => {
    await aplicarEvento("u-1", "AVALIACAO_POSITIVA", "av-1", "nota=4");
    assert.equal(criados[0].eventType, "avaliacao_positiva");
    assert.equal(criados[0].delta, 8);
  });

  it("denúncia: o V2 recebe a gravidade e aplica o peso graduado", async () => {
    await aplicarEvento("u-1", "DENUNCIA_CONFIRMADA", "inc-1", "gravidade=CRITICA");
    assert.equal(criados[0].eventType, "denuncia_confirmada");
    assert.equal(criados[0].delta, -300);
  });

  it("P2002 da chave deste evento vira already_applied", async () => {
    const m = mockPrisma as any;
    m.safeScoreEvent.create = async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
    };
    m.safeScoreEvent.findUnique = async () => ({ id: "ja-existe" });
    const r = await applyEvent({ userId: "u-1", eventType: "kyc_aprovado", source: "t", idempotencyKey: "k" });
    assert.deepEqual(r, { status: "already_applied" });
  });

  it("P2002 de OUTRA unicidade não é engolido como sucesso", async () => {
    const m = mockPrisma as any;
    m.safeScoreEvent.create = async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
    };
    m.safeScoreEvent.findUnique = async () => null;
    await assert.rejects(
      applyEvent({ userId: "u-1", eventType: "kyc_aprovado", source: "t", idempotencyKey: "k" }),
      (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002",
    );
  });
});
