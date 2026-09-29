import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest, type Role } from "./_helpers";

/**
 * Exclusão de conversa ARQUIVADA por participante (DELETE /api/chat/[roomId]).
 *
 * Regra: a conversa sai só da lista de quem excluiu. O outro participante, as
 * mensagens, a sala, o serviço e as avaliações não mudam. Um banco em memória
 * com a semântica do Prisma que as rotas usam exercita as rotas REAIS — lista,
 * sala, mensagens, notificação e badge do push.
 */

const EMP = "u-empregador";
const DIA = "u-diarista";
const MONT = "u-montador";
const INTRUSO = "u-intruso";
const PAPEL: Record<string, Role> = { [EMP]: "EMPREGADOR", [DIA]: "DIARISTA", [MONT]: "MONTADOR", [INTRUSO]: "EMPREGADOR" };
const BASE = Date.UTC(2026, 8, 26, 15, 0);

type Servico = {
  id: string;
  status: string;
  clientId: string;
  diaristaId: string | null;
  montadorId: string | null;
  tipo: string;
  data: Date;
  turno: string;
  bairro: string;
  cidade: string;
  uf: string;
  precoFinal: number;
  paymentStatus: string | null;
};
type Sala = { id: string; servicoId: string; createdAt: Date };
type Msg = {
  id: string;
  roomId: string;
  type: string;
  content: string;
  senderId: string;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
};
type Notif = { id: string; userId: string; type: string; servicoId: string | null; chatRoomId: string | null; readAt: Date | null };

let servicos: Map<string, Servico>;
let salas: Map<string, Sala>;
let msgs: Msg[];
let exclusoes: Array<{ id: string; roomId: string; userId: string; createdAt: Date }>;
let notifs: Notif[];
let pushes: any[];
let seq: number;

function servico(id: string, status: string, profissional: "diarista" | "montador" = "diarista"): Servico {
  return {
    id,
    status,
    clientId: EMP,
    diaristaId: profissional === "diarista" ? DIA : null,
    montadorId: profissional === "montador" ? MONT : null,
    tipo: profissional === "montador" ? "MONTADOR" : "FAXINA",
    data: new Date(BASE),
    turno: "TARDE",
    bairro: "Centro",
    cidade: "Água Boa",
    uf: "MT",
    precoFinal: 10000,
    // Default do schema (Servico.paymentStatus @default(WAITING_PAYMENT)).
    paymentStatus: "WAITING_PAYMENT",
  };
}

function sala(servicoId: string): Sala {
  let s = salas.get(servicoId);
  if (!s) {
    s = { id: `room-${servicoId}`, servicoId, createdAt: new Date(BASE) };
    salas.set(servicoId, s);
  }
  return s;
}

/** Conversa com `n` mensagens; as `naoLidas` últimas são de `autor` e ainda não lidas. */
function conversa(servicoId: string, n: number, naoLidas: number, autor: string) {
  const roomId = sala(servicoId).id;
  const sv = servicos.get(servicoId)!;
  const outro = autor === sv.clientId ? (sv.montadorId ?? sv.diaristaId)! : sv.clientId;
  for (let i = 0; i < n; i++) {
    const nova = i >= n - naoLidas;
    const t = new Date(BASE + i * 60_000);
    msgs.push({
      id: `${servicoId}-m${String(i).padStart(3, "0")}`,
      roomId,
      type: "TEXT",
      content: `msg ${i} de ${servicoId}`,
      senderId: nova ? autor : i % 2 ? autor : outro,
      deliveredAt: nova ? null : t,
      readAt: nova ? null : t,
      createdAt: t,
    });
  }
}

function notif(userId: string, type: string, servicoId: string, lida = false) {
  notifs.push({
    id: `n${++seq}`,
    userId,
    type,
    servicoId,
    chatRoomId: type === "CHAT_NOVA_MENSAGEM" ? sala(servicoId).id : null,
    readAt: lida ? new Date(BASE) : null,
  });
}

// ── Prisma em memória ────────────────────────────────────────────────────────

function casa(obj: Record<string, any>, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as any[]).some((c) => casa(obj, c));
    if (k === "room") return casaSala(salaPorId(obj.roomId), cond);
    const v = obj[k];
    if (cond === null) return v === null;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond !== "object") return v === cond;
    if ("in" in cond) return cond.in.includes(v);
    if ("not" in cond) return v !== cond.not;
    if ("lt" in cond) return cond.lt instanceof Date ? v.getTime() < cond.lt.getTime() : v < cond.lt;
    throw new Error(`filtro não suportado no teste: ${k}`);
  });
}

const salaPorId = (id: string) => [...salas.values()].find((s) => s.id === id)!;

/** Filtro de relação ChatRoom: `exclusoes: { none }`, `servico: {...}` e campos próprios. */
function casaSala(s: Sala, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "exclusoes") {
      if (!cond.none) throw new Error("filtro de exclusões não suportado no teste");
      return !exclusoes.some((e) => e.roomId === s.id && casa(e, cond.none));
    }
    if (k === "servico") return casa(servicos.get(s.servicoId)!, cond);
    return casa(s, { [k]: cond });
  });
}

function ordenar<T extends Record<string, any>>(lista: T[], orderBy: any): T[] {
  const chaves: Array<[string, "asc" | "desc"]> = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).map(
    (o: Record<string, "asc" | "desc">) => Object.entries(o)[0] as [string, "asc" | "desc"],
  );
  return [...lista].sort((a, b) => {
    for (const [k, dir] of chaves) {
      const va = a[k] instanceof Date ? a[k].getTime() : a[k];
      const vb = b[k] instanceof Date ? b[k].getTime() : b[k];
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
    }
    return 0;
  });
}

const comRemetente = (m: Msg) => ({ ...m, sender: { id: m.senderId, nome: m.senderId, avatarUrl: null } });
const pessoa = (id: string | null) => (id ? { id, nome: id, avatarUrl: null } : null);

function instalarBanco() {
  mockPrisma.servico.findUnique = async (a: any) => {
    const s = servicos.get(a.where.id);
    return s ? { ...s } : null;
  };
  mockPrisma.user.findUnique = async (a: any) =>
    a?.select?.pushToken
      ? { pushToken: `ExponentPushToken[${a.where.id}]` }
      : { id: a.where.id, nome: a.where.id, avatarUrl: null, role: PAPEL[a.where.id], lastSeenAt: null, status: "ATIVO" };
  mockPrisma.pixSnapshot.findUnique = async () => null;
  mockPrisma.paymentInfo.findUnique = async () => null;

  mockPrisma.chatRoom.upsert = async (a: any) => {
    const s = sala(a.where.servicoId);
    return { ...s, _count: { messages: msgs.filter((m) => m.roomId === s.id).length } };
  };
  mockPrisma.chatRoom.findUnique = async (a: any) => {
    const s = salas.get(a.where.servicoId);
    return s ? { id: s.id } : null;
  };
  (mockPrisma.chatRoom as any).findMany = async (a: any) =>
    [...salas.values()]
      .filter((s) => casaSala(s, a.where))
      .map((s) => {
        const sv = servicos.get(s.servicoId)!;
        return {
          ...s,
          servico: { ...sv, cliente: pessoa(sv.clientId), diarista: pessoa(sv.diaristaId), montador: pessoa(sv.montadorId) },
        };
      });

  mockPrisma.chatRoomExclusao.findFirst = async (a: any) => {
    const { room, ...resto } = a.where;
    const e = exclusoes.find((x) => casa(x, resto) && (!room || casaSala(salaPorId(x.roomId), room)));
    return e ? { id: e.id } : null;
  };
  mockPrisma.chatRoomExclusao.createMany = async (a: any) => {
    let count = 0;
    for (const d of a.data) {
      const existe = exclusoes.some((e) => e.roomId === d.roomId && e.userId === d.userId);
      if (existe && !a.skipDuplicates) throw new Error("Unique constraint failed on (roomId, userId)");
      if (!existe) {
        exclusoes.push({ id: `ex${++seq}`, roomId: d.roomId, userId: d.userId, createdAt: new Date() });
        count++;
      }
    }
    return { count };
  };

  mockPrisma.chatMessage.findMany = async (a: any) => {
    let lista = ordenar(msgs.filter((m) => casa(m, a.where)), a.orderBy);
    if (a.distinct) {
      const vistos = new Set<string>();
      lista = lista.filter((m) => (vistos.has(m.roomId) ? false : (vistos.add(m.roomId), true)));
    }
    if (a.take) lista = lista.slice(0, a.take);
    return lista.map(comRemetente);
  };
  // lib/chatSala ultimaMensagemPorSala: uma linha por sala (a mais recente, desempate
  // por id), só salas com mensagem — a semântica do SQL com LATERAL ... LIMIT 1.
  (mockPrisma as any).$queryRaw = async (_sql: unknown, roomIds: string[]) =>
    roomIds.flatMap((id) => {
      const [m] = ordenar(msgs.filter((x) => x.roomId === id), [{ createdAt: "desc" }, { id: "desc" }]);
      return m ? [{ roomId: m.roomId, content: m.content, createdAt: m.createdAt, senderId: m.senderId, type: m.type ?? "TEXT" }] : [];
    });
  (mockPrisma.chatMessage as any).findFirst = async (a: any) => {
    const m = msgs.find((x) => casa(x, a.where));
    return m ? { id: m.id, createdAt: m.createdAt } : null;
  };
  mockPrisma.chatMessage.updateMany = async (a: any) => {
    let count = 0;
    for (const m of msgs) if (casa(m, a.where)) (Object.assign(m, a.data), count++);
    return { count };
  };
  (mockPrisma.chatMessage as any).groupBy = async (a: any) => {
    const contagem = new Map<string, number>();
    for (const m of msgs) if (casa(m, a.where)) contagem.set(m.roomId, (contagem.get(m.roomId) ?? 0) + 1);
    return [...contagem].map(([roomId, n]) => ({ roomId, _count: { _all: n } }));
  };
  (mockPrisma.chatMessage as any).count = async (a: any) => msgs.filter((m) => casa(m, a.where)).length;
  mockPrisma.chatMessage.create = async (a: any) => {
    const m: Msg = {
      id: `nova${++seq}`,
      roomId: a.data.roomId,
      type: a.data.type,
      content: a.data.content,
      senderId: a.data.senderId,
      deliveredAt: null,
      readAt: null,
      createdAt: new Date(BASE + 10 * 24 * 3600_000 + seq),
    };
    msgs.push(m);
    return comRemetente(m);
  };

  (mockPrisma.notification as any).create = async (a: any) => {
    const n: Notif = { id: `n${++seq}`, readAt: null, servicoId: null, chatRoomId: null, ...a.data };
    notifs.push(n);
    return { id: n.id };
  };
  mockPrisma.notification.count = async (a: any) => notifs.filter((n) => casa(n, a.where)).length;
  mockPrisma.notification.updateMany = async (a: any) => {
    let count = 0;
    for (const n of notifs) if (casa(n, a.where)) (Object.assign(n, a.data), count++);
    return { count };
  };
}

const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  resetMockPrisma();
  seq = 0;
  servicos = new Map(
    [
      // Arquivados do cenário base com pagamento já confirmado — o caminho
      // que libera a exclusão. O default do schema fica em servico().
      { ...servico("svc-concluido", "CONCLUIDO"), paymentStatus: "PAYMENT_CONFIRMED" },
      { ...servico("svc-confirmado", "CONFIRMADO", "montador"), paymentStatus: "PAYMENT_CONFIRMED" },
      { ...servico("svc-finalizado", "FINALIZADO"), paymentStatus: "PAYMENT_CONFIRMED" },
      servico("svc-aceito", "ACEITO"),
      servico("svc-andamento", "EM_ANDAMENTO"),
      servico("svc-aguardando", "AGUARDANDO_FINALIZACAO", "montador"),
      { ...servico("svc-sem-sala", "CONCLUIDO"), paymentStatus: "PAYMENT_CONFIRMED" },
    ].map((s) => [s.id, s]),
  );
  salas = new Map();
  msgs = [];
  exclusoes = [];
  notifs = [];
  pushes = [];
  conversa("svc-concluido", 12, 3, DIA); // 3 não lidas pelo empregador
  conversa("svc-confirmado", 5, 2, EMP); // 2 não lidas pelo montador
  conversa("svc-finalizado", 4, 1, DIA);
  conversa("svc-aceito", 2, 0, DIA);
  conversa("svc-andamento", 6, 2, DIA);
  conversa("svc-aguardando", 3, 0, MONT);
  globalThis.fetch = (async (_url: string, init: any) => {
    pushes.push(JSON.parse(init.body));
    return { json: async () => ({ data: { status: "ok" } }) };
  }) as any;
  instalarBanco();
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// ── Chamadas às rotas reais ──────────────────────────────────────────────────

const ctx = (id: string) => ({ params: Promise.resolve({ roomId: id }) });
const auth = (quem: string) => makeAuthHeaders(quem, PAPEL[quem]);

async function excluir(quem: string | null, servicoId: string, body?: unknown) {
  const { DELETE } = await import("../../src/app/api/chat/[roomId]/route");
  const req = new Request(`http://test/api/chat/${servicoId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...(quem ? auth(quem) : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const res = await DELETE(req, ctx(servicoId));
  return { status: res.status, body: await res.json() };
}

async function lista(quem: string) {
  const { GET } = await import("../../src/app/api/chat/route");
  const res = await GET(jsonRequest("http://test/api/chat", null, auth(quem)));
  assert.equal(res.status, 200);
  return (await res.json()).rooms as any[];
}

async function abrir(quem: string, servicoId: string) {
  const { GET } = await import("../../src/app/api/chat/[roomId]/route");
  const res = await GET(jsonRequest(`http://test/api/chat/${servicoId}`, null, auth(quem)), ctx(servicoId));
  return { status: res.status, body: await res.json() };
}

async function pagina(quem: string, servicoId: string) {
  const { GET } = await import("../../src/app/api/chat/[roomId]/messages/route");
  const res = await GET(jsonRequest(`http://test/api/chat/${servicoId}/messages`, null, auth(quem)), ctx(servicoId));
  return { status: res.status, body: await res.json() };
}

async function enviar(quem: string, servicoId: string, content: string) {
  const { POST } = await import("../../src/app/api/chat/[roomId]/route");
  const res = await POST(jsonRequest(`http://test/api/chat/${servicoId}`, { content }, auth(quem)), ctx(servicoId));
  return { status: res.status, body: await res.json() };
}

async function enviarMidia(quem: string, servicoId: string) {
  const { POST } = await import("../../src/app/api/chat/[roomId]/messages/route");
  const res = await POST(
    jsonRequest(`http://test/api/chat/${servicoId}/messages`, { type: "LOCATION", content: '{"lat":1,"lng":2}' }, auth(quem)),
    ctx(servicoId),
  );
  return { status: res.status, body: await res.json() };
}

const ids = (rooms: any[]) => rooms.map((r) => r.servicoId).sort();
const fotografia = () => JSON.stringify({ servicos: [...servicos.values()], salas: [...salas.values()], msgs });

// ── Testes ───────────────────────────────────────────────────────────────────

describe("DELETE /api/chat/[roomId] — quem pode e quando", () => {
  it("401 sem token", async () => {
    const r = await excluir(null, "svc-concluido");
    assert.equal(r.status, 401);
    assert.equal(exclusoes.length, 0);
  });

  it("404 quando o serviço não existe", async () => {
    const r = await excluir(EMP, "svc-nao-existe");
    assert.equal(r.status, 404);
    assert.equal(exclusoes.length, 0);
  });

  it("403 para quem não participa do serviço (IDOR) — nada é gravado", async () => {
    const antes = fotografia();
    const r = await excluir(INTRUSO, "svc-concluido");
    assert.equal(r.status, 403);
    assert.equal(exclusoes.length, 0);
    assert.equal(fotografia(), antes);
  });

  for (const svc of ["svc-aceito", "svc-andamento", "svc-aguardando"]) {
    it(`409 para conversa ATIVA (${svc}) — nada é gravado`, async () => {
      const participante = servicos.get(svc)!.montadorId ?? DIA;
      for (const quem of [EMP, participante]) {
        const r = await excluir(quem, svc);
        assert.equal(r.status, 409);
        assert.equal(r.body.code, "CONVERSA_ATIVA");
      }
      assert.equal(exclusoes.length, 0);
      assert.ok(ids(await lista(EMP)).includes(svc));
    });
  }

  it("o status vem do banco: corpo da requisição não transforma conversa ativa em arquivada", async () => {
    const r = await excluir(EMP, "svc-andamento", { status: "CONCLUIDO", arquivada: true });
    assert.equal(r.status, 409);
    assert.equal(exclusoes.length, 0);
  });

  it("404 quando o serviço arquivado nunca teve sala — e não cria a sala", async () => {
    const r = await excluir(EMP, "svc-sem-sala");
    assert.equal(r.status, 404);
    assert.equal(salas.has("svc-sem-sala"), false);
    assert.equal(exclusoes.length, 0);
  });
});

// ── Regra de elegibilidade: uma só, no DELETE, na lista e na sala ───────────

const TODOS_STATUS = [
  "RASCUNHO",
  "SOLICITADO",
  "ACEITO",
  "RECUSADO",
  "CANCELADO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
];
const TODOS_PAGAMENTOS = ["WAITING_PAYMENT", "PAYMENT_REPORTED", "PAYMENT_CONFIRMED", "PAYMENT_DISPUTED"];
const COM_CHAT = new Set(["ACEITO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO", "CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);
const ENCERRADO = new Set(["CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);
// Regra provisória: só pagamento CONFIRMADO libera (lib/chatSala).
const PAGAMENTO_LIBERA = "PAYMENT_CONFIRMED";

describe("elegibilidade — todos os status × todos os estados de pagamento", () => {
  it("o schema não ganhou status novo sem passar por esta regra", async () => {
    const { readFileSync } = await import("node:fs");
    const schema = readFileSync(`${__dirname}/../../prisma/schema.prisma`, "utf8");
    const bloco = (nome: string) =>
      schema
        .slice(schema.indexOf(`enum ${nome} {`), schema.indexOf("}", schema.indexOf(`enum ${nome} {`)))
        .split("\n")
        .slice(1)
        .map((l) => l.trim())
        .filter(Boolean);
    assert.deepEqual(bloco("ServicoStatus"), TODOS_STATUS);
    assert.deepEqual(bloco("PaymentStatus"), TODOS_PAGAMENTOS);
  });

  for (const status of TODOS_STATUS) {
    for (const pagamento of TODOS_PAGAMENTOS) {
      const pode = ENCERRADO.has(status) && pagamento === PAGAMENTO_LIBERA;
      it(`${status} + ${pagamento}: ${pode ? "pode" : "não pode"} excluir — DELETE, lista e sala concordam`, async () => {
        servicos.set("svc-x", { ...servico("svc-x", status), paymentStatus: pagamento });
        conversa("svc-x", 3, 1, DIA);

        if (COM_CHAT.has(status)) {
          const naLista = (await lista(EMP)).find((r) => r.servicoId === "svc-x");
          assert.equal(naLista.arquivada, ENCERRADO.has(status));
          assert.equal(naLista.podeExcluir, pode);
          const sala = await abrir(EMP, "svc-x");
          assert.equal(sala.status, 200);
          assert.equal(sala.body.room.arquivada, ENCERRADO.has(status));
          assert.equal(sala.body.room.podeExcluir, pode);
        } else {
          assert.equal(ids(await lista(EMP)).includes("svc-x"), false);
        }

        for (const quem of [EMP, DIA]) {
          const r = await excluir(quem, "svc-x");
          if (pode) {
            assert.equal(r.status, 200, quem);
          } else {
            assert.equal(r.status, 409, quem);
            assert.equal(r.body.code, ENCERRADO.has(status) ? "PAGAMENTO_PENDENTE" : "CONVERSA_ATIVA");
          }
        }
        assert.equal(exclusoes.length, pode ? 2 : 0);
      });
    }
  }

  it("nada na requisição muda a decisão (corpo, query string, cabeçalhos)", async () => {
    const { DELETE } = await import("../../src/app/api/chat/[roomId]/route");
    for (const svc of ["svc-andamento", "svc-aguardando"]) {
      const quem = servicos.get(svc)!.montadorId ?? DIA;
      const req = new Request(`http://test/api/chat/${svc}?status=CONCLUIDO&arquivada=true&force=1`, {
        method: "DELETE",
        headers: { "content-type": "application/json", "x-servico-status": "FINALIZADO", ...auth(quem) },
        body: JSON.stringify({ status: "FINALIZADO", arquivada: true, podeExcluir: true, paymentStatus: "PAYMENT_CONFIRMED" }),
      });
      const res = await DELETE(req, ctx(svc));
      assert.equal(res.status, 409);
    }
    assert.equal(exclusoes.length, 0);
  });

  it("pagamento contestado bloqueia; confirmado depois, a exclusão passa", async () => {
    servicos.get("svc-concluido")!.paymentStatus = "PAYMENT_DISPUTED";
    const r1 = await excluir(EMP, "svc-concluido");
    assert.equal(r1.status, 409);
    assert.equal(r1.body.code, "PAGAMENTO_PENDENTE");
    servicos.get("svc-concluido")!.paymentStatus = "PAYMENT_CONFIRMED";
    assert.equal((await excluir(EMP, "svc-concluido")).status, 200);
  });

  it("aguardando pagamento (default) NÃO conta como pago: bloqueia os dois lados", async () => {
    servicos.get("svc-concluido")!.paymentStatus = "WAITING_PAYMENT";
    for (const quem of [EMP, DIA]) {
      const r = await excluir(quem, "svc-concluido");
      assert.equal(r.status, 409, quem);
      assert.equal(r.body.code, "PAGAMENTO_PENDENTE");
    }
    assert.equal(exclusoes.length, 0);
  });
});

describe("exclusão de conversa arquivada", () => {
  const casos: Array<[string, string, string]> = [
    ["svc-concluido", EMP, DIA],
    ["svc-concluido", DIA, EMP],
    ["svc-confirmado", MONT, EMP],
    ["svc-confirmado", EMP, MONT],
    ["svc-finalizado", EMP, DIA],
  ];
  for (const [svc, quem, outro] of casos) {
    it(`${svc}: ${quem} exclui; ${outro} continua vendo igual`, async () => {
      const doOutroAntes = (await lista(outro)).find((r) => r.servicoId === svc);
      assert.ok(doOutroAntes, "o outro participante via a conversa antes");
      assert.ok(ids(await lista(quem)).includes(svc));

      const r = await excluir(quem, svc);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { ok: true, roomId: svc });

      assert.equal(ids(await lista(quem)).includes(svc), false, "saiu da lista de quem excluiu");
      const doOutroDepois = (await lista(outro)).find((x) => x.servicoId === svc);
      assert.deepEqual(doOutroDepois, doOutroAntes, "para o outro, nada mudou (prévia, não lidas, arquivada)");
      assert.deepEqual(exclusoes.map((e) => [e.roomId, e.userId]), [[sala(svc).id, quem]]);
    });
  }

  it("nada é apagado nem alterado: mensagens, sala, serviço e leituras continuam iguais", async () => {
    const antes = fotografia();
    // servico.update/updateMany não estão mockados: se a rota tocasse no
    // serviço (status, avaliação), explodiria em 500.
    const r = await excluir(EMP, "svc-concluido");
    assert.equal(r.status, 200);
    assert.equal(fotografia(), antes);
    // As 3 mensagens da diarista continuam NÃO lidas: excluir não é ler.
    assert.equal(msgs.filter((m) => m.roomId === sala("svc-concluido").id && m.readAt === null).length, 3);
  });

  it("idempotente: repetir devolve 200 e mantém uma única exclusão", async () => {
    assert.equal((await excluir(EMP, "svc-concluido")).status, 200);
    assert.equal((await excluir(EMP, "svc-concluido")).status, 200);
    assert.equal(exclusoes.length, 1);
  });

  it("idempotente com pedidos simultâneos (toque duplo)", async () => {
    const rs = await Promise.all([excluir(EMP, "svc-concluido"), excluir(EMP, "svc-concluido"), excluir(EMP, "svc-concluido")]);
    assert.deepEqual(rs.map((r) => r.status), [200, 200, 200]);
    assert.equal(exclusoes.length, 1);
  });

  it("isolamento entre serviços: excluir uma conversa não esconde as outras da mesma pessoa", async () => {
    await excluir(EMP, "svc-concluido");
    assert.deepEqual(ids(await lista(EMP)), [
      "svc-aceito",
      "svc-aguardando",
      "svc-andamento",
      "svc-confirmado",
      "svc-finalizado",
    ]);
    assert.equal((await abrir(EMP, "svc-finalizado")).status, 200);
  });

  it("isolamento entre contas: a exclusão de uma pessoa não vale para outra", async () => {
    await excluir(DIA, "svc-finalizado");
    assert.ok(ids(await lista(EMP)).includes("svc-finalizado"));
    assert.equal((await abrir(EMP, "svc-finalizado")).status, 200);
    assert.equal((await excluir(INTRUSO, "svc-finalizado")).status, 403);
    assert.deepEqual(exclusoes.map((e) => e.userId), [DIA]);
  });
});

describe("conversa excluída não volta", () => {
  beforeEach(async () => {
    assert.equal((await excluir(EMP, "svc-concluido")).status, 200);
  });

  it("abrir a sala (notificação antiga, link, cache) → 404 CONVERSA_EXCLUIDA, sem marcar nada como lido", async () => {
    const r = await abrir(EMP, "svc-concluido");
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "CONVERSA_EXCLUIDA");
    assert.equal(JSON.stringify(r.body).includes("msg "), false, "nenhuma mensagem devolvida");
    assert.equal(msgs.filter((m) => m.roomId === sala("svc-concluido").id && m.readAt === null).length, 3);
  });

  it("paginação e envio também respondem 404 para quem excluiu", async () => {
    const p = await pagina(EMP, "svc-concluido");
    assert.equal(p.status, 404);
    assert.equal(p.body.code, "CONVERSA_EXCLUIDA");
    const total = msgs.length;
    assert.equal((await enviar(EMP, "svc-concluido", "oi")).status, 404);
    assert.equal((await enviarMidia(EMP, "svc-concluido")).status, 404);
    assert.equal(msgs.length, total, "nada gravado");
  });

  it("o outro participante continua abrindo a conversa normalmente", async () => {
    const r = await abrir(DIA, "svc-concluido");
    assert.equal(r.status, 200);
    assert.equal(r.body.messages.length, 12);
  });

  it("persiste depois de sair e entrar de novo (novo token)", async () => {
    const novoLogin = makeAuthHeaders(EMP, "EMPREGADOR");
    const { GET } = await import("../../src/app/api/chat/route");
    const res = await GET(jsonRequest("http://test/api/chat", null, novoLogin));
    const rooms = (await res.json()).rooms as any[];
    assert.equal(ids(rooms).includes("svc-concluido"), false);
    assert.equal((await abrir(EMP, "svc-concluido")).status, 404);
  });

  it("mensagem tardia do outro participante não reabre nem notifica quem excluiu", async () => {
    const r = await enviar(DIA, "svc-concluido", "mensagem depois de arquivada");
    assert.equal(r.status, 201);
    const r2 = await enviarMidia(DIA, "svc-concluido");
    assert.equal(r2.status, 201);
    assert.equal(notifs.filter((n) => n.userId === EMP).length, 0, "sem notificação in-app");
    assert.equal(pushes.length, 0, "sem push");
    assert.equal(ids(await lista(EMP)).includes("svc-concluido"), false);
  });

  it("badge do push ignora não lidas da conversa excluída", async () => {
    // Não lidas do empregador: 3 em svc-concluido (excluída), 1 em
    // svc-finalizado e 2 em svc-andamento — a nova mensagem vira a 3ª ali.
    // Badge = 1 + 3 = 4 (seriam 7 contando a excluída).
    const r = await enviar(DIA, "svc-andamento", "oi");
    assert.equal(r.status, 201);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].badge, 4);
  });

  it("canais de tempo real do token não incluem a conversa excluída", async () => {
    const vistas: string[] = [];
    const findMany = (mockPrisma.chatRoom as any).findMany;
    (mockPrisma.chatRoom as any).findMany = async (a: any) => {
      const r = await findMany(a);
      vistas.push(...r.map((s: any) => s.servicoId));
      return r;
    };
    const { GET } = await import("../../src/app/api/realtime/token/route");
    await GET(jsonRequest("http://test/api/realtime/token", null, auth(EMP)));
    assert.ok(vistas.length > 0);
    assert.equal(vistas.includes("svc-concluido"), false);
  });
});

describe("notificações de quem excluiu", () => {
  it("só os avisos de mensagem DESTA conversa, e só de quem excluiu, passam a lidos", async () => {
    notif(EMP, "CHAT_NOVA_MENSAGEM", "svc-concluido");
    notif(EMP, "CHAT_NOVA_MENSAGEM", "svc-concluido");
    notif(EMP, "SERVICO_CONCLUIDO", "svc-concluido");
    notif(EMP, "CHAT_NOVA_MENSAGEM", "svc-andamento");
    notif(DIA, "CHAT_NOVA_MENSAGEM", "svc-concluido");

    assert.equal((await excluir(EMP, "svc-concluido")).status, 200);

    const lida = (n: Notif) => n.readAt !== null;
    assert.deepEqual(
      notifs.map((n) => [n.userId, n.type, n.servicoId, lida(n)]),
      [
        [EMP, "CHAT_NOVA_MENSAGEM", "svc-concluido", true],
        [EMP, "CHAT_NOVA_MENSAGEM", "svc-concluido", true],
        [EMP, "SERVICO_CONCLUIDO", "svc-concluido", false],
        [EMP, "CHAT_NOVA_MENSAGEM", "svc-andamento", false],
        [DIA, "CHAT_NOVA_MENSAGEM", "svc-concluido", false],
      ],
    );
    assert.equal(notifs.length, 5, "nenhuma notificação apagada");
  });
});
