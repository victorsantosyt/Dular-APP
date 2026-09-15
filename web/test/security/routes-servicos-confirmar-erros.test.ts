import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";

/**
 * POST /api/servicos/[id]/confirmar — o que sai quando a transação falha por
 * algo que não é o CAS de status.
 *
 * Os dois caminhos novos do `catch`: com o serviço já fora de CONCLUIDO (outra
 * requisição confirmou), é conflito de concorrência, 409, com aviso no log;
 * com o serviço ainda em CONCLUIDO, é erro de servidor, 500 com mensagem
 * genérica, e o erro do Prisma só no log.
 */

const SERVICO = { id: "srv-1", clientId: "emp-1", diaristaId: "dia-1", montadorId: null, status: "CONCLUIDO" };
const ERRO_PRISMA =
  "Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 6078 ms passed";

async function confirmar() {
  const { POST } = await import("../../src/app/api/servicos/[id]/confirmar/route");
  const res = await POST(
    new Request("http://test/api/servicos/srv-1/confirmar", {
      method: "POST",
      headers: makeAuthHeaders("emp-1", "EMPREGADOR"),
    }),
    { params: Promise.resolve({ id: "srv-1" }) },
  );
  return { status: res.status, body: await res.json() };
}

async function capturando<T>(metodo: "error" | "warn", fn: () => Promise<T>) {
  const original = console[metodo];
  const chamadas: unknown[][] = [];
  console[metodo] = (...args: unknown[]) => {
    chamadas.push(args);
  };
  try {
    return { resultado: await fn(), chamadas };
  } finally {
    console[metodo] = original;
  }
}

describe("confirmar — falha na transação que não é o CAS", () => {
  let leiturasDoServico = 0;
  let statusNaReconsulta = "CONCLUIDO";

  beforeEach(() => {
    resetMockPrisma();
    leiturasDoServico = 0;
    // 1ª leitura: a da rota, antes da transação. 2ª: a reconsulta do catch.
    mockPrisma.servico.findUnique = async () => {
      leiturasDoServico += 1;
      return leiturasDoServico === 1 ? { ...SERVICO } : { status: statusNaReconsulta };
    };
  });

  it("serviço já confirmado por outra requisição: 409, com aviso no log", async () => {
    statusNaReconsulta = "CONFIRMADO";
    mockPrisma.$transaction = async () => {
      throw new Error(ERRO_PRISMA);
    };

    const { resultado, chamadas } = await capturando("warn", confirmar);

    assert.equal(resultado.status, 409, JSON.stringify(resultado.body));
    assert.equal(resultado.body.error, "Serviço não está mais aguardando confirmação.");
    const avisos = chamadas.filter((a) => String(a[0]).includes("[confirmar]"));
    assert.equal(avisos.length, 1, "a espera de trava que estourou não pode ficar invisível");
    assert.deepEqual(avisos[0][1], { servicoId: "srv-1", statusAtual: "CONFIRMADO", erroOriginal: ERRO_PRISMA });
  });

  it("serviço ainda em CONCLUIDO: 500 genérico, e o erro do Prisma só no log", async () => {
    statusNaReconsulta = "CONCLUIDO";
    mockPrisma.$transaction = async () => {
      throw new Error(ERRO_PRISMA);
    };

    const { resultado, chamadas } = await capturando("error", confirmar);

    assert.equal(resultado.status, 500);
    assert.deepEqual(resultado.body, { ok: false, error: "Não foi possível confirmar o serviço. Tente novamente." });
    assert.doesNotMatch(JSON.stringify(resultado.body), /transaction|expired|prisma|5000/i);

    const erros = chamadas.filter((a) => String(a[0]).includes("[confirmar] erro inesperado"));
    assert.equal(erros.length, 1);
    const contexto = erros[0][1] as { servicoId: string; error: Error };
    assert.equal(contexto.servicoId, "srv-1");
    assert.equal(contexto.error.message, ERRO_PRISMA);
  });

  it("CAS perdido continua 409 direto, sem reconsultar o status", async () => {
    mockPrisma.$transaction = async () => {
      throw new Error("INVALID_STATUS");
    };

    const r = await confirmar();

    assert.equal(r.status, 409);
    assert.equal(leiturasDoServico, 1);
  });
});
