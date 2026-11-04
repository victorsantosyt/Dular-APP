import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Vínculo explícito aviso → envio/decisão, contra Postgres real: decisão,
 * revisão rápida, decisão repetida, envios diferentes, aviso antigo sem
 * vínculo e aviso/vínculo de outra conta. A rota lida é a real
 * (GET /api/notificacoes/[id]/contexto).
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("aviso de verificação com vínculo explícito (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let decidir: (input: any) => Promise<any>;
  let contexto: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_vinc_${Date.now().toString(36)}`;
  const ids: string[] = [];
  let admin = "";
  const CONF = { documentoLegivel: true, dadosConferem: true, selfieCompativel: true };

  async function usuario(sufixo: string, role: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Teste ${sufixo}`, role, status: "ATIVO" } });
    ids.push(id);
    if (role === "DIARISTA") await prisma.diaristaProfile.create({ data: { userId: id, precoLeve: 100, precoPesada: 200 } });
    return id;
  }

  async function enviar(userId: string) {
    return prisma.documentVerification.create({
      data: { userId, docType: "KYC_DOCS", docUrl: JSON.stringify({ frente: "f.jpg", verso: "v.jpg", selfie: "s.jpg" }) },
    });
  }

  async function ctx(userId: string, avisoId: string) {
    const res = await contexto(
      new Request(`http://test/api/notificacoes/${avisoId}/contexto`, { headers: makeAuthHeaders(userId, "DIARISTA") }),
      { params: Promise.resolve({ id: avisoId }) },
    );
    return { status: res.status, corpo: await res.json() };
  }

  const avisos = (userId: string) => prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    process.env.DULAR_VERIFICACAO_SELFIE = "ligado";
    delete process.env.VERCEL_ENV;
    ({ prisma } = await import("../../src/lib/prisma"));
    decidir = (await import("../../src/lib/decisaoVerificacao")).decidirVerificacao;
    contexto = (await import("../../src/app/api/notificacoes/[id]/contexto/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
    admin = await usuario("admin", "ADMIN");
  });

  after(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.documentVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("envios diferentes, revisão rápida e decisão repetida: o vínculo diz exatamente de qual decisão é cada aviso", async () => {
    const u = await usuario("dona", "DIARISTA");

    const e1 = await enviar(u);
    const r1 = await decidir({ id: e1.id, adminId: admin, decisao: "REENVIO", motivo: "verso ilegível", revisao: false, motivoCategoria: "IMAGEM_ILEGIVEL" });
    assert.equal(r1.tipo, "decidida");
    const [n1] = await avisos(u);
    assert.equal(n1.verificacaoId, e1.id, "aviso aponta o envio");
    assert.ok(n1.decisaoVerificacaoId, "e a decisão");
    const d1 = await prisma.decisaoVerificacao.findUnique({ where: { id: n1.decisaoVerificacaoId } });
    assert.equal(d1.verificacaoId, e1.id);

    // Decisão repetida (mesma decisão, sem revisão): idempotente, sem aviso novo.
    const repetida = await decidir({ id: e1.id, adminId: admin, decisao: "REENVIO", motivo: "de novo", revisao: false, motivoCategoria: "IMAGEM_ILEGIVEL" });
    assert.equal(repetida.tipo, "ja-decidida");
    assert.equal((await avisos(u)).length, 1);

    // Novo envio aprovado: o aviso de reenvio é de envio anterior.
    const e2 = await enviar(u);
    assert.equal((await decidir({ id: e2.id, adminId: admin, decisao: "APROVADO", motivo: "ok", revisao: false, conferencia: CONF })).tipo, "decidida");
    // Revisão logo em seguida (mesmo segundo): só o vínculo distingue as duas.
    assert.equal(
      (await decidir({ id: e2.id, adminId: admin, decisao: "REPROVADO", motivo: "revisto", revisao: true, esperado: "APROVADO", motivoCategoria: "DADOS_DIVERGENTES" })).tipo,
      "decidida",
    );
    const [, n2, n3] = await avisos(u);
    assert.equal(n2.verificacaoId, e2.id);
    assert.equal(n3.verificacaoId, e2.id);
    assert.notEqual(n2.decisaoVerificacaoId, n3.decisaoVerificacaoId);

    assert.deepEqual((await ctx(u, n1.id)).corpo.verificacao, { relacao: "ENVIO_ANTERIOR", vinculo: "EXPLICITO", decisaoDoAviso: "REENVIO" });
    assert.deepEqual((await ctx(u, n2.id)).corpo.verificacao, { relacao: "SUPERADA", vinculo: "EXPLICITO", decisaoDoAviso: "APROVADO" });
    assert.deepEqual((await ctx(u, n3.id)).corpo.verificacao, { relacao: "VIGENTE", vinculo: "EXPLICITO", decisaoDoAviso: "REPROVADO" });
  });

  it("aviso antigo sem vínculo: não nomeia decisão; só o que o tempo garante", async () => {
    const u = await usuario("legado", "DIARISTA");
    const antes = await prisma.notification.create({
      data: { userId: u, type: "VERIFICACAO_REPROVADA", title: "t", body: "b", createdAt: new Date(Date.now() - 3_600_000) },
    });
    const e = await enviar(u);
    await decidir({ id: e.id, adminId: admin, decisao: "APROVADO", motivo: "ok", revisao: false, conferencia: CONF });
    const depois = await prisma.notification.create({ data: { userId: u, type: "VERIFICACAO_APROVADA", title: "t", body: "b" } });

    assert.deepEqual((await ctx(u, antes.id)).corpo.verificacao, { relacao: "ENVIO_ANTERIOR", vinculo: "SEM_VINCULO", decisaoDoAviso: null });
    assert.deepEqual((await ctx(u, depois.id)).corpo.verificacao, { relacao: "INDETERMINADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null });
  });

  it("outra conta: aviso alheio é 404; vínculo apontando envio alheio não revela nada", async () => {
    const a = await usuario("a", "DIARISTA");
    const b = await usuario("b", "DIARISTA");
    const eb = await enviar(b);
    await decidir({ id: eb.id, adminId: admin, decisao: "APROVADO", motivo: "ok", revisao: false, conferencia: CONF });
    const [nb] = await avisos(b);

    assert.equal((await ctx(a, nb.id)).status, 404, "aviso de outra conta");

    await enviar(a);
    const forjado = await prisma.notification.create({
      data: { userId: a, type: "VERIFICACAO_APROVADA", title: "t", body: "b", verificacaoId: eb.id, decisaoVerificacaoId: nb.decisaoVerificacaoId },
    });
    const r = await ctx(a, forjado.id);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.verificacao, { relacao: "INDETERMINADA", vinculo: "SEM_VINCULO", decisaoDoAviso: null });
  });
});
