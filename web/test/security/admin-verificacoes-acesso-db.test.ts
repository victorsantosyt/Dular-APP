import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Documentos de verificação: a URL assinada (que dá acesso a quem tiver o link
 * enquanto valer) só é gerada para ADMIN confirmado no BANCO e com a conta
 * ativa — o papel do token não basta — e nunca vai para o log.
 *
 * Postgres real (SAFESCORE_DB_URL local), S3 fictício: assinar é cálculo local,
 * nenhuma chamada sai para a AWS.
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("acesso aos documentos de verificação no painel (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let getDetalhe: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;
  let getLista: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_admdoc_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let verificacaoId = "";

  async function usuario(sufixo: string, role: string, status = "ATIVO") {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status } });
    ids.push(id);
    return id;
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    Object.assign(process.env, {
      DATABASE_URL: URL_BANCO,
      S3_REGION: "sa-east-1",
      S3_BUCKET: "dular-staging-uploads-teste",
      S3_ACCESS_KEY_ID: "AKIAFICTICIOTESTE000",
      S3_SECRET_ACCESS_KEY: "segredo-ficticio-de-teste",
    });
    ({ prisma } = await import("../../src/lib/prisma"));
    getDetalhe = (await import("../../src/app/api/admin/verificacoes/[id]/route")).GET as any;
    getLista = (await import("../../src/app/api/admin/verificacoes/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
    const dono = await usuario("dono", "MONTADOR");
    const v = await prisma.documentVerification.create({
      data: {
        userId: dono,
        docType: "RG",
        docUrl: JSON.stringify({ frente: `verificacoes/${RUN}/frente-ARQUIVO-DE-TESTE.jpg`, verso: `verificacoes/${RUN}/verso-ARQUIVO-DE-TESTE.jpg` }),
      },
    });
    verificacaoId = v.id;
  });

  after(async () => {
    if (!prisma) return;
    await prisma.documentVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  const detalhe = (headers: Record<string, string>) =>
    getDetalhe(new Request(`http://test/api/admin/verificacoes/${verificacaoId}`, { headers }), { params: Promise.resolve({ id: verificacaoId }) });

  /** Captura tudo que a rota manda ao console durante a chamada. */
  async function comLog<T>(fn: () => Promise<T>): Promise<{ r: T; log: string }> {
    const linhas: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { linhas.push(a.map(String).join(" ")); };
    try {
      return { r: await fn(), log: linhas.join("\n") };
    } finally {
      Object.assign(console, orig);
    }
  }

  it("ADMIN ativo no banco: recebe URL assinada de 5 min, e nada dela vai para o log", async () => {
    const admin = await usuario("admin", "ADMIN");
    const { r, log } = await comLog(() => detalhe(makeAuthHeaders(admin, "ADMIN")));
    assert.equal(r.status, 200);
    const texto = await r.text();
    assert.match(texto, /X-Amz-Signature/);
    assert.match(texto, /X-Amz-Expires=300/);
    assert.doesNotMatch(log, /X-Amz-|frente-ARQUIVO|verso-ARQUIVO/);
  });

  it("token com papel ADMIN, mas no banco deixou de ser admin: 403, sem URL", async () => {
    const ex = await usuario("ex_admin", "MONTADOR");
    const { r, log } = await comLog(() => detalhe(makeAuthHeaders(ex, "ADMIN")));
    assert.equal(r.status, 403);
    const texto = await r.text();
    assert.doesNotMatch(texto, /X-Amz-|frente-ARQUIVO/);
    assert.doesNotMatch(log, /X-Amz-/);
  });

  it("ADMIN bloqueado: 401, sem URL", async () => {
    const bloqueado = await usuario("admin_bloqueado", "ADMIN", "BLOQUEADO");
    const r = await detalhe(makeAuthHeaders(bloqueado, "ADMIN"));
    assert.equal(r.status, 401);
    assert.doesNotMatch(await r.text(), /X-Amz-/);
  });

  it("não-admin e sem sessão: negado, sem URL (lista e detalhe)", async () => {
    const montador = await usuario("montador", "MONTADOR");
    for (const headers of [makeAuthHeaders(montador, "MONTADOR"), {}]) {
      const d = await detalhe(headers);
      assert.ok([401, 403].includes(d.status));
      assert.doesNotMatch(await d.text(), /X-Amz-/);
      const l = await getLista(new Request("http://test/api/admin/verificacoes", { headers }));
      assert.ok([401, 403].includes(l.status));
    }
  });
});
