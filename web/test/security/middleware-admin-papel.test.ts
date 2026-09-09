import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

/**
 * O middleware confere o PAPEL, não só a assinatura do token.
 *
 * Antes ele validava apenas a assinatura: qualquer JWT válido — inclusive o de
 * um usuário comum vindo do app por OAuth — passava, e quem barrava era cada
 * layout chamando `requireAdminSession`. Proteção opt-in: um grupo de rotas
 * novo sob /admin que esquecesse o helper nasceria aberto.
 *
 * Que o padrão não era seguido já dava para ver: `design-system/layout.tsx`
 * repetia a checagem à mão em vez de usar o helper, e `admin/layout.tsx` é
 * neutro de propósito.
 *
 * Este teste cobre o caso que nenhum teste de página cobre: a rota que ainda
 * não existe.
 */
async function getMiddleware() {
  const mod = await import("../../middleware");
  return mod.middleware;
}

async function token(role: string | null, segredo: string) {
  const payload: Record<string, unknown> = { userId: "u1" };
  if (role !== null) payload.role = role;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(segredo));
}

function req(path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `dular_token=${cookie}`;
  // O middleware recebe um NextRequest; um Request com a mesma forma serve,
  // porque só usamos nextUrl.pathname e cookies.
  const r = new Request(`http://test${path}`, { headers });
  return Object.assign(r, {
    nextUrl: new URL(`http://test${path}`),
    cookies: {
      get: (nome: string) => (cookie && nome === "dular_token" ? { value: cookie } : undefined),
    },
  }) as never;
}

const SEGREDO = process.env.JWT_SECRET ?? "test_only_do_not_use_in_prod";

describe("middleware — /admin exige papel ADMIN", () => {
  let middleware: Awaited<ReturnType<typeof getMiddleware>>;

  before(async () => {
    middleware = await getMiddleware();
  });

  it("ADMIN passa", async () => {
    const res = await middleware(req("/admin", await token("ADMIN", SEGREDO)));
    assert.equal(res.status, 200, "esperava seguir adiante (NextResponse.next)");
  });

  for (const role of ["DIARISTA", "EMPREGADOR", "MONTADOR"]) {
    it(`${role} com token VÁLIDO é mandado para o login`, async () => {
      const res = await middleware(req("/admin", await token(role, SEGREDO)));
      assert.equal(res.status, 307);
      assert.match(res.headers.get("location") ?? "", /\/admin\/login$/);
    });
  }

  it("token sem papel é mandado para o login", async () => {
    const res = await middleware(req("/admin", await token(null, SEGREDO)));
    assert.equal(res.status, 307);
  });

  it("vale para rota que ainda não existe sob /admin", async () => {
    // É o ponto do teste: nenhum layout protege uma página que ninguém
    // escreveu, mas o middleware protege.
    const res = await middleware(
      req("/admin/pagina-que-nao-existe-ainda", await token("DIARISTA", SEGREDO)),
    );
    assert.equal(res.status, 307);
    assert.match(res.headers.get("location") ?? "", /\/admin\/login$/);
  });

  it("token assinado com outro segredo é recusado", async () => {
    const res = await middleware(req("/admin", await token("ADMIN", "outro-segredo-qualquer")));
    assert.equal(res.status, 307);
  });

  it("sem token é mandado para o login", async () => {
    const res = await middleware(req("/admin"));
    assert.equal(res.status, 307);
  });

  it("/admin/login continua público", async () => {
    const res = await middleware(req("/admin/login"));
    assert.equal(res.status, 200, "a tela de login não pode ser gateada — daria loop");
  });

  it("as rotas de API não passam por este portão", async () => {
    // O gate delas é `requireAuth`/`requireAdmin` em cada rota; o middleware
    // não pode barrá-las, senão o app (que manda Bearer, não cookie) quebra.
    const res = await middleware(req("/api/servicos"));
    assert.equal(res.status, 200);
  });
});
