import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { makeAuthHeaders, jsonRequest } from "./_helpers";
import { CONTEUDO_GENERICO, CONTEUDO_PUBLICO } from "../../src/lib/pushPublico";

/**
 * Com o app em segundo plano ou fechado, o SISTEMA exibe o push sem rodar o
 * app, e o token pode estar associado a uma conta que já saiu do aparelho.
 * Então nada do evento pode ir nos campos exibidos: só textos fixos por tipo.
 *
 * Os testes interceptam o corpo EFETIVO enviado à Expo (fetch falso — nenhum
 * push real) e procuram os dados privados em TODO o payload, não só no título.
 */

const PRIVADOS = ["Victor santos lima", "Meu portão é o azul, código 4521", "Setor Rodoviário", "Rua 4, 70", "Josafa"];
const RAIZ = path.join(__dirname, "..", "..", "src");

let enviados: any[];
let gravadas: any[];
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  resetMockPrisma();
  enviados = [];
  gravadas = [];
  globalThis.fetch = (async (_url: string, init: any) => {
    enviados.push(JSON.parse(init.body));
    return { json: async () => ({ data: { status: "ok" } }) };
  }) as any;
  mockPrisma.user.findUnique = async (a: any) =>
    a?.select?.pushToken ? { pushToken: "ExponentPushToken[aparelho]" } : { status: "ATIVO" };
  (mockPrisma as any).notification.create = async (a: any) => {
    gravadas.push(a.data);
    return { id: "notif1" };
  };
  mockPrisma.notification.count = async () => 1;
  (mockPrisma as any).chatMessage.count = async () => 2;
  // Se alguém voltar a consultar o serviço para montar texto do push, aparece aqui.
  mockPrisma.servico.findUnique = async () => ({ tipo: "FAXINA", data: new Date(), bairro: "Setor Rodoviário" });
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function semDadoPrivado(payload: unknown) {
  const texto = JSON.stringify(payload);
  for (const p of PRIVADOS) assert.ok(!texto.includes(p), `payload expõe "${p}": ${texto}`);
}

async function notificacoes() {
  return import("../../src/lib/notifications");
}

describe("push: conteúdo exibido pelo sistema", () => {
  for (const tipo of Object.keys(CONTEUDO_PUBLICO)) {
    it(`${tipo}: texto fixo, sem dado do evento, sem subtitle`, async () => {
      const { criarNotificacao } = await notificacoes();
      await criarNotificacao({
        userId: "u-destino",
        type: tipo as any,
        title: "Victor santos lima",
        body: "Meu portão é o azul, código 4521 — Setor Rodoviário, Rua 4, 70",
        servicoId: "svc1",
        chatRoomId: tipo === "CHAT_NOVA_MENSAGEM" ? "room1" : null,
      });
      assert.equal(enviados.length, 1);
      const p = enviados[0];
      assert.deepEqual({ title: p.title, body: p.body }, (CONTEUDO_PUBLICO as any)[tipo]);
      assert.equal("subtitle" in p, false);
      semDadoPrivado(p);
      assert.equal(p.data.type, tipo);
      assert.equal(p.data.servicoId, "svc1");
      assert.equal(p.data.notificationId, "notif1");
      assert.equal(typeof p.badge, "number");
    });
  }

  it("tipo desconhecido (chamada direta) cai no texto genérico", async () => {
    const { sendPushNotification } = await notificacoes();
    await sendPushNotification("u", "Victor santos lima", "Meu portão é o azul, código 4521", { type: "TIPO_NOVO" });
    assert.deepEqual({ title: enviados[0].title, body: enviados[0].body }, CONTEUDO_GENERICO);
    semDadoPrivado(enviados[0]);
  });

  it("sem type nenhum: genérico", async () => {
    const { sendPushNotification } = await notificacoes();
    await sendPushNotification("u", "Josafa", "Setor Rodoviário");
    assert.deepEqual({ title: enviados[0].title, body: enviados[0].body }, CONTEUDO_GENERICO);
    assert.deepEqual(enviados[0].data, { destinatarioId: "u" });
  });

  it("pushData não sobrescreve título, corpo nem tipo, e não carrega chave extra", async () => {
    const { criarNotificacao } = await notificacoes();
    await criarNotificacao({
      userId: "u",
      type: "SERVICO_CANCELADO",
      title: "Serviço cancelado",
      body: "A diarista Josafa cancelou.",
      servicoId: "svc1",
      pushData: {
        type: "CHAT_NOVA_MENSAGEM",
        title: "Victor santos lima",
        body: "Meu portão é o azul, código 4521",
        nome: "Josafa",
        endereco: "Rua 4, 70",
        servicoId: "svc1",
        tardio: true,
        motivo: "indisponibilidade",
      },
    });
    const p = enviados[0];
    assert.deepEqual({ title: p.title, body: p.body }, CONTEUDO_PUBLICO.SERVICO_CANCELADO);
    assert.deepEqual(p.data, { type: "SERVICO_CANCELADO", servicoId: "svc1", destinatarioId: "u" });
    semDadoPrivado(p);
  });

  it("valor que não é identificador é descartado de data (e do threadId)", async () => {
    const { sendPushNotification } = await notificacoes();
    await sendPushNotification("u", "t", "b", {
      type: "CHAT_NOVA_MENSAGEM",
      servicoId: "Victor santos lima",
      chatRoomId: "Setor Rodoviário",
    });
    const p = enviados[0];
    assert.deepEqual(p.data, { type: "CHAT_NOVA_MENSAGEM", destinatarioId: "u" });
    assert.equal(p.threadId, undefined);
    semDadoPrivado(p);
  });

  it("destinatarioId é do servidor: o chamador não forja nem sobrescreve", async () => {
    const { criarNotificacao, sendPushNotification } = await notificacoes();
    await criarNotificacao({
      userId: "u-real",
      type: "CHAT_NOVA_MENSAGEM",
      title: "t",
      body: "b",
      servicoId: "svc1",
      pushData: { servicoId: "svc1", destinatarioId: "u-forjado" },
    });
    await sendPushNotification("u-real", "t", "b", { type: "SERVICO_ACEITO", destinatarioId: "u-forjado" });
    for (const p of enviados) {
      assert.equal(p.data.destinatarioId, "u-real");
      // Payload final: só as chaves autorizadas.
      for (const chave of Object.keys(p.data)) {
        assert.ok(["type", "servicoId", "chatRoomId", "notificationId", "destinatarioId"].includes(chave), chave);
      }
    }
  });

  it("threadId só com identificador", async () => {
    const { criarNotificacao } = await notificacoes();
    await criarNotificacao({ userId: "u", type: "CHAT_NOVA_MENSAGEM", title: "Josafa", body: "oi", servicoId: "svc1", chatRoomId: "room1" });
    assert.equal(enviados[0].threadId, "chat:room1");
  });

  it("o banco guarda o conteúdo COMPLETO (o app autenticado mostra os detalhes)", async () => {
    const { criarNotificacao } = await notificacoes();
    await criarNotificacao({
      userId: "u",
      type: "SERVICO_SOLICITADO",
      title: "Nova solicitação de serviço",
      body: "Você recebeu um pedido de faxina em Setor Rodoviário.",
      servicoId: "svc1",
    });
    assert.deepEqual(gravadas[0], {
      userId: "u",
      type: "SERVICO_SOLICITADO",
      title: "Nova solicitação de serviço",
      body: "Você recebeu um pedido de faxina em Setor Rodoviário.",
      servicoId: "svc1",
      chatRoomId: null,
    });
    assert.deepEqual({ title: enviados[0].title, body: enviados[0].body }, CONTEUDO_PUBLICO.SERVICO_SOLICITADO);
    semDadoPrivado(enviados[0]);
  });
});

describe("push: rota real de chat", () => {
  it("mensagem privada: push neutro, banco com remetente e prévia", async () => {
    mockPrisma.servico.findUnique = async (a: any) =>
      a?.select?.bairro
        ? { tipo: "FAXINA", data: new Date("2026-09-28T00:00:00Z"), bairro: "Setor Rodoviário" }
        : { status: "ACEITO", clientId: "u-emp", diaristaId: "u-dia", montadorId: null };
    mockPrisma.chatRoom.upsert = async () => ({ id: "room1" });
    mockPrisma.chatMessage.create = async () => ({
      id: "m1",
      roomId: "room1",
      type: "TEXT",
      content: "Meu portão é o azul, código 4521",
      senderId: "u-emp",
      deliveredAt: null,
      readAt: null,
      createdAt: new Date(),
      sender: { id: "u-emp", nome: "Victor santos lima", avatarUrl: null },
    });
    const { POST } = await import("../../src/app/api/chat/[roomId]/route");
    const res = await POST(
      jsonRequest("http://t/api/chat/svc1", { content: "Meu portão é o azul, código 4521" }, makeAuthHeaders("u-emp", "EMPREGADOR")),
      { params: Promise.resolve({ roomId: "svc1" }) },
    );
    assert.equal(res.status, 201);
    const p = enviados[0];
    assert.deepEqual({ title: p.title, body: p.body }, CONTEUDO_PUBLICO.CHAT_NOVA_MENSAGEM);
    assert.equal("subtitle" in p, false);
    semDadoPrivado(p);
    assert.deepEqual(p.data, {
      type: "CHAT_NOVA_MENSAGEM",
      servicoId: "svc1",
      chatRoomId: "room1",
      notificationId: "notif1",
      destinatarioId: "u-dia",
    });
    assert.equal(gravadas[0].title, "Victor santos lima");
    assert.equal(gravadas[0].body, "Meu portão é o azul, código 4521");
  });
});

describe("push: cobertura dos tipos", () => {
  it("todo tipo de NotificationType tem texto fixo (e vice-versa)", () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "lib", "notifications.ts"), "utf8");
    const uniao = fonte.slice(fonte.indexOf("export type NotificationType"), fonte.indexOf(";", fonte.indexOf("export type NotificationType")));
    const tipos = [...uniao.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(tipos, Object.keys(CONTEUDO_PUBLICO).sort());
  });

  it("o único envio à Expo é o de lib/notifications (nenhum caminho paralelo)", () => {
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) varrer(p);
        else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, "utf8").includes("exp.host")) achados.push(path.relative(RAIZ, p));
      }
    };
    varrer(RAIZ);
    assert.deepEqual(achados, [path.join("lib", "notifications.ts")]);
  });
});
