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
    mockPrisma.user.findUnique = async (args: any) =>
      args?.where?.id === DIARISTA
        ? { id: DIARISTA, nome: "Diarista", avatarUrl: null, role: "DIARISTA", lastSeenAt: null }
        : { status: "ATIVO" };
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

  it("histórico não repete o avatar do remetente e mantém o que o app lê", async () => {
    const AVATAR_CLIENTE = "data:image/jpeg;base64,Q0xJRU5URQ==";
    const AVATAR_DIARISTA = "data:image/jpeg;base64,RElBUklTVEE=";
    const pessoas: Record<string, { id: string; nome: string; avatarUrl: string }> = {
      [CLIENTE]: { id: CLIENTE, nome: "Empregador", avatarUrl: AVATAR_CLIENTE },
      [DIARISTA]: { id: DIARISTA, nome: "Diarista", avatarUrl: AVATAR_DIARISTA },
    };
    // Histórico como está no banco: cada mensagem ligada a um remetente COM avatar.
    const lida = new Date(Date.UTC(2026, 0, 2));
    const historico = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      roomId: "room-1",
      type: "TEXT",
      content: `mensagem ${i}`,
      senderId: i % 2 ? DIARISTA : CLIENTE,
      deliveredAt: lida,
      readAt: lida,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 50 - i)),
    }));
    // Projeção do Prisma: devolve só o que o select pede, inclusive no remetente.
    const projetar = (obj: any, select: any): any =>
      Object.fromEntries(
        Object.entries(select)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, v === true ? obj[k] : projetar(obj[k], (v as any).select)]),
      );

    mockPrisma.servico.findUnique = async () => ({ ...SVC_ACEITO, precoFinal: 15000, paymentStatus: "WAITING_PAYMENT" });
    mockPrisma.chatRoom.upsert = async () => ({
      id: "room-1",
      servicoId: "svc-1",
      createdAt: new Date(),
      _count: { messages: historico.length },
    });
    mockPrisma.user.findUnique = async (args: any) =>
      args?.where?.id === DIARISTA
        ? { ...pessoas[DIARISTA], role: "DIARISTA", lastSeenAt: null }
        : { status: "ATIVO" };
    mockPrisma.chatMessage.updateMany = async () => ({ count: 0 });
    mockPrisma.chatMessage.findMany = async (args: any) =>
      historico.map((m) => projetar({ ...m, sender: pessoas[m.senderId] }, args.select));
    mockPrisma.pixSnapshot.findUnique = async () => null;
    mockPrisma.paymentInfo.findUnique = async () => null;

    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest("http://test/api/chat/svc-1", null, makeAuthHeaders(CLIENTE, "EMPREGADOR")),
      ctx("svc-1"),
    );
    assert.equal(res.status, 200);
    const texto = await res.text();
    const body = JSON.parse(texto);

    // Avatar é data URL (até ~1 MB): antes ia uma cópia por mensagem.
    const ocorrencias = (agulha: string) => texto.split(agulha).length - 1;
    assert.equal(ocorrencias(AVATAR_CLIENTE), 0);
    assert.equal(ocorrencias(AVATAR_DIARISTA), 1);
    assert.equal(body.room.other.avatarUrl, AVATAR_DIARISTA);

    // Campos que o app lê (useChat): mensagens e cabeçalho.
    assert.equal(body.messages.length, 50);
    for (const m of body.messages) {
      for (const campo of ["id", "content", "type", "senderId", "createdAt", "deliveredAt", "readAt"]) {
        assert.ok(campo in m, `mensagem sem ${campo}`);
      }
      assert.deepEqual(m.sender, { id: m.senderId, nome: pessoas[m.senderId].nome });
    }
    for (const campo of ["nome", "avatarUrl", "role", "lastSeenAt"]) {
      assert.ok(campo in body.room.other, `other sem ${campo}`);
    }
    for (const campo of ["status", "tipo", "paymentStatus", "precoFinal"]) {
      assert.ok(campo in body.room.servico, `servico sem ${campo}`);
    }
    assert.equal(typeof body.room.pagamento.profissionalTemPix, "boolean");
    assert.equal(typeof body.room.arquivada, "boolean");
    assert.equal(typeof body.room.podeExcluir, "boolean");
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
