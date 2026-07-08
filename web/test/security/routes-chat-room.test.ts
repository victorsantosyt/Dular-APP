import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

// Endpoint REALMENTE usado pelo mobile (useChat): GET/POST /api/chat/[roomId]
// (roomId = servicoId). Complementa routes-chat.test.ts (que cobre /messages).
async function getHandlers() {
  const mod = await import("../../src/app/api/chat/[roomId]/route");
  return { GET: mod.GET, POST: mod.POST };
}
async function getListGET() {
  const mod = await import("../../src/app/api/chat/route");
  return mod.GET;
}

const CLIENTE = "u-empregador";
const DIARISTA = "u-diarista";
const OUTSIDER = "u-outsider";

const SVC_ACEITO = {
  id: "svc-1",
  status: "ACEITO",
  clientId: CLIENTE,
  diaristaId: DIARISTA,
  montadorId: null,
  tipo: "FAXINA",
  data: new Date(),
  turno: "MANHA",
  bairro: "Centro",
  cidade: "Iporá",
  uf: "GO",
};

function ctx(roomId: string) {
  return { params: Promise.resolve({ roomId }) };
}

describe("GET /api/chat — lista de salas", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const GET = await getListGET();
    const res = await GET(jsonRequest("http://test/api/chat", null));
    assert.equal(res.status, 401);
  });
});

describe("GET /api/chat/[roomId] — ler mensagens", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 401 sem token", async () => {
    const { GET } = await getHandlers();
    const res = await GET(jsonRequest("http://test/api/chat/svc-1", null), ctx("svc-1"));
    assert.equal(res.status, 401);
  });

  it("retorna 404 quando serviço não existe", async () => {
    mockPrisma.servico.findUnique = async () => null;
    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest("http://test/api/chat/svc-x", null, makeAuthHeaders(CLIENTE, "EMPREGADOR")),
      ctx("svc-x"),
    );
    assert.equal(res.status, 404);
  });

  it("retorna 403 para quem não participa (IDOR)", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest("http://test/api/chat/svc-1", null, makeAuthHeaders(OUTSIDER, "EMPREGADOR")),
      ctx("svc-1"),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 quando serviço ainda não foi aceito", async () => {
    mockPrisma.servico.findUnique = async () => ({ ...SVC_ACEITO, status: "SOLICITADO" });
    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest("http://test/api/chat/svc-1", null, makeAuthHeaders(CLIENTE, "EMPREGADOR")),
      ctx("svc-1"),
    );
    assert.equal(res.status, 403);
  });

  it("participante (cliente) lê a sala com sucesso (200)", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    mockPrisma.chatRoom.upsert = async () => ({
      id: "room-1",
      servicoId: "svc-1",
      createdAt: new Date(),
      _count: { messages: 0 },
    });
    mockPrisma.user.findUnique = async () => ({
      id: DIARISTA,
      nome: "Diarista",
      avatarUrl: null,
      role: "DIARISTA",
      lastSeenAt: null,
    });
    // GET marca deliveredAt (e depois readAt) via updateMany — Etapa 2.
    mockPrisma.chatMessage.updateMany = async () => ({ count: 0 });
    mockPrisma.chatMessage.findMany = async () => [];
    // GET agora informa se há dados de recebimento (snapshot do serviço ou
    // PaymentInfo do profissional) para o banner de pagamento.
    mockPrisma.pixSnapshot.findUnique = async () => null;
    mockPrisma.paymentInfo.findUnique = async () => null;

    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest("http://test/api/chat/svc-1", null, makeAuthHeaders(CLIENTE, "EMPREGADOR")),
      ctx("svc-1"),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.room.servicoId, "svc-1");
    assert.ok(Array.isArray(body.messages));
    assert.equal(body.room.pagamento.profissionalTemPix, false);
  });
});

describe("POST /api/chat/[roomId] — enviar mensagem", () => {
  beforeEach(() => resetMockPrisma());

  it("retorna 403 para quem não participa (IDOR)", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1",
        { content: "oi", type: "TEXT" },
        makeAuthHeaders(OUTSIDER, "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 400 quando conteúdo é vazio", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1",
        { content: "   ", type: "TEXT" },
        makeAuthHeaders(CLIENTE, "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    assert.equal(res.status, 400);
  });

  it("participante envia TEXT com sucesso (201)", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    mockPrisma.chatRoom.upsert = async () => ({ id: "room-1" });
    mockPrisma.chatMessage.create = async () => ({
      id: "msg-1",
      roomId: "room-1",
      type: "TEXT",
      content: "oi",
      senderId: CLIENTE,
      readAt: null,
      createdAt: new Date(),
      sender: { id: CLIENTE, nome: "Empregador", avatarUrl: null },
    });

    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1",
        { content: "oi", type: "TEXT" },
        makeAuthHeaders(CLIENTE, "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.message.id, "msg-1");
  });
});
