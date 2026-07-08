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

  it("retorna 409 quando não há snapshot nem chave PIX cadastrada", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    mockPrisma.pixSnapshot.findUnique = async () => null;
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

  it("gera o PIX com valor do precoFinal e TxId do serviço — ignorando o body — e congela o snapshot no 1º uso", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    // Sem snapshot ainda: a rota congela a partir do PaymentInfo atual.
    mockPrisma.pixSnapshot.findUnique = async () => null;
    mockPrisma.paymentInfo.findUnique = async (args: any) => {
      assert.equal(args.where.userId, DIARISTA);
      return PAYMENT_INFO;
    };
    let snapshotCriado: any = null;
    mockPrisma.pixSnapshot.create = async (args: any) => {
      snapshotCriado = args.data;
      return args.data;
    };
    const eventos: any[] = [];
    mockPrisma.paymentEvent.create = async (args: any) => {
      eventos.push(args.data);
      return args.data;
    };
    const POST = await getGerarPix();
    // Tentativa maliciosa: body com valor/txid/chave forjados — a rota não lê o body.
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pix`,
        {
          valorCentavos: 1,
          amountCents: 1,
          precoFinal: 1,
          txid: "TXID-FORJADO",
          pixKey: "chave-do-atacante@evil.com",
          chave: "chave-do-atacante@evil.com",
        },
        makeAuthHeaders(DONO, "EMPREGADOR"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    // Valor congelado do ticket, nunca do cliente.
    assert.equal(body.pix.valorCentavos, 15000);
    assert.ok(body.pix.copiaECola.includes("5406150.00"));
    // TxId = id do serviço (sanitizado p/ alfanumérico) — nunca o do body.
    assert.equal(body.pix.txid, SERVICO_ID);
    assert.ok(body.pix.copiaECola.includes("0504svc1"));
    assert.ok(!body.pix.copiaECola.includes("TXIDFORJADO"));
    // Chave do snapshot, nunca a do body.
    assert.ok(body.pix.copiaECola.includes(PAYMENT_INFO.pixKey));
    assert.ok(!body.pix.copiaECola.includes("evil.com"));
    // CRC do payload é válido.
    assert.equal(body.pix.copiaECola.slice(-4), crc16ccitt(body.pix.copiaECola.slice(0, -4)));
    // Chave nunca sai completa da API de geração (vai só dentro do payload EMV).
    assert.notEqual(body.pix.chaveMascarada, PAYMENT_INFO.pixKey);
    // Snapshot congelado com os dados do PaymentInfo, pertencendo ao serviço.
    assert.equal(snapshotCriado.servicoId, SERVICO_ID);
    assert.equal(snapshotCriado.pixKey, PAYMENT_INFO.pixKey);
    assert.equal(snapshotCriado.holderName, PAYMENT_INFO.holderName);
    // Evento de auditoria registrado (com ator).
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].tipo, "PIX_GENERATED");
    assert.equal(eventos[0].actorId, DONO);
  });

  it("usa EXCLUSIVAMENTE o snapshot congelado — nunca a chave atual do perfil", async () => {
    const SNAPSHOT_CONGELADO = {
      pixType: "EMAIL",
      pixKey: "chave-congelada@dular.com.br",
      bank: null,
      holderName: "Maria José",
    };
    mockPrisma.servico.findUnique = async () => servicoBase();
    mockPrisma.pixSnapshot.findUnique = async () => SNAPSHOT_CONGELADO;
    // paymentInfo.findUnique fica NÃO-mockado de propósito: se a rota
    // consultasse o perfil atual, o teste falharia com 500.
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
    const body = await res.json();
    assert.ok(body.pix.copiaECola.includes(SNAPSHOT_CONGELADO.pixKey));
    assert.equal(body.pix.profissional.nome, SNAPSHOT_CONGELADO.holderName);
  });

  it("permite regenerar após contestação (PAYMENT_DISPUTED)", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_DISPUTED" });
    mockPrisma.pixSnapshot.findUnique = async () => null;
    mockPrisma.paymentInfo.findUnique = async () => PAYMENT_INFO;
    mockPrisma.pixSnapshot.create = async (args: any) => args.data;
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

describe("congelarPixSnapshot — snapshot é create-only", () => {
  beforeEach(() => resetMockPrisma());

  it("snapshot existente NUNCA é sobrescrito, mesmo com PaymentInfo diferente", async () => {
    const EXISTENTE = {
      pixType: "CPF",
      pixKey: "52998224725",
      bank: null,
      holderName: "Nome Congelado",
    };
    mockPrisma.pixSnapshot.findUnique = async () => EXISTENTE;
    // PaymentInfo atual diferente — não pode nem ser consultado p/ sobrescrever.
    let criouSnapshot = false;
    mockPrisma.pixSnapshot.create = async () => {
      criouSnapshot = true;
      return null;
    };
    const { congelarPixSnapshot } = await import("../../src/lib/pagamentoPix");
    const resultado = await congelarPixSnapshot(SERVICO_ID, DIARISTA);
    assert.deepEqual(resultado, EXISTENTE);
    assert.equal(criouSnapshot, false);
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

  it("WAITING_PAYMENT → PAYMENT_REPORTED via compare-and-set, com timestamp, ator e evento", async () => {
    mockPrisma.servico.findUnique = async () => servicoBase();
    let casArgs: any = null;
    mockPrisma.servico.updateMany = async (args: any) => {
      casArgs = args;
      return { count: 1 };
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
    // CAS: o WHERE inclui o estado de origem — transição condicionada.
    assert.deepEqual(casArgs.where.paymentStatus, {
      in: ["WAITING_PAYMENT", "PAYMENT_DISPUTED"],
    });
    assert.equal(casArgs.data.paymentStatus, "PAYMENT_REPORTED");
    assert.ok(casArgs.data.paymentReportedAt instanceof Date);
    const body = await res.json();
    assert.equal(body.servico.paymentStatus, "PAYMENT_REPORTED");
    assert.equal(eventos[0].tipo, "PAYMENT_REPORTED");
    assert.equal(eventos[0].actorId, DONO);
    assert.equal(eventos[0].actorRole, "EMPREGADOR");
  });

  it("corrida perdida (CAS count=0) devolve 409 e NÃO registra evento duplicado", async () => {
    // Entre o check e o write, outra requisição já aplicou a transição.
    mockPrisma.servico.findUnique = async () => servicoBase();
    mockPrisma.servico.updateMany = async () => ({ count: 0 });
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
    assert.equal(res.status, 409);
    assert.equal(eventos.length, 0);
  });

  it("permite informar novamente após contestação (PAYMENT_DISPUTED)", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_DISPUTED" });
    mockPrisma.servico.updateMany = async () => ({ count: 1 });
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

  it("PAYMENT_REPORTED → PAYMENT_CONFIRMED via compare-and-set, com timestamp e evento do profissional", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    let casArgs: any = null;
    mockPrisma.servico.updateMany = async (args: any) => {
      casArgs = args;
      return { count: 1 };
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
    // CAS: só transiciona a partir de PAYMENT_REPORTED.
    assert.equal(casArgs.where.paymentStatus, "PAYMENT_REPORTED");
    assert.equal(casArgs.data.paymentStatus, "PAYMENT_CONFIRMED");
    assert.ok(casArgs.data.paymentConfirmedAt instanceof Date);
    assert.equal(eventos[0].tipo, "PAYMENT_CONFIRMED");
    assert.equal(eventos[0].actorId, DIARISTA);
    assert.equal(eventos[0].actorRole, "DIARISTA");
  });

  it("corrida confirmar×contestar: o perdedor (count=0) recebe 409 sem evento", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    mockPrisma.servico.updateMany = async () => ({ count: 0 });
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
    assert.equal(res.status, 409);
    assert.equal(eventos.length, 0);
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

  it("retorna 403 para profissional que não é o do serviço", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    const POST = await getContestar();
    const res = await POST(
      jsonRequest(
        `http://test/api/servicos/${SERVICO_ID}/pagamento/contestar`,
        { motivo: "Não caiu na conta." },
        makeAuthHeaders(OUTRA_DIARISTA, "DIARISTA"),
      ),
      params(SERVICO_ID),
    );
    assert.equal(res.status, 403);
  });

  it("PAYMENT_REPORTED → PAYMENT_DISPUTED via compare-and-set, registrando o motivo", async () => {
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_REPORTED" });
    let casArgs: any = null;
    mockPrisma.servico.updateMany = async (args: any) => {
      casArgs = args;
      return { count: 1 };
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
    assert.equal(casArgs.where.paymentStatus, "PAYMENT_REPORTED");
    assert.equal(casArgs.data.paymentStatus, "PAYMENT_DISPUTED");
    assert.ok(casArgs.data.paymentDisputedAt instanceof Date);
    assert.equal(eventos[0].tipo, "PAYMENT_DISPUTED");
    assert.equal(eventos[0].motivo, "Não caiu na conta.");
  });
});

describe("Matriz de estados — transições proibidas retornam 409", () => {
  beforeEach(() => resetMockPrisma());

  // Matriz completa (estado × ação):
  //                 gerar-pix  informar  confirmar  contestar
  // WAITING          OK         OK        409        409
  // REPORTED         409        409       OK         OK
  // CONFIRMED        409        409       409        409   (terminal)
  // DISPUTED         OK         OK        409        409
  // Os "OK" estão cobertos nos describes acima; aqui, todos os proibidos.
  const PROIBIDAS: Array<{
    estado: string;
    acao: string;
    getHandler: () => Promise<any>;
    caller: [string, "EMPREGADOR" | "DIARISTA"];
    body?: unknown;
  }> = [
    { estado: "PAYMENT_REPORTED", acao: "gerar-pix", getHandler: getGerarPix, caller: [DONO, "EMPREGADOR"] },
    { estado: "PAYMENT_CONFIRMED", acao: "gerar-pix", getHandler: getGerarPix, caller: [DONO, "EMPREGADOR"] },
    { estado: "PAYMENT_REPORTED", acao: "informar", getHandler: getInformar, caller: [DONO, "EMPREGADOR"] },
    { estado: "PAYMENT_CONFIRMED", acao: "informar", getHandler: getInformar, caller: [DONO, "EMPREGADOR"] },
    { estado: "WAITING_PAYMENT", acao: "confirmar", getHandler: getConfirmar, caller: [DIARISTA, "DIARISTA"] },
    { estado: "PAYMENT_DISPUTED", acao: "confirmar", getHandler: getConfirmar, caller: [DIARISTA, "DIARISTA"] },
    { estado: "PAYMENT_CONFIRMED", acao: "confirmar", getHandler: getConfirmar, caller: [DIARISTA, "DIARISTA"] },
    { estado: "WAITING_PAYMENT", acao: "contestar", getHandler: getContestar, caller: [DIARISTA, "DIARISTA"], body: { motivo: "Não caiu." } },
    { estado: "PAYMENT_DISPUTED", acao: "contestar", getHandler: getContestar, caller: [DIARISTA, "DIARISTA"], body: { motivo: "Não caiu." } },
    { estado: "PAYMENT_CONFIRMED", acao: "contestar", getHandler: getContestar, caller: [DIARISTA, "DIARISTA"], body: { motivo: "Não caiu." } },
  ];

  for (const caso of PROIBIDAS) {
    it(`${caso.estado} × ${caso.acao} → 409`, async () => {
      mockPrisma.servico.findUnique = async () =>
        servicoBase({ paymentStatus: caso.estado });
      const handler = await caso.getHandler();
      const res = await handler(
        jsonRequest(
          `http://test/api/servicos/${SERVICO_ID}/x`,
          caso.body ?? null,
          makeAuthHeaders(caso.caller[0], caso.caller[1]),
        ),
        params(SERVICO_ID),
      );
      assert.equal(res.status, 409);
    });
  }

  it("estado terminal PAYMENT_CONFIRMED nunca volta: nenhuma rota escreve WAITING_PAYMENT", async () => {
    // Prova estática: nenhum handler possui transição de saída de CONFIRMED
    // (todos os casos acima retornam 409 sem chamar updateMany). Reforço
    // dinâmico: updateMany não pode ser alcançado a partir de CONFIRMED.
    mockPrisma.servico.findUnique = async () =>
      servicoBase({ paymentStatus: "PAYMENT_CONFIRMED" });
    let casChamado = false;
    mockPrisma.servico.updateMany = async () => {
      casChamado = true;
      return { count: 1 };
    };
    for (const getHandler of [getInformar, getConfirmar, getContestar]) {
      const handler = await getHandler();
      await handler(
        jsonRequest(
          `http://test/api/servicos/${SERVICO_ID}/x`,
          { motivo: "x".repeat(10) },
          makeAuthHeaders(DONO, "EMPREGADOR"),
        ),
        params(SERVICO_ID),
      );
      await handler(
        jsonRequest(
          `http://test/api/servicos/${SERVICO_ID}/x`,
          { motivo: "x".repeat(10) },
          makeAuthHeaders(DIARISTA, "DIARISTA"),
        ),
        params(SERVICO_ID),
      );
    }
    assert.equal(casChamado, false);
  });
});
