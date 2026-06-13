import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

async function getHandlers() {
  const mod = await import("../../src/app/api/empregador/favoritos/route");
  return {
    GET: mod.GET,
    POST: mod.POST,
    DELETE: mod.DELETE,
  };
}

const EMPREGADOR_ID = "u-empregador-1";
const DIARISTA_ID = "u-diarista-1";
const MONTADOR_ID = "u-montador-1";

const DIARISTA_USER = {
  id: DIARISTA_ID,
  nome: "Diarista Test",
  role: "DIARISTA",
};

const MONTADOR_USER = {
  id: MONTADOR_ID,
  nome: "Montador Test",
  role: "MONTADOR",
};

const DIARISTA_PROFILE = {
  notaMedia: 4.5,
  totalServicos: 10,
  cidade: "São Paulo",
  estado: "SP",
  verificacao: "VERIFICADO",
  servicosOferecidos: ["FAXINA_LEVE", "FAXINA_PESADA"],
};

const MONTADOR_PROFILE = {
  bairros: ["Vila Mariana"],
  especialidades: ["HIDRAULICA", "ELETRICA"],
  cidade: "São Paulo",
  estado: "SP",
};

const FAVORITO_DIARISTA = {
  id: "fav-1",
  empregadorUserId: EMPREGADOR_ID,
  profissionalUserId: DIARISTA_ID,
  tipo: "DIARISTA",
  createdAt: new Date(),
};

const FAVORITO_MONTADOR = {
  id: "fav-2",
  empregadorUserId: EMPREGADOR_ID,
  profissionalUserId: MONTADOR_ID,
  tipo: "MONTADOR",
  createdAt: new Date(),
};

describe("GET /api/empregador/favoritos", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const { GET } = await getHandlers();
    const res = await GET(jsonRequest("http://test/api/empregador/favoritos", null));
    assert.equal(res.status, 401);
  });

  it("retorna 403 para DIARISTA", async () => {
    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        null,
        makeAuthHeaders("u-diarista-x", "DIARISTA"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 para MONTADOR", async () => {
    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        null,
        makeAuthHeaders("u-montador-x", "MONTADOR"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna array vazio quando empregador não tem favoritos", async () => {
    mockPrisma.empregadorFavorito.findMany = async () => [];
    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        null,
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.ok, true);
    assert.deepEqual(body.favoritos, []);
  });

  it("retorna lista de favoritos com dados enriquecidos", async () => {
    mockPrisma.empregadorFavorito.findMany = async () => [FAVORITO_DIARISTA];
    mockPrisma.user.findUnique = async () => DIARISTA_USER;
    mockPrisma.diaristaProfile.findUnique = async () => DIARISTA_PROFILE;

    const { GET } = await getHandlers();
    const res = await GET(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        null,
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.ok, true);
    assert.equal(body.favoritos.length, 1);
    assert.equal(body.favoritos[0].tipo, "DIARISTA");
    assert.equal(body.favoritos[0].nome, "Diarista Test");
    assert.equal(body.favoritos[0].rating, 4.5);
  });
});

describe("POST /api/empregador/favoritos", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest("http://test/api/empregador/favoritos", {
        profissionalUserId: DIARISTA_ID,
        tipo: "DIARISTA",
      }),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 para DIARISTA", async () => {
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: MONTADOR_ID, tipo: "MONTADOR" },
        makeAuthHeaders("u-diarista-x", "DIARISTA"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("retorna 403 ao tentar favoritar a si mesmo", async () => {
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: EMPREGADOR_ID, tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /si mesmo/);
  });

  it("retorna 404 quando profissional não existe", async () => {
    mockPrisma.user.findUnique = async () => null;
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: "non-existent", tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /não encontrado/i);
  });

  it("retorna 400 quando tipo não corresponde ao role", async () => {
    mockPrisma.user.findUnique = async () => DIARISTA_USER;
    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "MONTADOR" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /inválido/i);
  });

  it("cria favorito com sucesso para DIARISTA", async () => {
    mockPrisma.user.findUnique = async () => DIARISTA_USER;
    mockPrisma.empregadorFavorito.upsert = async () => FAVORITO_DIARISTA;
    mockPrisma.diaristaProfile.findUnique = async () => DIARISTA_PROFILE;

    const { POST } = await getHandlers();
    const res = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.ok, true);
    assert.equal(body.favorito.tipo, "DIARISTA");
    assert.equal(body.favorito.nome, "Diarista Test");
  });

  it("é idempotente: POST 2x mesmo favorito não duplica", async () => {
    mockPrisma.user.findUnique = async () => DIARISTA_USER;
    mockPrisma.empregadorFavorito.upsert = async () => FAVORITO_DIARISTA;
    mockPrisma.diaristaProfile.findUnique = async () => DIARISTA_PROFILE;

    const { POST } = await getHandlers();
    const res1 = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    const body1 = await res1.json();

    const res2 = await POST(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    const body2 = await res2.json();

    assert.equal(body1.favorito.id, body2.favorito.id);
  });
});

describe("DELETE /api/empregador/favoritos", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("retorna 401 sem token", async () => {
    const { DELETE: DELETE_HANDLER } = await getHandlers();
    const res = await DELETE_HANDLER(
      jsonRequest("http://test/api/empregador/favoritos", {
        profissionalUserId: DIARISTA_ID,
        tipo: "DIARISTA",
      }),
    );
    assert.equal(res.status, 401);
  });

  it("retorna 403 para DIARISTA", async () => {
    const { DELETE: DELETE_HANDLER } = await getHandlers();
    const res = await DELETE_HANDLER(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "DIARISTA" },
        makeAuthHeaders("u-diarista-x", "DIARISTA"),
      ),
    );
    assert.equal(res.status, 403);
  });

  it("remove favorito existente com sucesso", async () => {
    mockPrisma.empregadorFavorito.delete = async () => FAVORITO_DIARISTA;

    const { DELETE: DELETE_HANDLER } = await getHandlers();
    const res = await DELETE_HANDLER(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.ok, true);
  });

  it("é idempotente: remover inexistente retorna 200", async () => {
    mockPrisma.empregadorFavorito.delete = async () => {
      const err = new Error("Record not found") as any;
      err.code = "P2025";
      err.name = "PrismaClientKnownRequestError";
      throw err;
    };

    const { DELETE: DELETE_HANDLER } = await getHandlers();
    const res = await DELETE_HANDLER(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: "non-existent", tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
  });

  it("remove apenas favorito do empregador logado (não de outros)", async () => {
    mockPrisma.empregadorFavorito.delete = async (opts: any) => {
      const { where } = opts;
      if (where.empregadorUserId_profissionalUserId_tipo.empregadorUserId !== EMPREGADOR_ID) {
        throw new Error("An operation failed because it depends on one or more records that were required but not found");
      }
      return FAVORITO_DIARISTA;
    };

    const { DELETE: DELETE_HANDLER } = await getHandlers();
    const res = await DELETE_HANDLER(
      jsonRequest(
        "http://test/api/empregador/favoritos",
        { profissionalUserId: DIARISTA_ID, tipo: "DIARISTA" },
        makeAuthHeaders(EMPREGADOR_ID, "EMPREGADOR"),
      ),
    );
    assert.equal(res.status, 200);
  });
});
