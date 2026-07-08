import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";
import { crc16ccitt } from "../../src/lib/pix";

// Rotas do pagamento PIX P2P (empregador → profissional).
// Segurança central: valor SEMPRE de Servico.precoFinal, TxId SEMPRE o id do
// serviço, chave SEMPRE do PaymentInfo do profissional — o body nunca decide.

async function getPaymentInfo() {
  const mod = await import("../../src/app/api/me/payment-info/route");
  return { GET: mod.GET, PUT: mod.PUT };
}
async function getGerarPix() {
  const mod = await import("../../src/app/api/servicos/[id]/pix/route");
  return mod.POST;
}
async function getCopiado() {
  const mod = await import("../../src/app/api/servicos/[id]/pix/copiado/route");
  return mod.POST;
}
async function getInformar() {
  const mod = await import("../../src/app/api/servicos/[id]/pagamento/informar/route");
  return mod.POST;
}
async function getConfirmar() {
  const mod = await import("../../src/app/api/servicos/[id]/pagamento/confirmar/route");
  return mod.POST;
}
async function getContestar() {
  const mod = await import("../../src/app/api/servicos/[id]/pagamento/contestar/route");
  return mod.POST;
}

const DONO = "u-empregador-dono";
const OUTRO_EMP = "u-empregador-outro";
const DIARISTA = "u-diarista";
const OUTRA_DIARISTA = "u-diarista-outra";
const SERVICO_ID = "svc-1";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function servicoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVICO_ID,
    status: "ACEITO",
    paymentStatus: "WAITING_PAYMENT",
    precoFinal: 15000,
    cidade: "Água Boa",
    tipo: "FAXINA",
    clientId: DONO,
    diaristaId: DIARISTA,
    montadorId: null,
    ...overrides,
  };
}

const PAYMENT_INFO = {
  pixType: "EMAIL",
  pixKey: "maria@dular.com.br",
  bank: "Banco X",
  holderName: "Maria José",
  updatedAt: new Date(),
};

describe("PUT/GET /api/me/payment-info", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem autenticação", async () => {
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest("http://test/api/me/payment-info", {
        pixType: "EMAIL",
        pixKey: "a@b.com",
        holderName: "Maria",
      }),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 para EMPREGADOR (recebimento é do profissional)", async () => {
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me/payment-info",
        { pixType: "EMAIL", pixKey: "a@b.com", holderName: "Maria" },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 400 para chave vazia", async () => {
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me/payment-info",
        { pixType: "EMAIL", pixKey: "", holderName: "Maria José" },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("retorna 400 para CPF inválido", async () => {
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me/payment-info",
        { pixType: "CPF", pixKey: "111.111.111-11", holderName: "Maria José" },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("retorna 400 para email inválido", async () => {
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me/payment-info",
        { pixType: "EMAIL", pixKey: "sem-arroba", holderName: "Maria José" },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("retorna 400 para celular inválido", async () => {
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me/payment-info",
        { pixType: "CELULAR", pixKey: "9999", holderName: "Maria José" },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("salva CPF válido normalizado (upsert imediato) e permite edição", async () => {
    let upsertArgs: any = null;
    mockPrisma.paymentInfo.upsert = async (args: any) => {
      upsertArgs = args;
      return { ...args.create, updatedAt: new Date() };
    };
    const { PUT } = await getPaymentInfo();
    const res = await PUT(
      jsonRequest(
        "http://test/api/me/payment-info",
        {
          pixType: "CPF",
          pixKey: "529.982.247-25",
          bank: "  Banco X  ",
          holderName: " Maria José ",
        },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
    );
    assert.equal(res.status, 200);
    assert.equal(upsertArgs.where.userId, DIARISTA);
    assert.equal(upsertArgs.create.pixKey, "52998224725");
    assert.equal(upsertArgs.create.bank, "Banco X");
    assert.equal(upsertArgs.create.holderName, "Maria José");
    // upsert => o mesmo endpoint edita um cadastro existente
    assert.deepEqual(upsertArgs.update, {
      pixType: "CPF",
      pixKey: "52998224725",
      bank: "Banco X",
      holderName: "Maria José",
    });
  });

  it("GET devolve null quando ainda não há cadastro", async () => {
    mockPrisma.paymentInfo.findUnique = async () => null;
    const { GET } = await getPaymentInfo();
    const res = await GET(
      new Request("http://test/api/me/payment-info", {
        headers: makeAuthHeaders(DIARISTA, "DIARISTA"),
      }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.paymentInfo, null);
  });
});

describe("POST /api/servicos/[id]/pix — geração", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem autenticação", async () => {
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(`http://test/api/servicos/${SERVICO_ID}/pix`, null),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 404 para serviço inexistente", async () => {
    mockPrisma.servico.findUnique = async () => null;
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(`http://test/api/servicos/x/pix`, null, makeAuthHeaders(DONO, "EMPREGADOR")),
      params("x"),
    );
    assert.equal(res.status, 404);
  });

  it("retorna 403 para empregador que não é dono do serviço", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(OUTRO_EMP, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 para o profissional (só o empregador paga)", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 409 para serviço ainda não contratado (SOLICITADO)", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase({ status: "SOLICITADO" });
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("retorna 409 para serviço cancelado (não ativo)", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase({ status: "CANCELADO" });
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("retorna 409 quando pagamento já foi confirmado", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_CONFIRMED" });
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("retorna 409 quando o profissional não tem chave PIX cadastrada", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    mockPrisma.paymentInfo.findUnique = async () => null;
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("gera o PIX com valor do precoFinal e TxId do serviço — ignorando o body", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    mockPrisma.paymentInfo.findUnique = async (args: any) => {
      assert.equal(args.where.userId, DIARISTA);
      return PAYMENT_INFO;
    };
    const eventos: any[] = [];
    mockPrisma.paymentEvent.create = async (args: any) => {
      eventos.push(args.data);
      return args.data;
    };
    const POST = await getGerarPix();
    // Tentativa maliciosa: body com valor forjado — o backend não lê o body.
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        { valorCentavos: 1, amountCents: 1, precoFinal: 1 },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    // Valor congelado do ticket, nunca do cliente.
    assert.equal(body.pix.valorCentavos, 15000);
    assert.ok(body.pix.copiaECola.includes("5406150.00"));
    // TxId = id do serviço (sanitizado p/ alfanumérico).
    assert.equal(body.pix.txid, SERVICO_ID);
    assert.ok(body.pix.copiaECola.includes("0504svc1"));
    // CRC do payload é válido.
    assert.equal(body.pix.copiaECola.slice(-4), crc16ccitt(body.pix.copiaECola.slice(0, -4)));
    // Chave nunca sai completa da API de geração (vai só dentro do payload EMV).
    assert.notEqual(body.pix.chaveMascarada, PAYMENT_INFO.pixKey);
    // Evento de auditoria registrado.
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].tipo, "PIX_GENERATED");
    assert.equal(eventos[0].actorId, DONO);
  });

  it("permite regenerar após contestação (PAYMENT_DISPUTED)", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_DISPUTED" });
    mockPrisma.paymentInfo.findUnique = async () => PAYMENT_INFO;
    mockPrisma.paymentEvent.create = async (args: any) => args.data;
    const POST = await getGerarPix();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
  });
});

describe("POST /api/servicos/[id]/pix/copiado", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 403 para quem não é o empregador do serviço", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const POST = await getCopiado();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix/copiado`,
        null,
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("registra o evento PIX_COPIED para o empregador", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const eventos: any[] = [];
    mockPrisma.paymentEvent.create = async (args: any) => {
      eventos.push(args.data);
      return args.data;
    };
    const POST = await getCopiado();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix/copiado`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    assert.equal(eventos[0].tipo, "PIX_COPIED");
  });
});

describe("POST /api/servicos/[id]/pagamento/informar", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 403 quando o profissional tenta informar", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const POST = await getInformar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/informar`,
        null,
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 409 quando já está PAYMENT_REPORTED", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    const POST = await getInformar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/informar`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("WAITING_PAYMENT → PAYMENT_REPORTED com timestamp, ator e evento", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    let updateArgs: any = null;
    mockPrisma.servico.update = async (args: any) => {
      updateArgs = args;
      return { id: SERVICO_ID, paymentStatus: "PAYMENT_REPORTED", paymentReportedAt: new Date() };
    };
    const eventos: any[] = [];
    mockPrisma.paymentEvent.create = async (args: any) => {
      eventos.push(args.data);
      return args.data;
    };
    const POST = await getInformar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/informar`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    assert.equal(updateArgs.data.paymentStatus, "PAYMENT_REPORTED");
    assert.ok(updateArgs.data.paymentReportedAt instanceof Date);
    assert.equal(eventos[0].tipo, "PAYMENT_REPORTED");
    assert.equal(eventos[0].actorId, DONO);
    assert.equal(eventos[0].actorRole, "EMPREGADOR");
  });

  it("permite informar novamente após contestação (PAYMENT_DISPUTED)", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_DISPUTED" });
    mockPrisma.servico.update = async () => ({
      id: SERVICO_ID,
      paymentStatus: "PAYMENT_REPORTED",
      paymentReportedAt: new Date(),
    });
    mockPrisma.paymentEvent.create = async (args: any) => args.data;
    const POST = await getInformar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/informar`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
  });
});

describe("POST /api/servicos/[id]/pagamento/confirmar", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 403 quando o empregador tenta confirmar o recebimento", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    const POST = await getConfirmar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/confirmar`,
        null,
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 para profissional que não é o do serviço", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    const POST = await getConfirmar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/confirmar`,
        null,
        makeAuthHeaders(OUTRA_DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 409 quando não há pagamento informado", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const POST = await getConfirmar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/confirmar`,
        null,
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("PAYMENT_REPORTED → PAYMENT_CONFIRMED com timestamp e evento do profissional", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    let updateArgs: any = null;
    mockPrisma.servico.update = async (args: any) => {
      updateArgs = args;
      return {
        id: SERVICO_ID,
        paymentStatus: "PAYMENT_CONFIRMED",
        paymentConfirmedAt: new Date(),
      };
    };
    const eventos: any[] = [];
    mockPrisma.paymentEvent.create = async (args: any) => {
      eventos.push(args.data);
      return args.data;
    };
    const POST = await getConfirmar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/confirmar`,
        null,
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    assert.equal(updateArgs.data.paymentStatus, "PAYMENT_CONFIRMED");
    assert.ok(updateArgs.data.paymentConfirmedAt instanceof Date);
    assert.equal(eventos[0].tipo, "PAYMENT_CONFIRMED");
    assert.equal(eventos[0].actorId, DIARISTA);
    assert.equal(eventos[0].actorRole, "DIARISTA");
  });
});

describe("POST /api/servicos/[id]/pagamento/contestar", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 400 sem motivo", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    const POST = await getContestar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/contestar`,
        {},
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 400);
  });

  it("retorna 403 quando o empregador tenta contestar", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    const POST = await getContestar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/contestar`,
        { motivo: "Não caiu na conta." },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 409 quando não há pagamento informado", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    const POST = await getContestar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/contestar`,
        { motivo: "Não caiu na conta." },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 409);
  });

  it("PAYMENT_REPORTED → PAYMENT_DISPUTED registrando o motivo", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    let updateArgs: any = null;
    mockPrisma.servico.update = async (args: any) => {
      updateArgs = args;
      return {
        id: SERVICO_ID,
        paymentStatus: "PAYMENT_DISPUTED",
        paymentDisputedAt: new Date(),
      };
    };
    const eventos: any[] = [];
    mockPrisma.paymentEvent.create = async (args: any) => {
      eventos.push(args.data);
      return args.data;
    };
    const POST = await getContestar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/contestar`,
        { motivo: "Não caiu na conta." },
        makeAuthHeaders(DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    assert.equal(updateArgs.data.paymentStatus, "PAYMENT_DISPUTED");
    assert.ok(updateArgs.data.paymentDisputedAt instanceof Date);
    assert.equal(eventos[0].tipo, "PAYMENT_DISPUTED");
    assert.equal(eventos[0].motivo, "Não caiu na conta.");
  });
});
