import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dobrarEventosStripe, type BaseStripe, type EstadoStripe, type EventoCicloStripe } from "../../src/lib/assinatura";

/**
 * A dobra que decide o estado da assinatura Stripe: base + CONJUNTO de eventos
 * guardados. Função pura, sem banco: para cada conjunto, TODAS as permutações
 * têm de dar o mesmo estado — é isso que faz A→B→A, B→A e entregas simultâneas
 * terminarem iguais. A ordem considera o período e a fatura de cada evento,
 * nunca o id `evt_`. A mesma regra contra Postgres real:
 * stripe-assinatura-ordem-db.test.ts.
 */

const d = (iso: string) => new Date(iso);
const pago = (fatura: string | null, criado: string, fim: string | null): EventoCicloStripe => ({
  tipo: "invoice.paid",
  criadoEm: d(criado),
  fimPeriodo: fim === null ? null : d(fim),
  faturaId: fatura,
});
const falhou = (fatura: string | null, criado: string, fim: string | null): EventoCicloStripe => ({
  tipo: "invoice.payment_failed",
  criadoEm: d(criado),
  fimPeriodo: fim === null ? null : d(fim),
  faturaId: fatura,
});
const excluida = (criado: string): EventoCicloStripe => ({
  tipo: "customer.subscription.deleted",
  criadoEm: d(criado),
  fimPeriodo: null,
  faturaId: null,
});

const T = "2026-10-03T03:36:31Z"; // o mesmo segundo para os empates
const P1 = "2026-11-03T03:36:31Z"; // fim do período vigente (fatura antiga)
const P2 = "2026-12-03T03:36:31Z"; // fim do período seguinte (fatura nova)
const P3 = "2027-01-03T03:36:31Z";
const BASE: EstadoStripe = { status: "ACTIVE", expiresAt: d("2026-11-03T03:36:32Z"), canceledAt: null };

function permutacoes<T>(itens: readonly T[]): T[][] {
  if (itens.length <= 1) return [[...itens]];
  return itens.flatMap((x, i) => permutacoes([...itens.slice(0, i), ...itens.slice(i + 1)]).map((resto) => [x, ...resto]));
}
const fatorial = (n: number): number => (n <= 1 ? 1 : n * fatorial(n - 1));

type Caso = { nome: string; base?: BaseStripe; eventos: EventoCicloStripe[]; esperado: EstadoStripe };

// Conjuntos da v2, agora com a fatura e o período de cada evento.
const casosV2: Caso[] = [
  {
    nome: "paga e falha de faturas diferentes do mesmo período, no mesmo segundo: falha fechado",
    eventos: [pago("in_a", T, P2), falhou("in_b", T, P2)],
    esperado: { status: "EXPIRED", expiresAt: d(T), canceledAt: d(T) },
  },
  {
    nome: "falha e exclusão no mesmo segundo: cortada e cancelada",
    eventos: [falhou("in_a", T, P2), excluida(T)],
    esperado: { status: "CANCELED", expiresAt: d(T), canceledAt: d(T) },
  },
  {
    nome: "paga e exclusão no mesmo segundo: cancelada, vale até o fim pago",
    eventos: [pago("in_a", T, P2), excluida(T)],
    esperado: { status: "CANCELED", expiresAt: d(P2), canceledAt: d(T) },
  },
  {
    nome: "duas faturas pagas no mesmo segundo, períodos diferentes: vale o fim mais longe",
    eventos: [pago("in_a", T, P1), pago("in_b", T, P2)],
    esperado: { status: "ACTIVE", expiresAt: d(P2), canceledAt: null },
  },
  {
    nome: "duas falhas de faturas diferentes no mesmo segundo: um corte só",
    eventos: [falhou("in_a", T, P2), falhou("in_b", T, P2)],
    esperado: { status: "EXPIRED", expiresAt: d(T), canceledAt: d(T) },
  },
  {
    nome: "falha e nova tentativa paga da mesma fatura: ativa",
    eventos: [falhou("in_a", "2026-11-03T04:00:00Z", P2), pago("in_a", "2026-11-05T04:00:00Z", P2)],
    esperado: { status: "ACTIVE", expiresAt: d(P2), canceledAt: null },
  },
  {
    nome: "falha nunca paga e exclusão: o corte entra antes da exclusão",
    eventos: [excluida("2026-11-20T00:00:00Z"), falhou("in_a", "2026-11-03T04:00:00Z", P2)],
    esperado: { status: "CANCELED", expiresAt: d("2026-11-03T04:00:00Z"), canceledAt: d("2026-11-20T00:00:00Z") },
  },
  {
    nome: "fatura paga depois da exclusão não reativa (exclusão é aplicada por último)",
    eventos: [excluida("2026-11-20T00:00:00Z"), pago("in_b", "2026-11-21T00:00:00Z", P2)],
    esperado: { status: "CANCELED", expiresAt: d(P2), canceledAt: d("2026-11-20T00:00:00Z") },
  },
  {
    nome: "fatura paga sem fim de período: ativa e mantém a validade",
    base: { status: "EXPIRED", expiresAt: d("2026-10-01T00:00:00Z"), canceledAt: d("2026-10-01T00:00:00Z") },
    eventos: [pago("in_a", T, null)],
    esperado: { status: "ACTIVE", expiresAt: d("2026-10-01T00:00:00Z"), canceledAt: null },
  },
  {
    nome: "ciclo inteiro com duplicatas: renovação, falha, nova tentativa paga, exclusão",
    eventos: [
      pago("in_1", T, P1),
      pago("in_1", T, P1),
      pago("in_2", P1, P2),
      falhou("in_3", P2, P3),
      falhou("in_3", P2, P3),
      pago("in_3", "2026-12-05T00:00:00Z", P3),
      excluida("2026-12-20T00:00:00Z"),
    ],
    esperado: { status: "CANCELED", expiresAt: d(P3), canceledAt: d("2026-12-20T00:00:00Z") },
  },
  {
    nome: "seis eventos no MESMO segundo, de todos os tipos e três períodos",
    eventos: [
      pago("in_a", T, null),
      pago("in_b", T, P1),
      pago("in_c", T, P2),
      falhou("in_c", T, P2),
      falhou("in_d", T, P2),
      excluida(T),
    ],
    esperado: { status: "CANCELED", expiresAt: d(T), canceledAt: d(T) },
  },
];

// A lacuna da v2 e as consequências da v3.
const casosV3: Caso[] = [
  {
    nome: "falha da fatura ANTIGA e paga da MAIS NOVA no mesmo segundo: ativa até o período novo",
    eventos: [falhou("in_antiga", T, P1), pago("in_nova", T, P2)],
    esperado: { status: "ACTIVE", expiresAt: d(P2), canceledAt: null },
  },
  {
    nome: "paga da fatura antiga e falha do período NOVO no mesmo segundo: corte em created",
    eventos: [pago("in_antiga", T, P1), falhou("in_nova", T, P2)],
    esperado: { status: "EXPIRED", expiresAt: d(T), canceledAt: d(T) },
  },
  {
    nome: "mesma fatura falhou e foi paga no MESMO segundo: ativa",
    eventos: [falhou("in_a", T, P2), pago("in_a", T, P2)],
    esperado: { status: "ACTIVE", expiresAt: d(P2), canceledAt: null },
  },
  {
    nome: "duas faturas do mesmo período, uma paga e a outra só falhou: corte na primeira falha",
    eventos: [pago("in_a", T, P2), falhou("in_b", "2026-10-03T04:36:31Z", P2), falhou("in_b", "2026-10-05T04:36:31Z", P2)],
    esperado: { status: "EXPIRED", expiresAt: d("2026-10-03T04:36:31Z"), canceledAt: d("2026-10-03T04:36:31Z") },
  },
  {
    nome: "falha de período antigo em segundo POSTERIOR à paga do período novo: sem efeito",
    eventos: [pago("in_nova", T, P2), falhou("in_antiga", "2026-10-10T00:00:00Z", P1)],
    esperado: { status: "ACTIVE", expiresAt: d(P2), canceledAt: null },
  },
  {
    nome: "fatura avulsa paga com período anterior ao vigente não encurta a validade",
    eventos: [pago("in_vigente", T, P2), pago("in_avulsa", "2026-10-10T00:00:00Z", P1)],
    esperado: { status: "ACTIVE", expiresAt: d(P2), canceledAt: null },
  },
  {
    nome: "evento sem faturaId é fatura própria: a falha dele deixa o período em aberto",
    eventos: [pago(null, T, P2), falhou(null, T, P2)],
    esperado: { status: "EXPIRED", expiresAt: d(T), canceledAt: d(T) },
  },
  {
    nome: "três períodos com tentativas cruzadas no mesmo segundo",
    eventos: [
      falhou("in_1", T, P1),
      pago("in_1", T, P1),
      falhou("in_2", T, P2),
      pago("in_2", T, P2),
      falhou("in_3", T, P3),
    ],
    esperado: { status: "EXPIRED", expiresAt: d(T), canceledAt: d(T) },
  },
];

// Base LEGADA (linha anterior à mudança): o estado já reflete as faturas até o
// expiresAt que ela tinha. Fatura com período até ali é ignorada; depois dele, a
// regra normal; exclusão sempre.
const L = "2026-11-10T00:00:00Z"; // expiresAt legado = período reconhecido
const HISTORICO = "2026-10-10T00:00:00Z"; // período já pago antes da mudança
const NOVO = "2026-12-10T00:00:00Z"; // período seguinte ao legado
const C = "2026-10-20T00:00:00Z"; // corte de um legado EXPIRED
const LEGADA: BaseStripe = { status: "ACTIVE", expiresAt: d(L), canceledAt: null, legado: { periodoReconhecido: d(L) } };
const LEGADA_EXPIRADA: BaseStripe = { status: "EXPIRED", expiresAt: d(C), canceledAt: d(C), legado: { periodoReconhecido: d(C) } };
const ESTADO_LEGADO: EstadoStripe = { status: "ACTIVE", expiresAt: d(L), canceledAt: null };

const casosLegado: Caso[] = [
  {
    nome: "paga histórica não reduz a validade legada",
    base: LEGADA,
    eventos: [pago("in_hist", "2026-09-10T00:00:00Z", HISTORICO)],
    esperado: ESTADO_LEGADO,
  },
  {
    nome: "paga sem período: já refletida no legado",
    base: LEGADA,
    eventos: [pago("in_sem", T, null)],
    esperado: ESTADO_LEGADO,
  },
  {
    nome: "fatura com período IGUAL ao reconhecido: já refletida",
    base: LEGADA,
    eventos: [falhou("in_igual", "2026-10-11T00:00:00Z", L)],
    esperado: ESTADO_LEGADO,
  },
  {
    nome: "falha histórica: nada",
    base: LEGADA,
    eventos: [falhou("in_hist", "2026-10-10T01:00:00Z", HISTORICO)],
    esperado: ESTADO_LEGADO,
  },
  {
    nome: "paga de período novo: estende",
    base: LEGADA,
    eventos: [pago("in_novo", L, NOVO)],
    esperado: { status: "ACTIVE", expiresAt: d(NOVO), canceledAt: null },
  },
  {
    nome: "falha de período novo: corta",
    base: LEGADA,
    eventos: [falhou("in_novo", "2026-11-10T01:00:00Z", NOVO)],
    esperado: { status: "EXPIRED", expiresAt: d("2026-11-10T01:00:00Z"), canceledAt: d("2026-11-10T01:00:00Z") },
  },
  {
    nome: "exclusão: CANCELED com a validade legada mantida",
    base: LEGADA,
    eventos: [excluida("2026-10-20T00:00:00Z")],
    esperado: { status: "CANCELED", expiresAt: d(L), canceledAt: d("2026-10-20T00:00:00Z") },
  },
  {
    nome: "histórica paga × nova paga: estende",
    base: LEGADA,
    eventos: [pago("in_hist", "2026-09-10T00:00:00Z", HISTORICO), pago("in_novo", L, NOVO)],
    esperado: { status: "ACTIVE", expiresAt: d(NOVO), canceledAt: null },
  },
  {
    nome: "histórica paga × falha do período novo: corta",
    base: LEGADA,
    eventos: [pago("in_hist", "2026-09-10T00:00:00Z", HISTORICO), falhou("in_novo", "2026-11-10T01:00:00Z", NOVO)],
    esperado: { status: "EXPIRED", expiresAt: d("2026-11-10T01:00:00Z"), canceledAt: d("2026-11-10T01:00:00Z") },
  },
  {
    nome: "tudo junto: histórica paga e falhada, nova falhou e foi paga, exclusão",
    base: LEGADA,
    eventos: [
      pago("in_hist", "2026-09-10T00:00:00Z", HISTORICO),
      falhou("in_hist2", "2026-10-01T00:00:00Z", HISTORICO),
      falhou("in_novo", "2026-11-10T01:00:00Z", NOVO),
      pago("in_novo", "2026-11-12T00:00:00Z", NOVO),
      excluida("2026-11-20T00:00:00Z"),
    ],
    esperado: { status: "CANCELED", expiresAt: d(NOVO), canceledAt: d("2026-11-20T00:00:00Z") },
  },
  {
    nome: "legado EXPIRED + paga de período posterior ao corte: reativa",
    base: LEGADA_EXPIRADA,
    eventos: [pago("in_novo", "2026-10-21T00:00:00Z", NOVO)],
    esperado: { status: "ACTIVE", expiresAt: d(NOVO), canceledAt: null },
  },
  {
    nome: "legado EXPIRED + paga histórica: nada",
    base: LEGADA_EXPIRADA,
    eventos: [pago("in_hist", "2026-10-21T00:00:00Z", HISTORICO)],
    esperado: { status: "EXPIRED", expiresAt: d(C), canceledAt: d(C) },
  },
  {
    nome: "legado sem validade (periodoReconhecido nulo): regra normal",
    base: { status: "ACTIVE", expiresAt: null, canceledAt: null, legado: { periodoReconhecido: null } },
    eventos: [pago("in_hist", "2026-09-10T00:00:00Z", HISTORICO)],
    esperado: { status: "ACTIVE", expiresAt: d(HISTORICO), canceledAt: null },
  },
];

describe("dobra dos eventos de assinatura Stripe — função pura", () => {
  for (const [grupo, casos] of [["v2", casosV2], ["v3", casosV3], ["legado", casosLegado]] as const) {
    for (const { nome, base = BASE, eventos, esperado } of casos) {
      it(`${grupo} — ${nome}: todas as ${fatorial(eventos.length)} permutações dão o estado esperado`, () => {
        const todas = permutacoes(eventos);
        assert.equal(todas.length, fatorial(eventos.length));
        for (const ordem of todas) {
          assert.deepEqual(
            dobrarEventosStripe(base, ordem),
            esperado,
            `ordem: ${ordem.map((e) => `${e.tipo}/${e.faturaId}`).join(" → ")}`,
          );
        }
      });
    }
  }

  it("sem eventos, o estado é a base", () => {
    assert.deepEqual(dobrarEventosStripe(BASE, []), BASE);
  });

  it("devolve só o estado: a marca de legado não vaza para a linha", () => {
    assert.deepEqual(dobrarEventosStripe(LEGADA, []), ESTADO_LEGADO);
  });

  it("a fronteira do legado vale só para base legada: a mesma paga histórica reduz uma base comum", () => {
    const comum: BaseStripe = { status: "ACTIVE", expiresAt: d(L), canceledAt: null };
    assert.deepEqual(dobrarEventosStripe(comum, [pago("in_hist", "2026-09-10T00:00:00Z", HISTORICO)]), {
      status: "ACTIVE",
      expiresAt: d(HISTORICO),
      canceledAt: null,
    });
  });

  it("não altera a base nem a lista recebida", () => {
    const base = structuredClone(BASE);
    const eventos = [excluida(T), falhou("in_a", T, P2), pago("in_b", T, P2)];
    const copia = structuredClone(eventos);
    dobrarEventosStripe(base, eventos);
    assert.deepEqual(base, BASE);
    assert.deepEqual(eventos, copia, "a ordem de quem chamou não muda");
  });

  it("o id do evento não entra na ordem: ids trocados, mesmo estado", () => {
    const a = { ...falhou("in_antiga", T, P1), eventId: "evt_zzz" };
    const b = { ...pago("in_nova", T, P2), eventId: "evt_aaa" };
    const trocados = [
      { ...a, eventId: "evt_aaa" },
      { ...b, eventId: "evt_zzz" },
    ];
    assert.deepEqual(dobrarEventosStripe(BASE, [a, b]), dobrarEventosStripe(BASE, trocados));
    assert.deepEqual(dobrarEventosStripe(BASE, [b, a]), { status: "ACTIVE", expiresAt: d(P2), canceledAt: null });
  });
});
