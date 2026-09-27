import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest, type Role } from "./_helpers";
import { resumoPagamento } from "../../src/lib/pagamentoPix";

/**
 * Pagamento no detalhe do serviço: o que cada participante vê e pode fazer
 * vem de UMA regra (lib/pagamentoPix `resumoPagamento`), a mesma no chat e
 * no detalhe — e não depende da conversa existir ou ter sido excluída.
 */

const EMP = "u-empregador";
const DIA = "u-diarista";
const MONT = "u-montador";
const OUTRO = "u-intruso";
const ADMIN = "u-admin";
const PAPEL: Record<string, Role> = { [EMP]: "EMPREGADOR", [DIA]: "DIARISTA", [MONT]: "MONTADOR", [OUTRO]: "EMPREGADOR", [ADMIN]: "ADMIN" };

const TODOS_STATUS = ["RASCUNHO", "SOLICITADO", "ACEITO", "RECUSADO", "CANCELADO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO", "CONCLUIDO", "CONFIRMADO", "FINALIZADO"] as const;
const TODOS_PAGAMENTOS = ["WAITING_PAYMENT", "PAYMENT_REPORTED", "PAYMENT_CONFIRMED", "PAYMENT_DISPUTED"] as const;
const CONTRATADO = new Set(["ACEITO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO", "CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);
const PAGAVEL = new Set(["WAITING_PAYMENT", "PAYMENT_DISPUTED"]);

// ── Regra pura ───────────────────────────────────────────────────────────────

describe("resumoPagamento — todos os status × pagamentos × participantes × chave PIX", () => {
  for (const status of TODOS_STATUS)
    for (const pagamento of TODOS_PAGAMENTOS)
      for (const temPix of [true, false])
        it(`${status} + ${pagamento} + ${temPix ? "com" : "sem"} PIX`, () => {
          const s = { status, paymentStatus: pagamento, precoFinal: 15000, clientId: EMP, diaristaId: DIA, montadorId: null } as const;
          const emp = resumoPagamento(s as never, EMP, temPix);
          const dia = resumoPagamento(s as never, DIA, temPix);
          const out = resumoPagamento(s as never, OUTRO, temPix);
          assert.deepEqual([emp.papel, dia.papel, out.papel], ["EMPREGADOR", "PROFISSIONAL", "OUTRO"]);
          assert.equal(emp.acoes.pagarComPix, CONTRATADO.has(status) && PAGAVEL.has(pagamento) && temPix);
          assert.equal(emp.acoes.confirmarRecebimento || emp.acoes.contestarRecebimento, false, "empregador não confirma nem contesta");
          assert.equal(dia.acoes.pagarComPix, false, "profissional não paga");
          assert.equal(dia.acoes.confirmarRecebimento, pagamento === "PAYMENT_REPORTED");
          assert.equal(dia.acoes.contestarRecebimento, pagamento === "PAYMENT_REPORTED");
          assert.deepEqual(out.acoes, { pagarComPix: false, confirmarRecebimento: false, contestarRecebimento: false });
          assert.equal(emp.paymentStatus, pagamento);
          assert.equal(emp.profissionalTemPix, temPix);
        });

  it("montador é o profissional quando o serviço é de montagem", () => {
    const s = { status: "CONCLUIDO", paymentStatus: "PAYMENT_REPORTED", precoFinal: 1, clientId: EMP, diaristaId: null, montadorId: MONT };
    assert.equal(resumoPagamento(s as never, MONT, true).acoes.confirmarRecebimento, true);
  });

  it("sem profissional atribuído, não há PIX para pagar", () => {
    const s = { status: "ACEITO", paymentStatus: "WAITING_PAYMENT", precoFinal: 1, clientId: EMP, diaristaId: null, montadorId: null };
    assert.equal(resumoPagamento(s as never, EMP, true).acoes.pagarComPix, false);
  });
});

// ── Banco em memória para as rotas ───────────────────────────────────────────

type Servico = {
  id: string; status: string; paymentStatus: string; precoFinal: number; clientId: string;
  diaristaId: string | null; montadorId: string | null; tipo: string; data: Date; turno: string;
  bairro: string; cidade: string; uf: string; enderecoCompleto: string | null;
  paymentReportedAt: Date | null; paymentConfirmedAt: Date | null; paymentDisputedAt: Date | null;
};
let servicos: Map<string, Servico>;
let salas: Map<string, { id: string; servicoId: string; createdAt: Date }>;
let exclusoes: Array<{ id: string; roomId: string; userId: string }>;
let msgs: any[];
let notifs: any[];
let eventos: any[];
let snapshots: Map<string, any>;
let paymentInfos: Map<string, any>;
let seq: number;

function servico(id: string, status: string, pagamento: string, prof: "diarista" | "montador" = "diarista"): Servico {
  return {
    id, status, paymentStatus: pagamento, precoFinal: 15000, clientId: EMP,
    diaristaId: prof === "diarista" ? DIA : null, montadorId: prof === "montador" ? MONT : null,
    tipo: prof === "montador" ? "MONTADOR" : "FAXINA", data: new Date(), turno: "TARDE",
    bairro: "Centro", cidade: "Água Boa", uf: "MT", enderecoCompleto: "Rua Exemplo, 1",
    paymentReportedAt: null, paymentConfirmedAt: null, paymentDisputedAt: null,
  };
}
const sala = (servicoId: string) => {
  let s = salas.get(servicoId);
  if (!s) { s = { id: `room-${servicoId}`, servicoId, createdAt: new Date() }; salas.set(servicoId, s); }
  return s;
};
function casa(o: Record<string, any>, w: Record<string, any> | undefined): boolean {
  if (!w) return true;
  return Object.entries(w).every(([k, c]) => {
    if (k === "OR") return (c as any[]).some((x) => casa(o, x));
    if (k === "room") return casaSala([...salas.values()].find((s) => s.id === o.roomId)!, c);
    const v = o[k];
    if (c === null) return v === null;
    if (c instanceof Date) return v instanceof Date && v.getTime() === c.getTime();
    if (typeof c !== "object") return v === c;
    if ("in" in c) return c.in.includes(v);
    if ("not" in c) return v !== c.not;
    throw new Error(`filtro não suportado: ${k}`);
  });
}
function casaSala(s: any, w: Record<string, any> | undefined): boolean {
  if (!w) return true;
  return Object.entries(w).every(([k, c]) => {
    if (k === "exclusoes") return !exclusoes.some((e) => e.roomId === s.id && casa(e, c.none));
    if (k === "servico") return casa(servicos.get(s.servicoId)!, c);
    return casa(s, { [k]: c });
  });
}
const pessoa = (id: string | null) => (id ? { id, nome: id, telefone: null, avatarUrl: null } : null);

function instalar() {
  mockPrisma.user.findUnique = async (a: any) =>
    a?.select?.pushToken ? { pushToken: `ExponentPushToken[${a.where.id}]` }
      : { id: a.where.id, nome: a.where.id, avatarUrl: null, role: PAPEL[a.where.id], lastSeenAt: null, status: "ATIVO" };
  mockPrisma.servico.findUnique = async (a: any) => {
    const s = servicos.get(a.where.id);
    if (!s) return null;
    if (!a.include) return { ...s };
    return {
      ...s, cliente: pessoa(s.clientId), diarista: pessoa(s.diaristaId), montador: pessoa(s.montadorId),
      avaliacao: null, avaliacaoEmpregador: null, pixSnapshot: snapshots.get(s.id) ?? null, eventos: [],
    };
  };
  mockPrisma.servico.updateMany = async (a: any) => {
    const s = servicos.get(a.where.id);
    const { id: _id, ...resto } = a.where;
    if (!s || !casa(s, resto)) return { count: 0 };
    Object.assign(s, a.data);
    return { count: 1 };
  };
  mockPrisma.paymentEvent.create = async (a: any) => (eventos.push(a.data), { id: `ev${++seq}` });
  (mockPrisma.notification as any).create = async (a: any) => { const n = { id: `n${++seq}`, readAt: null, ...a.data }; notifs.push(n); return { id: n.id }; };
  mockPrisma.notification.count = async (a: any) => notifs.filter((n) => casa(n, a.where)).length;
  mockPrisma.notification.updateMany = async (a: any) => { let c = 0; for (const n of notifs) if (casa(n, a.where)) (Object.assign(n, a.data), c++); return { count: c }; };
  mockPrisma.pixSnapshot.findUnique = async (a: any) => snapshots.get(a.where.servicoId) ?? null;
  mockPrisma.pixSnapshot.create = async (a: any) => { snapshots.set(a.data.servicoId, { id: `snap${++seq}`, createdAt: new Date(), ...a.data }); return a.data; };
  mockPrisma.paymentInfo.findUnique = async (a: any) => paymentInfos.get(a.where.userId) ?? null;
  mockPrisma.chatRoom.upsert = async (a: any) => { const s = sala(a.where.servicoId); return { ...s, _count: { messages: msgs.filter((m) => m.roomId === s.id).length } }; };
  mockPrisma.chatRoom.findUnique = async (a: any) => { const s = salas.get(a.where.servicoId); return s ? { id: s.id } : null; };
  (mockPrisma.chatRoom as any).findMany = async (a: any) => [...salas.values()].filter((s) => casaSala(s, a.where)).map((s) => {
    const sv = servicos.get(s.servicoId)!;
    return { ...s, servico: { ...sv, cliente: pessoa(sv.clientId), diarista: pessoa(sv.diaristaId), montador: pessoa(sv.montadorId) } };
  });
  mockPrisma.chatRoomExclusao.findFirst = async (a: any) => {
    const { room, ...resto } = a.where;
    const e = exclusoes.find((x) => casa(x, resto) && (!room || casaSala([...salas.values()].find((s) => s.id === x.roomId)!, room)));
    return e ? { id: e.id } : null;
  };
  mockPrisma.chatRoomExclusao.createMany = async (a: any) => {
    let c = 0;
    for (const d of a.data) if (!exclusoes.some((e) => e.roomId === d.roomId && e.userId === d.userId)) (exclusoes.push({ id: `ex${++seq}`, ...d }), c++);
    return { count: c };
  };
  mockPrisma.chatMessage.create = async (a: any) => { const m = { id: `m${++seq}`, deliveredAt: null, readAt: null, createdAt: new Date(), ...a.data }; msgs.push(m); return { ...m, sender: pessoa(m.senderId) }; };
  mockPrisma.chatMessage.findMany = async (a: any) => msgs.filter((m) => casa(m, a.where)).slice(0, a.take ?? 1000).map((m) => ({ ...m, sender: pessoa(m.senderId) }));
  mockPrisma.chatMessage.updateMany = async () => ({ count: 0 });
  (mockPrisma.chatMessage as any).count = async (a: any) => msgs.filter((m) => casa(m, a.where)).length;
  (mockPrisma.chatMessage as any).groupBy = async () => [];
}

const fetchOriginal = globalThis.fetch;
beforeEach(() => {
  resetMockPrisma();
  seq = 0;
  servicos = new Map(); salas = new Map(); exclusoes = []; msgs = []; notifs = []; eventos = [];
  snapshots = new Map(); paymentInfos = new Map();
  globalThis.fetch = (async () => ({ json: async () => ({ data: { status: "ok" } }) })) as any;
  instalar();
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

const auth = (quem: string) => makeAuthHeaders(quem, PAPEL[quem]);
const pid = (id: string) => ({ params: Promise.resolve({ id }) });
const rid = (id: string) => ({ params: Promise.resolve({ roomId: id }) });
async function detalhe(quem: string, id: string) {
  const { GET } = await import("../../src/app/api/servicos/[id]/route");
  const r = await GET(jsonRequest(`http://t/api/servicos/${id}`, null, auth(quem)), pid(id));
  return { status: r.status, body: await r.json() };
}
async function salaChat(quem: string, id: string) {
  const { GET } = await import("../../src/app/api/chat/[roomId]/route");
  const r = await GET(jsonRequest(`http://t/api/chat/${id}`, null, auth(quem)), rid(id));
  return { status: r.status, body: await r.json() };
}
async function excluirChat(quem: string, id: string) {
  const { DELETE } = await import("../../src/app/api/chat/[roomId]/route");
  const r = await DELETE(new Request(`http://t/api/chat/${id}`, { method: "DELETE", headers: auth(quem) }), rid(id));
  return { status: r.status, body: await r.json() };
}
async function acao(rota: "pix" | "pagamento/informar" | "pagamento/confirmar" | "pagamento/contestar", quem: string, id: string, body: unknown = {}) {
  const mod = await import(`../../src/app/api/servicos/[id]/${rota}/route`);
  const r = await mod.POST(jsonRequest(`http://t/api/servicos/${id}/${rota}`, body, auth(quem)), pid(id));
  return { status: r.status, body: await r.json() };
}
const PIX_DIA = { pixType: "EMAIL", pixKey: "carla@exemplo.test", bank: "Banco Exemplo", holderName: "Carla Exemplo" };

// ── Detalhe do serviço ───────────────────────────────────────────────────────

describe("GET /api/servicos/[id] — pagamento no detalhe", () => {
  it("empregador vê 'pagar com PIX'; profissional ainda não tem o que fazer", async () => {
    servicos.set("s1", servico("s1", "CONCLUIDO", "WAITING_PAYMENT"));
    paymentInfos.set(DIA, PIX_DIA);
    const e = await detalhe(EMP, "s1");
    assert.equal(e.status, 200);
    assert.deepEqual(e.body.pagamento, { paymentStatus: "WAITING_PAYMENT", precoFinal: 15000, profissionalTemPix: true, papel: "EMPREGADOR", acoes: { pagarComPix: true, confirmarRecebimento: false, contestarRecebimento: false } });
    const d = await detalhe(DIA, "s1");
    assert.deepEqual(d.body.pagamento.acoes, { pagarComPix: false, confirmarRecebimento: false, contestarRecebimento: false });
    assert.equal(d.body.pagamento.papel, "PROFISSIONAL");
  });

  it("contrato anterior preservado: servico, otherUserId e recebimento continuam lá", async () => {
    servicos.set("s1", servico("s1", "FINALIZADO", "PAYMENT_CONFIRMED"));
    snapshots.set("s1", { ...PIX_DIA, createdAt: new Date() });
    const e = await detalhe(EMP, "s1");
    assert.equal(e.body.ok, true);
    assert.equal(e.body.otherUserId, DIA);
    assert.equal(e.body.servico.id, "s1");
    assert.equal(e.body.servico.recebimento.titular, "Carla Exemplo");
    assert.notEqual(e.body.servico.recebimento.chaveMascarada, PIX_DIA.pixKey, "chave continua mascarada");
    assert.equal(JSON.stringify(e.body.pagamento).includes(PIX_DIA.pixKey), false, "o resumo não expõe a chave");
  });

  it("sem chave PIX (nem snapshot nem cadastro): empregador não recebe 'pagar'", async () => {
    servicos.set("s1", servico("s1", "EM_ANDAMENTO", "WAITING_PAYMENT"));
    const e = await detalhe(EMP, "s1");
    assert.equal(e.body.pagamento.profissionalTemPix, false);
    assert.equal(e.body.pagamento.acoes.pagarComPix, false);
  });

  it("autorização: não participante → 403 sem resumo; admin vê sem ações", async () => {
    servicos.set("s1", servico("s1", "CONCLUIDO", "PAYMENT_REPORTED"));
    const o = await detalhe(OUTRO, "s1");
    assert.equal(o.status, 403);
    assert.equal(o.body.pagamento, undefined);
    const a = await detalhe(ADMIN, "s1");
    assert.equal(a.status, 200);
    assert.equal(a.body.pagamento.papel, "OUTRO");
    assert.deepEqual(a.body.pagamento.acoes, { pagarComPix: false, confirmarRecebimento: false, contestarRecebimento: false });
  });

  it("chat e detalhe mostram o MESMO pagamento para cada participante", async () => {
    let i = 0;
    for (const status of ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO", "FINALIZADO"])
      for (const pag of TODOS_PAGAMENTOS)
        for (const comPix of [true, false]) {
          const id = `c${++i}`;
          servicos.set(id, servico(id, status, pag, i % 2 ? "diarista" : "montador"));
          paymentInfos.clear();
          if (comPix) { paymentInfos.set(DIA, PIX_DIA); paymentInfos.set(MONT, PIX_DIA); }
          for (const quem of [EMP, i % 2 ? DIA : MONT]) {
            const d = await detalhe(quem, id);
            const c = await salaChat(quem, id);
            assert.equal(c.status, 200);
            assert.deepEqual(c.body.room.pagamento, d.body.pagamento, `${id} ${status} ${pag} ${quem}`);
            assert.equal(c.body.room.pagamento.profissionalTemPix, comPix, "contrato antigo do chat mantido");
          }
        }
  });
});

// ── Fluxo completo com a conversa excluída pelos dois lados ─────────────────

describe("pagamento acessível sem o chat (conversa excluída por qualquer participante)", () => {
  it("pagar → contestar → pagar de novo → confirmar, tudo pelo detalhe, com o chat excluído pelos dois", async () => {
    servicos.set("s1", servico("s1", "CONCLUIDO", "WAITING_PAYMENT"));
    paymentInfos.set(DIA, PIX_DIA);
    sala("s1");
    // A regra de exclusão atual exige pagamento confirmado; aqui a exclusão é
    // gravada direto para provar que o pagamento não depende do chat (é o
    // cenário depois que a regra for relaxada).
    exclusoes.push({ id: "x1", roomId: sala("s1").id, userId: EMP }, { id: "x2", roomId: sala("s1").id, userId: DIA });
    assert.equal((await salaChat(EMP, "s1")).body.code, "CONVERSA_EXCLUIDA");
    assert.equal((await salaChat(DIA, "s1")).body.code, "CONVERSA_EXCLUIDA");

    assert.equal((await detalhe(EMP, "s1")).body.pagamento.acoes.pagarComPix, true);
    assert.equal((await acao("pix", EMP, "s1")).status, 200);
    assert.equal((await acao("pagamento/informar", EMP, "s1")).status, 200);
    let d = await detalhe(DIA, "s1");
    assert.deepEqual([d.body.pagamento.paymentStatus, d.body.pagamento.acoes.confirmarRecebimento, d.body.pagamento.acoes.contestarRecebimento], ["PAYMENT_REPORTED", true, true]);
    assert.equal((await detalhe(EMP, "s1")).body.pagamento.acoes.pagarComPix, false, "informado: empregador espera");

    assert.equal((await acao("pagamento/contestar", DIA, "s1", { motivo: "valor não caiu na conta" })).status, 200);
    assert.equal((await detalhe(EMP, "s1")).body.pagamento.acoes.pagarComPix, true, "contestado: empregador pode pagar de novo");
    assert.equal((await acao("pagamento/informar", EMP, "s1")).status, 200);
    assert.equal((await acao("pagamento/confirmar", DIA, "s1")).status, 200);

    for (const quem of [EMP, DIA]) {
      const r = await detalhe(quem, "s1");
      assert.equal(r.body.pagamento.paymentStatus, "PAYMENT_CONFIRMED");
      assert.deepEqual(r.body.pagamento.acoes, { pagarComPix: false, confirmarRecebimento: false, contestarRecebimento: false });
    }
    assert.deepEqual(
      notifs.map((n) => [n.type, n.userId]),
      [["PAGAMENTO_INFORMADO", DIA], ["PAGAMENTO_CONTESTADO", EMP], ["PAGAMENTO_INFORMADO", DIA], ["PAGAMENTO_CONFIRMADO", EMP]],
    );
    assert.equal((await salaChat(EMP, "s1")).body.code, "CONVERSA_EXCLUIDA", "exclusões continuam valendo");
  });

  it("operações duplicadas ou fora de hora são recusadas (409)", async () => {
    servicos.set("s1", servico("s1", "CONCLUIDO", "WAITING_PAYMENT"));
    paymentInfos.set(DIA, PIX_DIA);
    assert.equal((await acao("pagamento/confirmar", DIA, "s1")).status, 409, "confirmar sem pagamento informado");
    assert.equal((await acao("pagamento/informar", EMP, "s1")).status, 200);
    assert.equal((await acao("pagamento/informar", EMP, "s1")).status, 409, "informar duas vezes");
    assert.equal((await acao("pagamento/confirmar", DIA, "s1")).status, 200);
    assert.equal((await acao("pagamento/confirmar", DIA, "s1")).status, 409, "confirmar duas vezes");
    assert.equal((await acao("pagamento/contestar", DIA, "s1", { motivo: "tarde demais" })).status, 409, "contestar depois de confirmado");
    assert.equal((await acao("pix", EMP, "s1")).status, 409, "gerar PIX depois de confirmado");
    assert.equal(eventos.filter((e) => e.tipo === "PAYMENT_CONFIRMED").length, 1, "um único evento de confirmação");
  });

  it("autorização das ações: papel errado ou terceiro → 403", async () => {
    servicos.set("s1", servico("s1", "CONCLUIDO", "PAYMENT_REPORTED"));
    assert.equal((await acao("pagamento/confirmar", EMP, "s1")).status, 403);
    assert.equal((await acao("pagamento/confirmar", OUTRO, "s1")).status, 403);
    servicos.get("s1")!.paymentStatus = "WAITING_PAYMENT";
    assert.equal((await acao("pagamento/informar", DIA, "s1")).status, 403);
    assert.equal((await acao("pagamento/informar", OUTRO, "s1")).status, 403);
  });

  it("a regra de exclusão NÃO muda: pagamento pendente continua bloqueando o DELETE", async () => {
    for (const pag of ["WAITING_PAYMENT", "PAYMENT_REPORTED", "PAYMENT_DISPUTED"]) {
      servicos.set("s1", servico("s1", "FINALIZADO", pag));
      sala("s1");
      const r = await excluirChat(EMP, "s1");
      assert.deepEqual([r.status, r.body.code], [409, "PAGAMENTO_PENDENTE"], pag);
    }
    servicos.get("s1")!.paymentStatus = "PAYMENT_CONFIRMED";
    assert.equal((await excluirChat(EMP, "s1")).status, 200);
  });
});
