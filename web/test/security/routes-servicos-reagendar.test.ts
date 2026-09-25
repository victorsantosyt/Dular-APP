import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

/**
 * Sugestão de horário antes do aceite (estilo corrida já em andamento): a
 * profissional recebe o pedido perto do fim de outro serviço e propõe outro
 * horário. A proposta NÃO aceita o pedido — confirmada, só move a data, e o
 * aceite continua passando por /aceitar (onde ficam os gates de plano).
 */
async function rota() {
  return import("../../src/app/api/servicos/[id]/reagendar/route");
}

const EMPREGADOR = "u-empregador";
const DIARISTA = "u-diarista";
const params = { params: Promise.resolve({ id: "svc-1" }) };
const amanha = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function servico(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: "svc-1",
    status,
    clientId: EMPREGADOR,
    diaristaId: DIARISTA,
    montadorId: null,
    reagendamentoData: null,
    reagendamentoTurno: null,
    reagendamentoHora: null,
    reagendamentoPor: null,
    ...extra,
  };
}

function propor(corpo: unknown, userId = DIARISTA) {
  return jsonRequest("http://test/api/servicos/svc-1/reagendar", corpo, makeAuthHeaders(userId, "DIARISTA"));
}

describe("POST /reagendar — sugestão antes do aceite", () => {
  let gravado: Record<string, unknown> | null;
  beforeEach(() => {
    resetMockPrisma();
    gravado = null;
    mockPrisma.servico.update = async (args: { data: Record<string, unknown> }) => {
      gravado = args.data;
      return { id: "svc-1", ...args.data };
    };
  });

  it("pedido SOLICITADO aceita a sugestão e NÃO muda o status", async () => {
    mockPrisma.servico.findUnique = async () => servico("SOLICITADO");
    const { POST } = await rota();
    const res = await POST(propor({ data: `${amanha}T00:00:00.000Z`, turno: "TARDE", hora: "16:00" }), params);
    assert.equal(res.status, 200);
    assert.ok(gravado);
    assert.equal(gravado!.reagendamentoHora, "16:00");
    assert.equal(gravado!.reagendamentoTurno, "TARDE");
    assert.ok(!("status" in gravado!), "a proposta não pode aceitar o pedido");
  });

  it("data no passado é recusada", async () => {
    mockPrisma.servico.findUnique = async () => servico("SOLICITADO");
    const { POST } = await rota();
    const res = await POST(propor({ data: "2020-01-01T00:00:00.000Z", turno: "MANHA" }), params);
    assert.equal(res.status, 400);
    assert.equal(gravado, null);
  });

  it("pedido já recusado continua fora (409)", async () => {
    mockPrisma.servico.findUnique = async () => servico("RECUSADO");
    const { POST } = await rota();
    const res = await POST(propor({ data: `${amanha}T00:00:00.000Z`, turno: "MANHA" }), params);
    assert.equal(res.status, 409);
  });

  it("quem não é o profissional do pedido não propõe (403)", async () => {
    mockPrisma.servico.findUnique = async () => servico("SOLICITADO");
    const { POST } = await rota();
    const res = await POST(propor({ data: `${amanha}T00:00:00.000Z`, turno: "MANHA" }, "u-outra"), params);
    assert.equal(res.status, 403);
  });
});

describe("PATCH /reagendar — empregador decide a sugestão", () => {
  let gravado: Record<string, unknown> | null;
  beforeEach(() => {
    resetMockPrisma();
    gravado = null;
    mockPrisma.servico.update = async (args: { data: Record<string, unknown> }) => {
      gravado = args.data;
      return { id: "svc-1", ...args.data };
    };
  });

  const pendente = () =>
    servico("SOLICITADO", {
      reagendamentoData: new Date(`${amanha}T00:00:00.000Z`),
      reagendamentoTurno: "TARDE",
      reagendamentoHora: "16:00",
      reagendamentoPor: DIARISTA,
    });

  it("confirmar move data e hora, e o pedido segue SOLICITADO", async () => {
    mockPrisma.servico.findUnique = async () => pendente();
    const { PATCH } = await rota();
    const res = await PATCH(
      jsonRequest("http://test/api/servicos/svc-1/reagendar", { aceitar: true }, makeAuthHeaders(EMPREGADOR, "EMPREGADOR")),
      params,
    );
    assert.equal(res.status, 200);
    assert.equal(gravado!.hora, "16:00");
    assert.equal(gravado!.turno, "TARDE");
    assert.equal(gravado!.reagendamentoData, null);
    assert.ok(!("status" in gravado!));
  });

  it("recusar só limpa a proposta: o pedido continua aberto no horário original", async () => {
    mockPrisma.servico.findUnique = async () => pendente();
    const { PATCH } = await rota();
    const res = await PATCH(
      jsonRequest("http://test/api/servicos/svc-1/reagendar", { aceitar: false }, makeAuthHeaders(EMPREGADOR, "EMPREGADOR")),
      params,
    );
    assert.equal(res.status, 200);
    assert.equal(gravado!.reagendamentoData, null);
    assert.ok(!("data" in gravado!) && !("status" in gravado!));
  });
});
