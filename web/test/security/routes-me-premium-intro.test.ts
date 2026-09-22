import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders } from "./_helpers";

/**
 * Apresentação do Premium: uma vez por CONTA, decidida no backend.
 *
 * O defeito que estes casos travam: o estado vivia num `let` de módulo do app
 * (`jaApresentouPlanos`), então pertencia ao PROCESSO. Fechar e abrir o app
 * zerava a flag e a mesma conta gratuita recebia o paywall outra vez.
 *
 * FIRST_LOGIN é de PRIMEIRO acesso: a migration que criou
 * `premiumIntroShownAt` marcou como vista toda conta que já existia, então só
 * conta criada depois dela nasce com nulo. Aqui isso aparece como a diferença
 * entre uma conta com marca (antiga) e uma sem (nova) — ver `CONTA_ANTIGA`.
 */

async function getHandler() {
  const mod = await import("../../src/app/api/me/subscription/claim-intro/route");
  return mod.POST;
}

function post(headers: Record<string, string> = {}): Request {
  return new Request("http://test/api/me/subscription/claim-intro", {
    method: "POST",
    headers,
  });
}

const CONTA_A = "u-diarista-a";
const CONTA_B = "u-diarista-b";
/** Conta que já existia quando a migration rodou: nasce com marca. */
const CONTA_ANTIGA = "u-diarista-antiga";

/** Banco de mentira: uma coluna `premiumIntroShownAt` por usuário. */
function instalarBanco(marcadas: Record<string, Date | null>) {
  const chamadas = { updateMany: 0 };

  mockPrisma.user.findUnique = async ({ where, select }: any) => {
    // `assertContaAtiva` só pede `status`; o resto do código pede a marca.
    if (select?.status) return { status: "ATIVO" };
    return { premiumIntroShownAt: marcadas[where.id] ?? null };
  };

  // Espelha o `UPDATE ... WHERE "premiumIntroShownAt" IS NULL` do Postgres:
  // afeta a linha só enquanto a coluna estiver nula.
  mockPrisma.user.updateMany = async ({ where, data }: any) => {
    chamadas.updateMany += 1;
    const atual = marcadas[where.id] ?? null;
    if (where.premiumIntroShownAt === null && atual !== null) return { count: 0 };
    marcadas[where.id] = data.premiumIntroShownAt;
    return { count: 1 };
  };

  return chamadas;
}

/** FREE por padrão: sem assinatura e sem limite cadastrado para a feature. */
function instalarPlano(plan: "FREE" | "PREMIUM") {
  mockPrisma.subscription.findUnique = async () =>
    plan === "FREE"
      ? null
      : { plan: "PREMIUM", status: "ACTIVE", expiresAt: null };
  mockPrisma.featureLimit.findUnique = async () => null;
}

describe("POST /api/me/subscription/claim-intro", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("recusa sem token", async () => {
    instalarBanco({});
    instalarPlano("FREE");
    const POST = await getHandler();
    const res = await POST(post());
    assert.equal(res.status, 401);
  });

  it("A) conta nova FREE que nunca viu a intro recebe a apresentação", async () => {
    const marcadas: Record<string, Date | null> = {};
    instalarBanco(marcadas);
    instalarPlano("FREE");

    const POST = await getHandler();
    const res = await POST(post(makeAuthHeaders(CONTA_A, "DIARISTA")));
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.shouldShow, true);
    assert.equal(body.reason, "FIRST_LOGIN");
    assert.ok(marcadas[CONTA_A] instanceof Date, "a conta precisa sair marcada");
  });

  it("B/C) reabrir o app ou relogar na MESMA conta não mostra de novo", async () => {
    const marcadas: Record<string, Date | null> = {};
    instalarBanco(marcadas);
    instalarPlano("FREE");
    const POST = await getHandler();

    const primeira = await (await POST(post(makeAuthHeaders(CONTA_A, "DIARISTA")))).json();
    // Processo novo, token novo, mesma conta — é o que acontece ao fechar e
    // abrir o app, e ao sair e entrar de novo.
    const segunda = await (await POST(post(makeAuthHeaders(CONTA_A, "DIARISTA")))).json();
    const terceira = await (await POST(post(makeAuthHeaders(CONTA_A, "DIARISTA")))).json();

    assert.equal(primeira.shouldShow, true);
    assert.equal(segunda.shouldShow, false);
    assert.equal(segunda.reason, "ALREADY_SHOWN");
    assert.equal(terceira.shouldShow, false);
  });

  it("D) outra conta nova recebe a sua própria apresentação", async () => {
    const marcadas: Record<string, Date | null> = {};
    instalarBanco(marcadas);
    instalarPlano("FREE");
    const POST = await getHandler();

    const a = await (await POST(post(makeAuthHeaders(CONTA_A, "DIARISTA")))).json();
    const b = await (await POST(post(makeAuthHeaders(CONTA_B, "MONTADOR")))).json();

    assert.equal(a.shouldShow, true);
    assert.equal(b.shouldShow, true, "a marca é por conta, não global");
    assert.ok(marcadas[CONTA_B] instanceof Date);
  });

  it("F) conta que já assina não recebe a apresentação — e não é marcada", async () => {
    const marcadas: Record<string, Date | null> = {};
    const chamadas = instalarBanco(marcadas);
    instalarPlano("PREMIUM");

    const POST = await getHandler();
    const body = await (await POST(post(makeAuthHeaders(CONTA_A, "DIARISTA")))).json();

    assert.equal(body.shouldShow, false);
    assert.equal(body.reason, "ALREADY_SUBSCRIBED");
    assert.equal(chamadas.updateMany, 0, "assinante não gasta a exibição da conta");
    assert.equal(marcadas[CONTA_A] ?? null, null);
  });

  it("G) duas chamadas simultâneas reivindicam a intro uma vez só", async () => {
    const marcadas: Record<string, Date | null> = {};
    instalarBanco(marcadas);
    instalarPlano("FREE");
    const POST = await getHandler();

    const [uma, outra] = await Promise.all([
      POST(post(makeAuthHeaders(CONTA_A, "DIARISTA"))).then((r: Response) => r.json()),
      POST(post(makeAuthHeaders(CONTA_A, "DIARISTA"))).then((r: Response) => r.json()),
    ]);

    const exibicoes = [uma.shouldShow, outra.shouldShow].filter(Boolean).length;
    assert.equal(exibicoes, 1, "exatamente uma das duas pode exibir");
  });

  it("H) falha do banco ao marcar não devolve autorização para exibir", async () => {
    instalarPlano("FREE");
    mockPrisma.user.findUnique = async () => ({ status: "ATIVO" });
    mockPrisma.user.updateMany = async () => {
      throw new Error("conexão perdida");
    };

    const POST = await getHandler();
    await assert.rejects(
      () => POST(post(makeAuthHeaders(CONTA_A, "DIARISTA"))),
      /conexão perdida/,
      "sem confirmação da escrita, a rota não pode responder shouldShow: true",
    );
  });
  it("conta anterior à feature NÃO recebe a introdução", async () => {
    // O backfill da migration marcou toda conta existente. Sem ele, a base
    // inteira veria uma tela de boas-vindas ao Premium no primeiro acesso
    // depois do deploy — inclusive quem usa o app há meses.
    const marcadas: Record<string, Date | null> = {
      [CONTA_ANTIGA]: new Date("2026-09-21T12:00:00Z"),
    };
    const chamadas = instalarBanco(marcadas);
    instalarPlano("FREE");

    const POST = await getHandler();
    const body = await (await POST(post(makeAuthHeaders(CONTA_ANTIGA, "DIARISTA")))).json();

    assert.equal(body.shouldShow, false);
    assert.equal(body.reason, "ALREADY_SHOWN");
    assert.equal(chamadas.updateMany, 1, "tentou reivindicar e o banco recusou");
    assert.deepEqual(
      marcadas[CONTA_ANTIGA],
      new Date("2026-09-21T12:00:00Z"),
      "a marca original não pode ser reescrita",
    );
  });

  it("conta antiga que cancelou a assinatura continua sem introdução", async () => {
    // O backfill marca TODAS as contas, não só as gratuitas. Uma assinante
    // antiga que cair para FREE meses depois volta a ser elegível pelo plano,
    // mas não pelo tempo de casa — e é a idade da conta que manda aqui.
    const marcadas: Record<string, Date | null> = {
      [CONTA_ANTIGA]: new Date("2026-09-21T12:00:00Z"),
    };
    instalarBanco(marcadas);
    instalarPlano("FREE"); // assinatura já expirada/cancelada → cai para FREE

    const POST = await getHandler();
    const body = await (await POST(post(makeAuthHeaders(CONTA_ANTIGA, "DIARISTA")))).json();

    assert.equal(body.shouldShow, false);
  });
});

describe("GET /api/me/subscription — leitura pura", () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  it("informa o estado da introdução sem reivindicá-la", async () => {
    // Ler não pode consumir a única exibição a que a conta tem direito: se o
    // GET marcasse, bastaria abrir a tela de planos uma vez para nunca mais
    // receber a apresentação.
    const marcadas: Record<string, Date | null> = {};
    const chamadas = instalarBanco(marcadas);
    instalarPlano("FREE");

    const mod = await import("../../src/app/api/me/subscription/route");
    const req = new Request("http://test/api/me/subscription", {
      headers: makeAuthHeaders(CONTA_A, "DIARISTA"),
    });
    const body = await (await mod.GET(req)).json();

    assert.equal(body.premiumIntroShown, false);
    assert.equal(chamadas.updateMany, 0, "o GET não escreve");
    assert.equal(marcadas[CONTA_A] ?? null, null);
  });

  it("reflete a marca de quem já viu", async () => {
    instalarBanco({ [CONTA_ANTIGA]: new Date("2026-09-21T12:00:00Z") });
    instalarPlano("FREE");

    const mod = await import("../../src/app/api/me/subscription/route");
    const req = new Request("http://test/api/me/subscription", {
      headers: makeAuthHeaders(CONTA_ANTIGA, "DIARISTA"),
    });
    const body = await (await mod.GET(req)).json();

    assert.equal(body.premiumIntroShown, true);
  });
});
