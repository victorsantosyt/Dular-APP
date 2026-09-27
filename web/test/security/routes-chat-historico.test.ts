import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";

/**
 * Histórico e leitura da sala de chat com MAIS de 50 mensagens.
 *
 * Defeito corrigido: GET /api/chat/[roomId] buscava as 50 mais ANTIGAS
 * (createdAt asc, take 50) — as mensagens novas nunca chegavam ao app e
 * continuavam não lidas (badge "9+" preso). Aqui um banco em memória com a
 * semântica do Prisma que as rotas usam (where/orderBy[]/take/distinct/
 * groupBy/updateMany) para exercitar as rotas REAIS.
 */

const EMP = "u-empregador";
const MONT = "u-montador";
const OUTRO = "u-intruso";
const BASE = Date.UTC(2026, 8, 26, 15, 0);

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

let msgs: Msg[];
let servicos: Map<string, Servico>;
let salas: Map<string, { id: string; servicoId: string; createdAt: Date }>;
/** Gancho: roda antes de cada updateMany de leitura (simula corrida). */
let antesDeMarcarLida: (() => void) | null;

function servico(id: string, status = "EM_ANDAMENTO"): Servico {
  return {
    id,
    status,
    clientId: EMP,
    diaristaId: null,
    montadorId: MONT,
    tipo: "MONTADOR",
    data: new Date(BASE),
    turno: "TARDE",
    bairro: "Centro",
    cidade: "Água Boa",
    uf: "MT",
    precoFinal: 10000,
    paymentStatus: null,
  };
}

function sala(servicoId: string) {
  let s = salas.get(servicoId);
  if (!s) {
    s = { id: `room-${servicoId}`, servicoId, createdAt: new Date(BASE) };
    salas.set(servicoId, s);
  }
  return s;
}

/** n mensagens na sala; as `naoLidasDoMontador` mais novas são do montador e não lidas. */
function semear(servicoId: string, n: number, naoLidasDoMontador = 0, opts: { empates?: boolean } = {}) {
  const roomId = sala(servicoId).id;
  for (let i = 0; i < n; i++) {
    const nova = i >= n - naoLidasDoMontador;
    const autor = nova ? MONT : i % 2 ? EMP : MONT;
    // Com `empates`, grupos de 3 mensagens no MESMO milissegundo.
    const t = BASE + (opts.empates ? Math.floor(i / 3) : i) * 60_000;
    msgs.push({
      id: `${servicoId}-m${String(i).padStart(4, "0")}`,
      roomId,
      type: "TEXT",
      content: i === n - 1 ? `ULTIMA-${servicoId}` : `msg ${i}`,
      senderId: autor,
      deliveredAt: nova ? null : new Date(t),
      readAt: nova ? null : new Date(t),
      createdAt: new Date(t),
    });
  }
}

// ── Prisma em memória (só o que as rotas usam) ───────────────────────────────

function casa(m: Record<string, any>, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as any[]).some((c) => casa(m, c));
    const v = m[k];
    if (cond === null) return v === null;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond !== "object") return v === cond;
    if ("in" in cond) return cond.in.includes(v);
    if ("not" in cond) return v !== cond.not;
    if ("lt" in cond) return cond.lt instanceof Date ? v.getTime() < cond.lt.getTime() : v < cond.lt;
    throw new Error(`filtro não suportado no teste: ${k}`);
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

function instalarBanco() {
  mockPrisma.servico.findUnique = async (args: any) => servicos.get(args.where.id) ?? null;
  mockPrisma.user.findUnique = async (args: any) => ({
    id: args.where.id,
    nome: args.where.id,
    avatarUrl: null,
    role: args.where.id === MONT ? "MONTADOR" : "EMPREGADOR",
    lastSeenAt: null,
    status: "ATIVO",
  });
  mockPrisma.pixSnapshot.findUnique = async () => null;
  mockPrisma.paymentInfo.findUnique = async () => null;
  mockPrisma.chatRoom.upsert = async (args: any) => {
    const s = sala(args.where.servicoId);
    return { ...s, _count: { messages: msgs.filter((m) => m.roomId === s.id).length } };
  };
  (mockPrisma.chatRoom as any).findMany = async () =>
    [...salas.values()].map((s) => {
      const sv = servicos.get(s.servicoId)!;
      return {
        ...s,
        servico: {
          ...sv,
          cliente: { id: EMP, nome: "Empregador", avatarUrl: null },
          diarista: null,
          montador: { id: MONT, nome: "Montador", avatarUrl: null },
        },
      };
    });
  mockPrisma.chatMessage.findMany = async (args: any) => {
    let lista = ordenar(
      msgs.filter((m) => casa(m, args.where)),
      args.orderBy,
    );
    if (args.distinct) {
      const vistos = new Set<string>();
      lista = lista.filter((m) => (vistos.has(m.roomId) ? false : (vistos.add(m.roomId), true)));
    }
    if (args.take) lista = lista.slice(0, args.take);
    return lista.map(comRemetente);
  };
  (mockPrisma.chatMessage as any).findFirst = async (args: any) => {
    const m = msgs.find((x) => casa(x, args.where));
    return m ? { id: m.id, createdAt: m.createdAt } : null;
  };
  mockPrisma.chatMessage.updateMany = async (args: any) => {
    if ("readAt" in (args.data ?? {}) && antesDeMarcarLida) antesDeMarcarLida();
    let count = 0;
    for (const m of msgs) {
      if (casa(m, args.where)) {
        Object.assign(m, args.data);
        count++;
      }
    }
    return { count };
  };
  (mockPrisma.chatMessage as any).groupBy = async (args: any) => {
    const contagem = new Map<string, number>();
    for (const m of msgs) if (casa(m, args.where)) contagem.set(m.roomId, (contagem.get(m.roomId) ?? 0) + 1);
    return [...contagem].map(([roomId, n]) => ({ roomId, _count: { _all: n } }));
  };
}

beforeEach(() => {
  resetMockPrisma();
  msgs = [];
  servicos = new Map([["svc-1", servico("svc-1")]]);
  salas = new Map();
  antesDeMarcarLida = null;
  instalarBanco();
});

// ── Utilitários de chamada ───────────────────────────────────────────────────

const ctx = (id: string) => ({ params: Promise.resolve({ roomId: id }) });
const naoLidas = (quem: string, servicoId = "svc-1") =>
  msgs.filter((m) => m.roomId === sala(servicoId).id && m.senderId !== quem && m.readAt === null).length;

async function abrirSala(quem: string, servicoId = "svc-1") {
  const { GET } = await import("../../src/app/api/chat/[roomId]/route");
  const res = await GET(
    jsonRequest(`http://test/api/chat/${servicoId}`, null, makeAuthHeaders(quem, quem === MONT ? "MONTADOR" : "EMPREGADOR")),
    ctx(servicoId),
  );
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
}

async function pagina(quem: string, servicoId = "svc-1", before?: string) {
  const { GET } = await import("../../src/app/api/chat/[roomId]/messages/route");
  const url = `http://test/api/chat/${servicoId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`;
  const res = await GET(jsonRequest(url, null, makeAuthHeaders(quem, quem === MONT ? "MONTADOR" : "EMPREGADOR")), ctx(servicoId));
  return { status: res.status, body: await res.json() };
}

async function lista(quem: string) {
  const { GET } = await import("../../src/app/api/chat/route");
  const res = await GET(jsonRequest("http://test/api/chat", null, makeAuthHeaders(quem, "EMPREGADOR")));
  return (await res.json()).rooms as any[];
}

const cronologica = (ms: any[]) =>
  ms.every((m, i) => i === 0 || new Date(ms[i - 1].createdAt) <= new Date(m.createdAt));

// ── Testes ───────────────────────────────────────────────────────────────────

describe("GET /api/chat/[roomId] — histórico com mais de 50 mensagens", () => {
  it("60 mensagens: devolve as 50 MAIS RECENTES, em ordem cronológica, incluindo a última", async () => {
    semear("svc-1", 60);
    const { status, body } = await abrirSala(EMP);
    assert.equal(status, 200);
    assert.equal(body.messages.length, 50);
    assert.equal(body.room.totalMessages, 60);
    assert.equal(body.messages.at(-1).content, "ULTIMA-svc-1");
    assert.equal(body.messages[0].id, "svc-1-m0010", "a primeira devolvida é a 11ª (descarta as 10 mais antigas)");
    assert.ok(cronologica(body.messages));
  });

  it("120 mensagens: as 50 mais recentes (71ª a 120ª)", async () => {
    semear("svc-1", 120);
    const { body } = await abrirSala(EMP);
    assert.equal(body.messages.length, 50);
    assert.equal(body.messages[0].id, "svc-1-m0070");
    assert.equal(body.messages.at(-1).id, "svc-1-m0119");
    assert.equal(body.room.totalMessages, 120);
  });

  it("até 50 mensagens: devolve todas, como antes", async () => {
    semear("svc-1", 30);
    const { body } = await abrirSala(EMP);
    assert.equal(body.messages.length, 30);
    assert.equal(body.messages[0].id, "svc-1-m0000");
  });

  it("ordem determinística com empates de horário (desempate pelo id), igual em consultas repetidas", async () => {
    semear("svc-1", 60, 0, { empates: true });
    const a = (await abrirSala(EMP)).body.messages.map((m: any) => m.id);
    const b = (await abrirSala(EMP)).body.messages.map((m: any) => m.id);
    assert.deepEqual(a, b);
    const esperado = ordenar(msgs, [{ createdAt: "asc" }, { id: "asc" }]).slice(-50).map((m) => m.id);
    assert.deepEqual(a, esperado);
  });
});

describe("prévia da lista × histórico da conversa", () => {
  it("a última mensagem da lista é a última do histórico da MESMA conversa (também com empates)", async () => {
    semear("svc-1", 75, 12, { empates: true });
    const [card] = await lista(EMP);
    const { body } = await abrirSala(EMP);
    assert.equal(card.servicoId, "svc-1");
    const ultima = body.messages.at(-1);
    assert.equal(card.ultimaMensagem.content, ultima.content);
    assert.equal(new Date(card.ultimaMensagem.createdAt).getTime(), new Date(ultima.createdAt).getTime());
  });

  it("contador da lista reflete a leitura: 12 não lidas → 0 depois de abrir a conversa", async () => {
    semear("svc-1", 75, 12);
    assert.equal((await lista(EMP))[0].naoLidas, 12, "mais de 9: badge '9+' com valor real 12");
    await abrirSala(EMP);
    assert.equal((await lista(EMP))[0].naoLidas, 0);
  });
});

describe("confirmação de leitura", () => {
  it("não lidas recentes: marcadas ao abrir; as da própria pessoa nunca são tocadas", async () => {
    semear("svc-1", 60, 10);
    const minhasAntes = msgs.filter((m) => m.senderId === EMP).map((m) => m.readAt?.getTime() ?? null);
    assert.equal(naoLidas(EMP), 10);
    const { body } = await abrirSala(EMP);
    assert.equal(naoLidas(EMP), 0);
    assert.ok(body.messages.filter((m: any) => m.senderId === MONT).every((m: any) => m.readAt !== null));
    assert.deepEqual(msgs.filter((m) => m.senderId === EMP).map((m) => m.readAt?.getTime() ?? null), minhasAntes);
  });

  it("mais de 50 não lidas: marca as 50 devolvidas; as mais antigas ficam não lidas até serem carregadas (regra atual: só o que foi entregue ao usuário)", async () => {
    semear("svc-1", 90, 80); // 80 não lidas do montador
    await abrirSala(EMP);
    assert.equal(naoLidas(EMP), 30, "as 30 mais antigas não foram devolvidas → continuam não lidas");
    // Carregar a página anterior (rota paginada) marca a próxima página.
    const primeira = await pagina(EMP);
    const anterior = await pagina(EMP, "svc-1", primeira.body.pagination.nextCursor);
    assert.equal(anterior.status, 200);
    assert.equal(naoLidas(EMP), 0);
  });

  it("mensagem que chega DURANTE a leitura continua não lida", async () => {
    semear("svc-1", 60, 5);
    antesDeMarcarLida = () => {
      antesDeMarcarLida = null;
      msgs.push({
        id: "svc-1-z-chegou-agora",
        roomId: sala("svc-1").id,
        type: "TEXT",
        content: "chegou durante",
        senderId: MONT,
        deliveredAt: null,
        readAt: null,
        createdAt: new Date(BASE + 999 * 60_000),
      });
    };
    const { body } = await abrirSala(EMP);
    assert.ok(!body.messages.some((m: any) => m.id === "svc-1-z-chegou-agora"));
    assert.equal(msgs.find((m) => m.id === "svc-1-z-chegou-agora")!.readAt, null);
    assert.equal(naoLidas(EMP), 1);
  });

  it("idempotente: abrir de novo não reescreve o horário da primeira leitura", async () => {
    semear("svc-1", 60, 5);
    await abrirSala(EMP);
    const primeira = msgs.filter((m) => m.senderId === MONT && m.readAt).map((m) => m.readAt!.getTime());
    await new Promise((r) => setTimeout(r, 5));
    await abrirSala(EMP);
    assert.deepEqual(msgs.filter((m) => m.senderId === MONT && m.readAt).map((m) => m.readAt!.getTime()), primeira);
  });
});

describe("isolamento", () => {
  it("entre participantes: quem não participa recebe 403 nas duas rotas e nada é marcado", async () => {
    semear("svc-1", 60, 10);
    assert.equal((await abrirSala(OUTRO)).status, 403);
    assert.equal((await pagina(OUTRO)).status, 403);
    assert.equal(naoLidas(EMP), 10);
  });

  it("montador abrindo marca só as do empregador; as dele continuam como estavam", async () => {
    semear("svc-1", 60, 10); // as 10 novas são do montador
    await abrirSala(MONT);
    assert.equal(naoLidas(EMP), 10, "as não lidas do empregador (enviadas pelo montador) não mudam");
  });

  it("entre conversas: abrir uma sala não marca a outra (mesmo profissional, dois serviços)", async () => {
    servicos.set("svc-2", servico("svc-2"));
    semear("svc-1", 60, 10);
    semear("svc-2", 20, 7);
    await abrirSala(EMP, "svc-1");
    assert.equal(naoLidas(EMP, "svc-1"), 0);
    assert.equal(naoLidas(EMP, "svc-2"), 7);
    const cards = await lista(EMP);
    assert.deepEqual(
      cards.map((c) => [c.servicoId, c.naoLidas, c.ultimaMensagem.content]).sort(),
      [["svc-1", 0, "ULTIMA-svc-1"], ["svc-2", 7, "ULTIMA-svc-2"]],
    );
  });

  it("cursor de outra sala é recusado (400) e não vaza mensagens", async () => {
    servicos.set("svc-2", servico("svc-2"));
    semear("svc-1", 60);
    semear("svc-2", 20);
    const r = await pagina(EMP, "svc-1", "svc-2-m0010");
    assert.equal(r.status, 400);
  });
});

describe("GET /api/chat/[roomId]/messages — paginação", () => {
  it("120 mensagens com empates: percorre todas, sem lacuna e sem repetição", async () => {
    semear("svc-1", 120, 0, { empates: true });
    const vistos: string[] = [];
    let before: string | undefined;
    let paginas = 0;
    for (;;) {
      const r = await pagina(EMP, "svc-1", before);
      assert.equal(r.status, 200);
      assert.ok(cronologica(r.body.messages));
      vistos.unshift(...r.body.messages.map((m: any) => m.id));
      paginas++;
      if (!r.body.pagination.hasMore) {
        assert.equal(r.body.pagination.nextCursor, null);
        break;
      }
      before = r.body.pagination.nextCursor;
      assert.ok(paginas < 10, "sem laço");
    }
    assert.equal(paginas, 3);
    assert.equal(new Set(vistos).size, 120, "sem repetição");
    assert.deepEqual(vistos, ordenar(msgs, [{ createdAt: "asc" }, { id: "asc" }]).map((m) => m.id), "sem lacuna, em ordem");
  });

  it("primeira página = mesmas 50 da rota principal", async () => {
    semear("svc-1", 60);
    const principal = (await abrirSala(EMP)).body.messages.map((m: any) => m.id);
    const primeira = (await pagina(EMP)).body.messages.map((m: any) => m.id);
    assert.deepEqual(primeira, principal);
  });

  it("exatamente 50 mensagens: hasMore false (antes dizia true e pedia uma página vazia)", async () => {
    semear("svc-1", 50);
    const r = await pagina(EMP);
    assert.equal(r.body.messages.length, 50);
    assert.equal(r.body.pagination.hasMore, false);
  });
});

describe("status do serviço — as duas rotas com a mesma regra", () => {
  it("AGUARDANDO_FINALIZACAO: 200 na rota principal E na paginada (antes a paginada dava 403)", async () => {
    servicos.set("svc-1", servico("svc-1", "AGUARDANDO_FINALIZACAO"));
    semear("svc-1", 10);
    assert.equal((await abrirSala(EMP)).status, 200);
    assert.equal((await pagina(EMP)).status, 200);
  });

  it("SOLICITADO (antes do aceite): 403 nas duas", async () => {
    servicos.set("svc-1", servico("svc-1", "SOLICITADO"));
    assert.equal((await abrirSala(EMP)).status, 403);
    assert.equal((await pagina(EMP)).status, 403);
  });
});
