import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeAuthHeaders } from "./_helpers";

/**
 * POST /api/servicos/[id]/aceitar contra Postgres REAL: concorrência do CAS
 * de status (mesmo serviço, aceites simultâneos) e do limite mensal do plano
 * (mesmo profissional, serviços diferentes).
 *
 * Achados que motivaram a correção: o `update` final não tinha `status` no
 * WHERE — não era CAS nenhum —, e `checkFeatureAccess` contava uso fora de
 * qualquer transação/lock. Sob concorrência isso deixava passar dois bugs —
 * identificados em auditoria de código e reproduzidos localmente sob
 * concorrência real contra Postgres, sem confirmação em log de incidente de
 * produção: o mesmo serviço aceito duas vezes por chamadas
 * simultâneas, e o mesmo profissional passando do limite do plano (limite 5,
 * 9 aceitos).
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

const STATUS_QUE_CONTAM = [
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
] as const;

describe("aceitar serviço contra Postgres real", { skip: EXIGIDO ? false : PULAR }, () => {
  let prisma: any;
  let aceitar: Handler;

  const RUN = `t_acdb_${Date.now().toString(36)}`;
  const usuarios: string[] = [];
  const servicos: string[] = [];
  let seq = 0;

  async function empregador(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Empregador ${sufixo}`, role: "EMPREGADOR" } });
    usuarios.push(id);
    return id;
  }

  /** Diarista ATIVA + verificada — o suficiente para `canAcceptServico` no
   * Guardian (que, ao contrário de `canAppearInSearch`, não exige completude
   * de perfil, só verificação + score acima do corte + sem hardBan). */
  async function diaristaVerificada(sufixo: string) {
    const id = `${RUN}_${sufixo}`;
    await prisma.user.create({ data: { id, nome: `Diarista ${sufixo}`, role: "DIARISTA" } });
    await prisma.diaristaProfile.create({
      data: { userId: id, verificacao: "VERIFICADO", precoLeve: 10000, precoPesada: 15000 },
    });
    usuarios.push(id);
    return id;
  }

  async function servicoSolicitado(clientId: string, diaristaId: string) {
    const id = `${RUN}_srv_${seq++}`;
    await prisma.servico.create({
      data: {
        id,
        tipo: "FAXINA",
        data: new Date(),
        turno: "MANHA",
        cidade: "Agua Boa",
        uf: "MT",
        bairro: "Centro",
        precoFinal: 10000,
        clientId,
        diaristaId,
        status: "SOLICITADO",
      },
    });
    servicos.push(id);
    return id;
  }

  async function post(servicoId: string, diaristaId: string) {
    const res = await aceitar(
      new Request(`http://test/api/servicos/${servicoId}/aceitar`, {
        method: "POST",
        headers: { "content-type": "application/json", ...makeAuthHeaders(diaristaId, "DIARISTA") },
        body: "{}",
      }),
      { params: Promise.resolve({ id: servicoId }) },
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  const statusDo = async (id: string) => (await prisma.servico.findUnique({ where: { id } })).status;

  before(async () => {
    if (PULAR) throw new Error(`SAFESCORE_DB_REQUIRED=1, mas ${PULAR}`);
    process.env.DATABASE_URL = URL_BANCO;
    ({ prisma } = await import("../../src/lib/prisma"));
    aceitar = (await import("../../src/app/api/servicos/[id]/aceitar/route")).POST as Handler;
  });

  after(async () => {
    if (!prisma) return;
    await prisma.chatRoom.deleteMany({ where: { servicoId: { in: servicos } } });
    await prisma.pixSnapshot.deleteMany({ where: { servicoId: { in: servicos } } }).catch(() => {});
    await prisma.servicoEvento.deleteMany({ where: { servicoId: { in: servicos } } });
    await prisma.notification.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.servico.deleteMany({ where: { id: { in: servicos } } });
    await prisma.diaristaProfile.deleteMany({ where: { userId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("5 aceites simultâneos do mesmo serviço: exatamente 1×200 e 4×409", async (t) => {
    const emp = await empregador("n_emp");
    const dia = await diaristaVerificada("n_dia");
    const srv = await servicoSolicitado(emp, dia);

    const respostas = await Promise.all(Array.from({ length: 5 }, () => post(srv, dia)));
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);

    const status = respostas.map((r) => r.status);
    assert.equal(status.filter((s) => s === 200).length, 1, `status reais: ${JSON.stringify(status)}`);
    assert.deepEqual([...status].sort(), [200, 409, 409, 409, 409], `status reais: ${JSON.stringify(status)}`);
    for (const r of respostas.filter((x) => x.status !== 200)) {
      assert.equal(r.body?.ok, false);
      assert.doesNotMatch(
        JSON.stringify(r.body),
        /transaction|prisma|timeout|ECONN|expired|stack/i,
        "detalhe interno vazando para o cliente",
      );
    }
    assert.equal(await statusDo(srv), "ACEITO");
  });

  it("limite mensal do plano: profissional a 1 vaga do limite recebe só 1×200 entre N concorrentes, nunca estoura", async (t) => {
    const limiteFree = await prisma.featureLimit.findUnique({
      where: { plan_feature: { plan: "FREE", feature: "SOLICITACOES_MES" } },
      select: { limit: true, enabled: true },
    });
    if (!limiteFree?.enabled || limiteFree.limit == null || limiteFree.limit < 1) {
      t.skip("plano FREE sem limite numérico >=1 configurado para SOLICITACOES_MES neste banco");
      return;
    }

    const emp = await empregador("l_emp");
    const dia = await diaristaVerificada("l_dia");

    // Preenche o uso do mês até faltar exatamente 1 vaga.
    for (let i = 0; i < limiteFree.limit - 1; i++) {
      const jaAceito = await servicoSolicitado(emp, dia);
      await prisma.servico.update({ where: { id: jaAceito }, data: { status: "ACEITO" } });
    }

    // N serviços NOVOS, todos SOLICITADO, disputando a única vaga restante.
    const N = 5;
    const novos = await Promise.all(Array.from({ length: N }, () => servicoSolicitado(emp, dia)));

    const respostas = await Promise.all(novos.map((id) => post(id, dia)));
    t.diagnostic(`status reais: ${JSON.stringify(respostas.map((r) => r.status))}`);

    const status = respostas.map((r) => r.status);
    assert.equal(
      status.filter((s) => s === 200).length,
      1,
      `deveria sobrar exatamente 1 vaga — status reais: ${JSON.stringify(status)}`,
    );
    for (const r of respostas.filter((x) => x.status !== 200)) {
      assert.equal(r.status, 403, JSON.stringify(r.body));
      assert.equal(r.body?.error, "LIMIT_EXCEEDED", JSON.stringify(r.body));
    }

    // A garantia de fundo: a contagem final de "aceitos em diante" do
    // profissional bate exatamente com o limite do plano — nunca um a mais
    // (era isso que estourava: limite 5, 9 aceitos).
    const aceitosFinal = await prisma.servico.count({
      where: { diaristaId: dia, status: { in: [...STATUS_QUE_CONTAM] } },
    });
    assert.equal(
      aceitosFinal,
      limiteFree.limit,
      `contagem final de aceitos para o profissional: ${aceitosFinal}, limite: ${limiteFree.limit}`,
    );
  });
});
