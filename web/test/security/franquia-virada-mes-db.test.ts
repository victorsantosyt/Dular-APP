import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Regra ATUAL da franquia (SOLICITACOES_MES), contra Postgres real, sem mudar
 * nada: o que entra na contagem, em que período, quando o limite bloqueia e se
 * "Meu plano" (/api/me/subscription) mostra o mesmo número que o aceite usa.
 *
 * Achado documentado aqui (não é correção): a contagem usa a data de CRIAÇÃO
 * do pedido, não a do aceite. Um pedido criado no mês anterior e aceito agora
 * não conta no mês corrente (nem trava o aceite), e passa a contar no mês em
 * que foi criado. As datas usam o fuso do servidor (UTC na Vercel).
 */
const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

describe("franquia entre meses: contagem, período e bloqueio (DB)", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let check: (u: string, f: "SOLICITACOES_MES") => Promise<any>;
  let assinatura: (r: Request) => Promise<Response>;
  let makeAuthHeaders: (u: string, r: any) => Record<string, string>;
  const RUN = `t_franq_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  async function pessoa(sufixo: string, role: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: sufixo, role, status: "ATIVO" } });
    usuarios.push(id);
    return id;
  }

  async function pedido(cliente: string, pro: string, criadoEm: Date, status: string) {
    return prisma.servico.create({
      data: { clientId: cliente, diaristaId: pro, tipo: "FAXINA", data: new Date(Date.now() + 86_400_000), turno: "MANHA", cidade: "Teste", uf: "MT", bairro: "Centro", precoFinal: 100, status, createdAt: criadoEm },
    });
  }

  async function meuPlano(u: string) {
    const r = await assinatura(new Request("http://test/api/me/subscription", { headers: makeAuthHeaders(u, "DIARISTA") }));
    const corpo = await r.json();
    return (corpo.data ?? corpo).usage.solicitacoesMes;
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    check = (await import("../../src/lib/featureGate")).checkFeatureAccess;
    assinatura = (await import("../../src/app/api/me/subscription/route")).GET;
    ({ makeAuthHeaders } = await import("./_helpers"));
  });

  after(async () => {
    if (!prisma) return;
    await prisma.servico.deleteMany({ where: { OR: [{ clientId: { in: usuarios } }, { diaristaId: { in: usuarios } }] } });
    await prisma.subscription.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
  });

  it("limites do intervalo: conta [início do mês, início do próximo), pelo fuso do servidor", async () => {
    const cliente = await pessoa("cli1", "EMPREGADOR");
    const pro = await pessoa("pro1", "DIARISTA");
    await pedido(cliente, pro, new Date(inicio.getTime() - 1), "ACEITO"); // último ms do mês anterior: fora
    await pedido(cliente, pro, inicio, "ACEITO"); // primeiro ms: dentro
    await pedido(cliente, pro, new Date(fim.getTime() - 1), "ACEITO"); // último ms: dentro
    await pedido(cliente, pro, fim, "ACEITO"); // primeiro ms do próximo: fora
    const r = await check(pro, "SOLICITACOES_MES");
    assert.equal(r.used, 2);
    assert.deepEqual(r.periodo, { inicio: inicio.toISOString(), fim: fim.toISOString() });
  });

  it("pedido criado no mês anterior e aceito agora: não conta no mês corrente nem trava o aceite (lacuna da regra atual)", async () => {
    const cliente = await pessoa("cli2", "EMPREGADOR");
    const pro = await pessoa("pro2", "DIARISTA");
    for (let i = 0; i < 4; i++) await pedido(cliente, pro, new Date(inicio.getTime() + 60_000 * (i + 1)), "ACEITO");
    // Três pedidos de antes da virada, aceitos depois dela.
    for (let i = 0; i < 3; i++) await pedido(cliente, pro, new Date(inicio.getTime() - 3_600_000 * (i + 1)), "ACEITO");
    const r = await check(pro, "SOLICITACOES_MES");
    assert.equal(r.used, 4, "só os 4 criados neste mês");
    assert.equal(r.limit, 5);
    assert.equal(r.allowed, true, "o aceite seguinte ainda é permitido");
    // "Meu plano" mostra o MESMO número que o aceite usa.
    const tela = await meuPlano(pro);
    assert.equal(tela.used, r.used);
    assert.equal(tela.limit, r.limit);
    assert.equal(tela.allowed, r.allowed);
  });

  it("no limite bloqueia; cancelado e recusado não contam (cancelar devolve a vaga)", async () => {
    const cliente = await pessoa("cli3", "EMPREGADOR");
    const pro = await pessoa("pro3", "DIARISTA");
    const aceitos = [];
    for (let i = 0; i < 5; i++) aceitos.push(await pedido(cliente, pro, new Date(inicio.getTime() + 60_000 * (i + 1)), "ACEITO"));
    await pedido(cliente, pro, new Date(inicio.getTime() + 600_000), "RECUSADO");
    await pedido(cliente, pro, new Date(inicio.getTime() + 700_000), "SOLICITADO"); // pendente: não é aceito
    let r = await check(pro, "SOLICITACOES_MES");
    assert.deepEqual([r.used, r.allowed], [5, false], "5 de 5: bloqueia");
    await prisma.servico.update({ where: { id: aceitos[0].id }, data: { status: "CANCELADO" } });
    r = await check(pro, "SOLICITACOES_MES");
    assert.deepEqual([r.used, r.allowed], [4, true], "cancelado sai da contagem");
  });

  it("mudança de plano: o mesmo uso vale contra o limite do plano efetivo", async () => {
    const cliente = await pessoa("cli4", "EMPREGADOR");
    const pro = await pessoa("pro4", "DIARISTA");
    for (let i = 0; i < 6; i++) await pedido(cliente, pro, new Date(inicio.getTime() + 60_000 * (i + 1)), "ACEITO");
    const gratuito = await check(pro, "SOLICITACOES_MES");
    assert.deepEqual([gratuito.plan, gratuito.limit, gratuito.used, gratuito.allowed], ["FREE", 5, 6, false]);
    const validade = new Date(Date.now() + 30 * 86_400_000);
    const sub = await prisma.subscription.create({ data: { userId: pro, plan: "BASIC", status: "ACTIVE", provider: "STRIPE", externalId: `sub_${RUN}`, expiresAt: validade } });
    let r = await check(pro, "SOLICITACOES_MES");
    assert.deepEqual([r.plan, r.limit, r.used, r.allowed], ["BASIC", 10, 6, true]);
    await prisma.subscription.update({ where: { id: sub.id }, data: { plan: "PREMIUM" } });
    r = await check(pro, "SOLICITACOES_MES");
    assert.deepEqual([r.plan, r.limit, r.allowed], ["PREMIUM", null, true]);
    assert.equal(r.used, 6, "o uso continua contado; só não limita");
  });
});
