import { describe, it, beforeEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";
import { stubS3Send, restoreS3Send, s3CallCount, resetS3CallCount } from "./_stubS3";

async function getHandler() {
  const mod = await import("../../src/app/api/me/route");
  return mod.DELETE;
}

const USER_ID = "u-titular-1";
const CONFIRMACAO = "EXCLUIR MINHA CONTA";

function deleteRequest(body: unknown, comAuth = true): Request {
  return new Request("http://test/api/me", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      ...(comAuth ? makeAuthHeaders(USER_ID, "EMPREGADOR") : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Tabelas que o mock compartilhado não declara — só existem neste fluxo. */
function stubTabelasDaExclusao(registro: Record<string, unknown>) {
  const m = mockPrisma as unknown as Record<string, unknown>;
  // O `$transaction` padrão entrega ao callback a instância interna criada por
  // `createMockPrisma()`, não o `mockPrisma` exportado — então as tabelas
  // adicionadas aqui não existiriam dentro da transação. Redireciona.
  m.$transaction = async (cb: unknown) =>
    typeof cb === "function" ? (cb as (tx: unknown) => unknown)(mockPrisma) : cb;
  for (const tabela of ["enderecoUsuario", "oAuthAccount", "empregadorPerfil"]) {
    m[tabela] = {
      deleteMany: async () => ({ count: 1 }),
      updateMany: async (args: unknown) => {
        registro[tabela] = args;
        return { count: 1 };
      },
    };
  }
  (m.paymentInfo as Record<string, unknown>).deleteMany = async () => ({ count: 1 });
  (m.notification as Record<string, unknown>).deleteMany = async () => ({ count: 3 });
  (m.documentVerification as Record<string, unknown>).deleteMany = async () => ({ count: 1 });
  (m.empregadorFavorito as Record<string, unknown>).deleteMany = async () => ({ count: 0 });
  (m.diaristaProfile as Record<string, unknown>).updateMany = async () => ({ count: 0 });
  (m.montadorPerfil as Record<string, unknown>).updateMany = async () => ({ count: 0 });
  (m.servico as Record<string, unknown>).updateMany = async (args: unknown) => {
    registro.servico = args;
    return { count: 2 };
  };
}

describe("DELETE /api/me — exclusão de conta (LGPD)", () => {
  before(() => stubS3Send());
  after(() => restoreS3Send());

  beforeEach(() => {
    resetMockPrisma();
    resetS3CallCount();
  });

  it("retorna 401 sem token", async () => {
    const DELETE = await getHandler();
    const res = await DELETE(deleteRequest({ confirmacao: CONFIRMACAO }, false));
    assert.equal(res.status, 401);
  });

  it("recusa sem a frase de confirmação — não apaga por engano", async () => {
    let tocouNoBanco = false;
    mockPrisma.user.findUnique = async () => {
      tocouNoBanco = true;
      return null;
    };

    const DELETE = await getHandler();
    const res = await DELETE(deleteRequest({}));
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "CONFIRMACAO_INVALIDA");
    assert.equal(tocouNoBanco, false, "não pode nem consultar o usuário sem confirmação");
  });

  it("bloqueia enquanto houver serviço em aberto", async () => {
    mockPrisma.servico.count = async () => 1;

    const DELETE = await getHandler();
    const res = await DELETE(deleteRequest({ confirmacao: CONFIRMACAO }));
    const body = await res.json();

    assert.equal(res.status, 409);
    assert.equal(body.error, "SERVICOS_EM_ABERTO");
    assert.equal(body.servicosEmAberto, 1);
  });

  it("anonimiza o titular, limpa o endereço do serviço preservado e encerra a sessão", async () => {
    const registro: Record<string, unknown> = {};
    mockPrisma.servico.count = async () => 0;
    mockPrisma.user.findUnique = async () => ({
      id: USER_ID,
      status: "ATIVO",
      diaristaProfile: { docUrl: JSON.stringify({ frente: "verificacoes/a.jpg", verso: "verificacoes/b.jpg" }) },
      documentVerifications: [],
    });
    mockPrisma.user.update = async (args: unknown) => {
      registro.user = args;
      return { id: USER_ID };
    };
    stubTabelasDaExclusao(registro);

    const DELETE = await getHandler();
    const res = await DELETE(deleteRequest({ confirmacao: CONFIRMACAO }));
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);

    // Os dados pessoais do titular saem de verdade.
    const dados = (registro.user as { data: Record<string, unknown> }).data;
    assert.equal(dados.status, "REMOVIDO");
    assert.equal(dados.nome, "Conta removida");
    for (const campo of ["telefone", "cpf", "email", "senhaHash", "avatarUrl", "pushToken", "dataNascimento"]) {
      assert.equal(dados[campo], null, `${campo} deveria ir a null`);
    }

    // O endereço fica gravado no serviço, que é preservado — tem que sair de lá.
    const servico = registro.servico as { where: Record<string, unknown>; data: Record<string, unknown> };
    assert.equal(servico.where.clientId, USER_ID);
    assert.equal(servico.data.enderecoCompleto, null);

    // Documentos de identidade saem do S3 (frente + verso).
    assert.equal(s3CallCount(), 2, "as duas faces do documento devem ser removidas");

    // A sessão morre junto: o JWT valeria 7 dias.
    const cookie = res.headers.get("set-cookie") ?? "";
    assert.match(cookie, /dular_token=;/);
    assert.match(cookie, /Max-Age=0/i);
  });
});

describe("Guardian — conta excluída não passa com token antigo", () => {
  beforeEach(() => resetMockPrisma());

  it("hard-block em REMOVIDO, não só em BLOQUEADO", async () => {
    // O JWT vale 7 dias e não é revogado na exclusão. Se o guardian só
    // olhasse BLOQUEADO, um token antigo de conta excluída criaria serviço.
    const { getGuardianStatusForUser } = await import("../../src/lib/safeScoreGuardian");

    for (const [status, motivo] of [
      ["REMOVIDO", "conta_removida"],
      ["BLOQUEADO", "usuario_bloqueado"],
    ] as const) {
      mockPrisma.user.findUnique = async () => ({ id: USER_ID, role: "EMPREGADOR", status });
      const res = await getGuardianStatusForUser(USER_ID);

      assert.equal(res.canCreateServico, false, `${status} deveria bloquear criação de serviço`);
      assert.ok(res.motivos.includes(motivo), `${status} deveria informar "${motivo}"`);
    }
  });

  it("deixa passar quem está ATIVO (não vira bloqueio geral)", async () => {
    const { getGuardianStatusForUser } = await import("../../src/lib/safeScoreGuardian");
    mockPrisma.user.findUnique = async () => ({ id: USER_ID, role: "EMPREGADOR", status: "ATIVO" });

    // Não chega a decidir aqui — o importante é NÃO cair no hard-block, ou seja
    // seguir para a coleta de dados (que o mock não tem, e por isso lança).
    await assert.rejects(
      () => getGuardianStatusForUser(USER_ID),
      /Prisma mock not configured/,
      "ATIVO deve seguir para a avaliação normal, não ser cortado no hard-block",
    );
  });
});
