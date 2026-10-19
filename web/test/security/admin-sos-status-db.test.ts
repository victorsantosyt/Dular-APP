import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeAuthHeaders } from "./_helpers";

/**
 * Status de atendimento do SOS contra Postgres REAL: a rota
 * PATCH /api/admin/seguranca/sos/[id]/status e os dois pontos que gravam SOS
 * (POST /api/seguranca/sos e registrarMotivoGrave).
 *
 * Mesmo protocolo das outras suítes de banco: SAFESCORE_DB_URL local;
 * obrigatório no CI (SAFESCORE_DB_REQUIRED=1).
 */

const URL_BANCO = process.env.SAFESCORE_DB_URL;
const PULAR = !URL_BANCO
  ? "defina SAFESCORE_DB_URL (Postgres local com as migrations aplicadas)"
  : !/@(localhost|127\.0\.0\.1)[:/]/.test(URL_BANCO)
    ? "SAFESCORE_DB_URL não aponta para localhost — recusado"
    : false;
const EXIGIDO = process.env.SAFESCORE_DB_REQUIRED === "1";

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

describe("status de SOS no painel admin contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let patchStatus: Handler;
  let postSos: (req: Request) => Promise<Response>;
  let registrarMotivoGrave: (p: any) => Promise<void>;

  const RUN = `t_sosst_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  let admin: string;
  let admin2: string;
  let empregador: string;
  let diarista: string;

  async function usuario(sufixo: string, role: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `SOS ${sufixo}`, role } });
    usuarios.push(id);
    return id;
  }

  async function sos(userId: string, status: string | null) {
    const e = await prisma.safetyEvent.create({ data: { type: "SOS_SILENT", userId, status } });
    return e.id as string;
  }

  async function patch(id: string, headers: Record<string, string>, body: unknown) {
    const res = await patchStatus(
      new Request(`http://test/api/admin/seguranca/sos/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  const comoAdmin = (id = admin) => makeAuthHeaders(id, "ADMIN");
  const auditoria = (targetId: string) =>
    prisma.auditLog.findMany({ where: { targetId, targetType: "SafetyEvent" }, orderBy: { createdAt: "asc" } });

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    patchStatus = (await import("../../src/app/api/admin/seguranca/sos/[id]/status/route")).PATCH as Handler;
    postSos = (await import("../../src/app/api/seguranca/sos/route")).POST;
    ({ registrarMotivoGrave } = await import("../../src/lib/safetyMotivo"));

    admin = await usuario("admin", "ADMIN");
    admin2 = await usuario("admin2", "ADMIN");
    empregador = await usuario("emp", "EMPREGADOR");
    diarista = await usuario("dia", "DIARISTA");
  });

  after(async () => {
    if (!prisma) return;
    await prisma.auditLog.deleteMany({ where: { actorId: { in: usuarios } } });
    await prisma.safetyEvent.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("401 sem token; 403 para quem não é ADMIN no banco, mesmo com token dizendo ADMIN", async () => {
    const id = await sos(diarista, "ACIONADO");
    const corpo = { status: "EM_ATENDIMENTO", statusAnterior: "ACIONADO" };

    assert.equal((await patch(id, {}, corpo)).status, 401);
    assert.equal((await patch(id, makeAuthHeaders(empregador, "EMPREGADOR"), corpo)).status, 403);
    assert.equal((await patch(id, makeAuthHeaders(empregador, "ADMIN"), corpo)).status, 403);
    assert.equal((await prisma.safetyEvent.findUnique({ where: { id } })).status, "ACIONADO");
  });

  it("400 para status fora do enum ou sem statusAnterior", async () => {
    const id = await sos(diarista, "ACIONADO");
    assert.equal((await patch(id, comoAdmin(), { status: "ARQUIVADO", statusAnterior: "ACIONADO" })).status, 400);
    assert.equal((await patch(id, comoAdmin(), { status: "RESOLVIDO" })).status, 400);
  });

  it("404 para check-in e para id inexistente", async () => {
    const checkin = (await prisma.safetyEvent.create({ data: { type: "CHECKIN_OK", userId: diarista } })).id;
    const corpo = { status: "EM_ATENDIMENTO", statusAnterior: "ACIONADO" };
    assert.equal((await patch(checkin, comoAdmin(), corpo)).status, 404);
    assert.equal((await patch(`${RUN}_nao_existe`, comoAdmin(), corpo)).status, 404);
    assert.equal((await prisma.safetyEvent.findUnique({ where: { id: checkin } })).status, null);
  });

  it("SOS anterior à migration (status nulo) conta como ACIONADO: muda e grava AuditLog", async () => {
    const id = await sos(diarista, null);

    const r = await patch(id, comoAdmin(), { status: "EM_ATENDIMENTO", statusAnterior: "ACIONADO" });

    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true, alterado: true, status: "EM_ATENDIMENTO" });
    const e = await prisma.safetyEvent.findUnique({ where: { id } });
    assert.equal(e.status, "EM_ATENDIMENTO");
    assert.equal(e.statusAtualizadoPorId, admin);
    assert.ok(e.statusAtualizadoEm instanceof Date);

    const logs = await auditoria(id);
    assert.equal(logs.length, 1);
    assert.deepEqual(
      { actorId: logs[0].actorId, action: logs[0].action, before: logs[0].before, after: logs[0].after },
      { actorId: admin, action: "SOS_STATUS_ALTERADO", before: { status: "ACIONADO" }, after: { status: "EM_ATENDIMENTO" } },
    );
  });

  it("tela desatualizada: statusAnterior diferente do atual dá 409 e não grava nada", async () => {
    const id = await sos(diarista, "RESOLVIDO");

    const r = await patch(id, comoAdmin(), { status: "EM_ATENDIMENTO", statusAnterior: "ACIONADO" });

    assert.equal(r.status, 409);
    assert.equal(r.body.statusAtual, "RESOLVIDO");
    assert.equal((await prisma.safetyEvent.findUnique({ where: { id } })).status, "RESOLVIDO");
    assert.equal((await auditoria(id)).length, 0);
  });

  it("mesmo status: 200 sem alteração e sem AuditLog", async () => {
    const id = await sos(diarista, "EM_ATENDIMENTO");

    const r = await patch(id, comoAdmin(), { status: "EM_ATENDIMENTO", statusAnterior: "EM_ATENDIMENTO" });

    assert.equal(r.status, 200);
    assert.equal(r.body.alterado, false);
    assert.equal((await auditoria(id)).length, 0);
  });

  it("reabrir: de RESOLVIDO para ACIONADO", async () => {
    const id = await sos(diarista, "RESOLVIDO");
    const r = await patch(id, comoAdmin(), { status: "ACIONADO", statusAnterior: "RESOLVIDO" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await prisma.safetyEvent.findUnique({ where: { id } })).status, "ACIONADO");
  });

  it("dois admins ao mesmo tempo: 5 mudanças simultâneas a partir de ACIONADO dão 1×200 e 4×409, com um único AuditLog", async (t) => {
    const id = await sos(diarista, null);
    const alvos = ["EM_ATENDIMENTO", "RESOLVIDO", "EM_ATENDIMENTO", "RESOLVIDO", "EM_ATENDIMENTO"];

    const respostas = await Promise.all(
      alvos.map((status, i) => patch(id, comoAdmin(i % 2 ? admin2 : admin), { status, statusAnterior: "ACIONADO" })),
    );
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);

    assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409, 409, 409, 409]);
    const vencedora = alvos[respostas.findIndex((r) => r.status === 200)];
    assert.equal((await prisma.safetyEvent.findUnique({ where: { id } })).status, vencedora);
    assert.equal((await auditoria(id)).length, 1);
  });

  it("quem grava SOS preenche ACIONADO: POST /api/seguranca/sos (sem serviço) e registrarMotivoGrave", async () => {
    const res = await postSos(
      new Request("http://test/api/seguranca/sos", {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(diarista, "DIARISTA") },
        body: JSON.stringify({ tipo: "Emergência 190", mensagem: "teste de SOS" }),
      }),
    );
    const corpo = await res.json();
    assert.equal(res.status, 200, JSON.stringify(corpo));
    const doBotao = await prisma.safetyEvent.findUnique({ where: { id: corpo.id } });
    assert.deepEqual(
      { type: doBotao.type, status: doBotao.status, serviceId: doBotao.serviceId, tipo: doBotao.meta?.tipo },
      { type: "SOS_SILENT", status: "ACIONADO", serviceId: null, tipo: "Emergência 190" },
    );

    const servicoId = `${RUN}_srv_motivo`;
    await registrarMotivoGrave({
      servicoId,
      motivo: "problema_seguranca",
      observacao: "relato do teste",
      reporterId: empregador,
      reportedUserId: null,
      acao: "CANCELADO",
    });
    const doMotivo = await prisma.safetyEvent.findFirst({ where: { userId: empregador, serviceId: servicoId } });
    assert.equal(doMotivo?.type, "SOS_SILENT");
    assert.equal(doMotivo?.status, "ACIONADO");

    // O painel separa as duas origens pelo `meta` que cada ponto de escrita
    // grava de verdade: confere o critério contra as linhas reais, não contra um mock.
    const { origemDoSos, prioridadeNaFila } = await import("../../src/lib/sosPainel");
    assert.deepEqual(
      { origem: origemDoSos(doBotao.meta), prioridade: prioridadeNaFila(doBotao.meta) },
      { origem: "BOTAO", prioridade: "CRITICA" },
    );
    assert.deepEqual(
      { origem: origemDoSos(doMotivo.meta), prioridade: prioridadeNaFila(doMotivo.meta) },
      { origem: "MOTIVO_GRAVE", prioridade: "ALTA" },
    );
  });
});

// Encerra o pool do Prisma ao fim do arquivo. Sem isto, as conexões ociosas
// seguram o processo por ~10 s (pg-pool: idleTimeoutMillis = 10 s,
// allowExitOnIdle = false) — e sem prazo se uma conexão ficar presa numa
// transação de um teste que falhou.
after(async () => {
  await (globalThis as { prisma?: { $disconnect(): Promise<void> } }).prisma?.$disconnect();
});
