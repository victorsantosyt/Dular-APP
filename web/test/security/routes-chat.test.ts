import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getPost() {
  const mod = await import("../../src/app/api/chat/[roomId]/messages/route");
  return mod.POST;
}

const SVC_ACEITO = {
  status: "ACEITO",
  clientId: "u-empregador",
  diaristaId: "u-diarista",
  montadorId: null,
};

function ctx(servicoId: string) {
  return { params: Promise.resolve({ roomId: servicoId }) };
}

describe("POST /api/chat/[roomId]/messages", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const POST = await getPost();
    const res = await POST(
      jsonRequest("http://test/api/chat/svc-1/messages", { type: "TEXT", content: "oi" }),
      ctx("svc-1"),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 quando usuário não é participante da sala (IDOR)", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1/messages",
        { type: "TEXT", content: "oi" },
        makeAuthHeaders("u-outsider", "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 404 quando serviço não existe", async () => {
    mockPrisma.servico.findUnique = async () => null;
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-x/messages",
        { type: "TEXT", content: "oi" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
      ctx("svc-x"),
    );
    assert.equal(res.status, 404);
  });

  it("retorna 403 quando serviço ainda não foi aceito", async () => {
    mockPrisma.servico.findUnique = async () => ({ ...SVC_ACEITO, status: "PENDENTE" });
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1/messages",
        { type: "TEXT", content: "oi" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 400 quando type=IMAGE com URL externa (imagem exige data URL)", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    mockPrisma.chatRoom.upsert = async () => ({ id: "room-1" });
    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1/messages",
        { type: "IMAGE", content: "https://evil.example.com/x.jpg" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    // WAR-001: imagem só é aceita como data URL (data:image/...). URL externa
    // continua rejeitada com 400, agora pela validação de formato do schema.
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /data URL|Imagem inválida/i);
  });

  it("aceita TEXT válido de participante e cria mensagem", async () => {
    mockPrisma.servico.findUnique = async () => SVC_ACEITO;
    mockPrisma.chatRoom.upsert = async () => ({ id: "room-1" });
    mockPrisma.chatMessage.create = async () => ({
      id: "msg-1",
      type: "TEXT",
      content: "oi",
      senderId: "u-empregador",
      readAt: null,
      createdAt: new Date(),
      sender: { id: "u-empregador", nome: "Empregador", avatarUrl: null },
    });

    const POST = await getPost();
    const res = await POST(
      jsonRequest(
        "http://test/api/chat/svc-1/messages",
        { type: "TEXT", content: "oi" },
        makeAuthHeaders("u-empregador", "EMPREGADOR"),
      ),
      ctx("svc-1"),
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.message.id, "msg-1");
  });
});
