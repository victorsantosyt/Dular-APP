import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { hashPassword } from "../../src/lib/password";

/**
 * `POST /api/auth/login` é o login do painel admin — e só dele.
 *
 * Sem restrição de papel ela aceitava qualquer usuário com `senhaHash` e
 * devolvia um JWT de 7 dias, válido em toda a API. O painel recusa não-ADMIN
 * (lib/adminSession.ts), mas o token saía daqui de qualquer forma.
 *
 * Verificado no servidor de desenvolvimento antes de escrever isto: uma conta
 * DIARISTA com senha recebia `ok: true` e um token; com esse token, `/admin`
 * respondia 307 para /admin/login. Ou seja, o portão do painel segurava, mas
 * a emissão do token não.
 */
async function getPost() {
  const mod = await import("../../src/app/api/auth/login/route");
  return mod.POST;
}

const SENHA = "senha-de-teste-123";

function loginRequest(login: string, senha: string, ip: string) {
  return new Request("http://test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ login, senha }),
  });
}

/** IP novo a cada teste: o rate limit é por IP e por login. */
function ipUnico() {
  return `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
}

function loginUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random()}@x`;
}

describe("POST /api/auth/login — só ADMIN recebe token", () => {
  let senhaHash: string;

  beforeEach(async () => {
    resetMockPrisma();
    senhaHash = await hashPassword(SENHA);
  });

  it("ADMIN com senha correta recebe token", async () => {
    mockPrisma.user.findFirst = async () => ({
      id: "u-admin",
      role: "ADMIN",
      nome: "Admin",
      telefone: "65999990000",
      email: null,
      status: "ATIVO",
      senhaHash,
    });

    const POST = await getPost();
    const res = await POST(loginRequest(loginUnico("admin"), SENHA, ipUnico()));

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.token, "esperava um token");
    assert.equal(body.user.role, "ADMIN");
  });

  for (const role of ["DIARISTA", "EMPREGADOR", "MONTADOR"]) {
    it(`${role} com senha CORRETA é recusado`, async () => {
      mockPrisma.user.findFirst = async () => ({
        id: `u-${role}`,
        role,
        nome: "Pessoa",
        telefone: "65900007777",
        email: null,
        status: "ATIVO",
        senhaHash,
      });

      const POST = await getPost();
      const res = await POST(loginRequest(loginUnico(role), SENHA, ipUnico()));

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, "invalid_credentials");
      assert.ok(!body.token, "não pode devolver token");
    });
  }

  it("usuário sem papel definido é recusado", async () => {
    mockPrisma.user.findFirst = async () => ({
      id: "u-sem-papel",
      role: null,
      nome: "Sem papel",
      telefone: "65900007778",
      email: null,
      status: "ATIVO",
      senhaHash,
    });

    const POST = await getPost();
    const res = await POST(loginRequest(loginUnico("sempapel"), SENHA, ipUnico()));

    assert.equal(res.status, 401);
  });

  it("a recusa por papel é indistinguível de senha errada", async () => {
    // Se a resposta ao papel errado diferisse da resposta à senha errada,
    // ela confirmaria que a conta existe e que a senha estava certa — que é
    // exatamente o que um ataque de enumeração procura.
    const POST = await getPost();

    mockPrisma.user.findFirst = async () => ({
      id: "u-diarista",
      role: "DIARISTA",
      nome: "Pessoa",
      telefone: "65900007777",
      email: null,
      status: "ATIVO",
      senhaHash,
    });
    const porPapel = await POST(loginRequest(loginUnico("papel"), SENHA, ipUnico()));

    mockPrisma.user.findFirst = async () => ({
      id: "u-admin",
      role: "ADMIN",
      nome: "Admin",
      telefone: "65999990000",
      email: null,
      status: "ATIVO",
      senhaHash,
    });
    const porSenha = await POST(loginRequest(loginUnico("senha"), "senha-errada-mesmo", ipUnico()));

    assert.equal(porPapel.status, porSenha.status);
    assert.deepEqual(await porPapel.json(), await porSenha.json());
  });

  it("ADMIN bloqueado continua recebendo 403, não 401", async () => {
    // O gate de status é anterior a esta mudança e precisa continuar valendo.
    mockPrisma.user.findFirst = async () => ({
      id: "u-admin-bloq",
      role: "ADMIN",
      nome: "Admin",
      telefone: "65999990000",
      email: null,
      status: "BLOQUEADO",
      senhaHash,
    });

    const POST = await getPost();
    const res = await POST(loginRequest(loginUnico("bloq"), SENHA, ipUnico()));

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "blocked_user");
  });
});
