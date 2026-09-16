import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeAuthHeaders } from "./_helpers";

/**
 * POST /api/admin/verificacoes/approve e /reprove contra Postgres REAL:
 * concorrência sobre a MESMA DocumentVerification.
 *
 * Achado que motivou a correção: o `update` final (approve e reprove) não
 * tinha `status` no WHERE — não era CAS. Duas chamadas simultâneas sobre a
 * mesma verificação PENDING (dois cliques do admin, duas abas, ou uma
 * aprovação e uma reprovação disparadas quase juntas) reaplicavam os efeitos
 * de perfil (DiaristaProfile.verificacao / MontadorPerfil.verificado) e
 * arriscavam reprocessar o evento de SafeScore sobre uma verificação já
 * decidida. A correção: `updateMany({ where: { id, status: "PENDING" } })`
 * dentro da transação, antes de qualquer efeito colateral.
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

type Handler = (req: Request) => Promise<Response>;

describe("aprovação/reprovação de KYC contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let approve: Handler;
  let reprove: Handler;

  const RUN = `t_kycdb_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  const verificacoes: string[] = [];
  let seq = 0;

  async function diarista(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Diarista KYC ${sufixo}`, role: "DIARISTA" } });
    usuarios.push(id);
    return id;
  }

  async function verificacaoPendente(userId: string) {
    const v = await prisma.documentVerification.create({
      data: {
        id: `${RUN}_v_${seq++}`,
        userId,
        docType: "DIARISTA_KYC",
        docUrl: `verificacoes/${userId}/frente.jpg`,
        status: "PENDING",
      },
    });
    verificacoes.push(v.id);
    return v.id;
  }

  const admin = `${RUN}_admin`;

  function postAprovar(verificationId: string) {
    return approve(
      new Request("http://test/api/admin/verificacoes/approve", {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(admin, "ADMIN") },
        body: JSON.stringify({ id: verificationId, motivo: "aprovado no teste" }),
      }),
    ).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
  }

  function postReprovar(verificationId: string) {
    return reprove(
      new Request("http://test/api/admin/verificacoes/reprove", {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(admin, "ADMIN") },
        body: JSON.stringify({ id: verificationId, motivo: "reprovado no teste" }),
      }),
    ).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
  }

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    approve = (await import("../../src/app/api/admin/verificacoes/approve/route")).POST as Handler;
    reprove = (await import("../../src/app/api/admin/verificacoes/reprove/route")).POST as Handler;
    // O admin também passa por User (FK de reviewedBy não existe no schema,
    // mas ADMIN não precisa de perfil — só o registro em User por hygiene).
    await prisma.user.upsert({
      where: { id: admin },
      update: {},
      create: { id: admin, nome: "Admin Teste", role: "ADMIN" },
    });
    usuarios.push(admin);
  });

  after(async () => {
    if (!prisma) return;
    await prisma.documentVerification.deleteMany({ where: { id: { in: verificacoes } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.safeScoreEvent.deleteMany({ where: { userId: { in: usuarios } } }).catch(() => {});
    await prisma.safeScoreProfile.deleteMany({ where: { userId: { in: usuarios } } }).catch(() => {});
    const legados = await prisma.safeScore.findMany({ where: { userId: { in: usuarios } }, select: { id: true } });
    await prisma.scoreEvento.deleteMany({ where: { safeScoreId: { in: legados.map((l: any) => l.id) } } }).catch(() => {});
    await prisma.safeScore.deleteMany({ where: { userId: { in: usuarios } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("5 aprovações simultâneas da mesma verificação PENDING: exatamente 1×200 e 4×409", async (t) => {
    const dia = await diarista("a");
    const v = await verificacaoPendente(dia);

    const respostas = await Promise.all(Array.from({ length: 5 }, () => postAprovar(v)));
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);

    const status = respostas.map((r) => r.status);
    assert.equal(status.filter((s) => s === 200).length, 1, `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual([...status].sort(), [200, 409, 409, 409, 409], `status reais: ${JSON.stringify(status)}`);

    const final = await prisma.documentVerification.findUnique({ where: { id: v } });
    assert.equal(final.status, "APPROVED");
    const perfil = await prisma.diaristaProfile.findUnique({ where: { userId: dia } });
    assert.equal(perfil?.verificacao, "VERIFICADO");

    // O CAS bloqueou as 4 perdedoras antes de qualquer efeito colateral —
    // só deve existir 1 evento de score, não 5.
    const eventos = await prisma.safeScoreEvent.count({ where: { userId: dia } });
    assert.equal(eventos, 1, "aprovação duplicada não pode reaplicar o evento de score");
  });

  it("aprovar e reprovar simultaneamente a mesma verificação PENDING: só uma decisão vence", async (t) => {
    const dia = await diarista("b");
    const v = await verificacaoPendente(dia);

    const respostas = await Promise.all([
      postAprovar(v),
      postAprovar(v),
      postReprovar(v),
      postReprovar(v),
    ]);
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);

    const vencedores = respostas.filter((r) => r.status === 200);
    assert.equal(vencedores.length, 1, `deveria haver exatamente 1 vencedor — status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);
    for (const r of respostas.filter((x) => x.status !== 200)) {
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.equal(r.body?.ok, false);
    }

    const final = await prisma.documentVerification.findUnique({ where: { id: v } });
    assert.ok(final.status === "APPROVED" || final.status === "REJECTED", final.status);

    const perfil = await prisma.diaristaProfile.findUnique({ where: { userId: dia } });
    assert.equal(
      perfil?.verificacao,
      final.status === "APPROVED" ? "VERIFICADO" : "REPROVADO",
      "o efeito de perfil tem que bater com quem realmente venceu o CAS, não com quem respondeu por último",
    );

    // Um único evento de score, do tipo que corresponde a quem venceu — nunca
    // os dois (aprovado E reprovado) sobre a mesma verificação.
    const eventos = await prisma.safeScoreEvent.count({ where: { userId: dia } });
    assert.equal(eventos, 1, "só a decisão vencedora pode ter gerado evento de score");
  });
});
