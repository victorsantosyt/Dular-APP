import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * Logs do fluxo de notificação não podem repetir dados do aviso. O
 * `PrismaClientValidationError` traz na mensagem os argumentos da chamada —
 * em `notification.create`, título e corpo (nome, texto da mensagem, bairro).
 * Demonstrado localmente com o client real antes desta correção. Aqui os
 * erros são simulados; nenhum banco nem push real.
 */

const NOME = "Victor santos lima";
const TEXTO = "Meu portão é o azul, código 4521";
const ENDERECO = "Rua 4, 70, Setor Rodoviário";
const TOKEN = "ExponentPushToken[aparelhoSecreto123]";
const PRIVADOS = [NOME, TEXTO, ENDERECO, "Setor Rodoviário", TOKEN, "aparelhoSecreto123"];

/** Mensagem no formato que o Prisma gera: repete o `data` da chamada. */
const MENSAGEM_PRISMA = `Invalid \`prisma.notification.create()\` invocation:\n{\n  data: {\n    userId: "u1",\n    title: "${NOME}",\n    body: "${TEXTO} — ${ENDERECO}",\n    remetente: "Josafa"\n  }\n}\nUnknown argument \`remetente\`.`;

let chamadas: unknown[][];
let envios: number;
const errorOriginal = console.error;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  resetMockPrisma();
  chamadas = [];
  envios = 0;
  console.error = (...args: unknown[]) => void chamadas.push(args);
  globalThis.fetch = (async () => {
    envios++;
    return { json: async () => ({ data: { status: "ok" } }) };
  }) as any;
  mockPrisma.user.findUnique = async () => ({ pushToken: TOKEN });
  mockPrisma.notification.count = async () => 0;
  (mockPrisma as any).chatMessage.count = async () => 0;
});

afterEach(() => {
  console.error = errorOriginal;
  globalThis.fetch = fetchOriginal;
});

function nadaSensivel() {
  const texto = JSON.stringify(chamadas, (_k, v) => (v instanceof Error ? `${v.name}: ${v.message} ${v.stack}` : v));
  for (const p of PRIVADOS) assert.ok(!texto.includes(p), `log expõe "${p}": ${texto.slice(0, 300)}`);
}

async function criarComFalha(erro: unknown) {
  (mockPrisma as any).notification.create = async () => {
    throw erro;
  };
  const { criarNotificacao } = await import("../../src/lib/notifications");
  return criarNotificacao({
    userId: "u1",
    type: "CHAT_NOVA_MENSAGEM",
    title: NOME,
    body: `${TEXTO} — ${ENDERECO}`,
    servicoId: "svc1",
    chatRoomId: "room1",
  });
}

const doCreate = () => chamadas.filter((c) => String(c[0]).includes("erro criando notification in-app"));

describe("log de falha ao gravar a notificação", () => {
  it("erro de validação do Prisma com nome e texto: só 'validacao'", async () => {
    await criarComFalha(new Prisma.PrismaClientValidationError(MENSAGEM_PRISMA, { clientVersion: "7" }));
    assert.deepEqual(doCreate(), [["[notifications] erro criando notification in-app:", "validacao"]]);
    nadaSensivel();
  });

  it("erro com endereço e outros dados na mensagem, código reconhecido: só o código", async () => {
    await criarComFalha(
      new Prisma.PrismaClientKnownRequestError(`FK falhou para ${ENDERECO} / ${NOME}`, { code: "P2003", clientVersion: "7", meta: { valor: TEXTO } }),
    );
    assert.deepEqual(doCreate(), [["[notifications] erro criando notification in-app:", "P2003"]]);
    nadaSensivel();
  });

  for (const codigo of ["P1001", "P1002", "P1008", "P1017", "P2002", "P2024", "P2025", "P2034"]) {
    it(`código reconhecido ${codigo}`, async () => {
      await criarComFalha(new Prisma.PrismaClientKnownRequestError(`falha com ${TEXTO}`, { code: codigo, clientVersion: "7" }));
      assert.deepEqual(doCreate(), [["[notifications] erro criando notification in-app:", codigo]]);
      nadaSensivel();
    });
  }

  for (const [nome, erro] of [
    ["código desconhecido", new Prisma.PrismaClientKnownRequestError(`x ${NOME}`, { code: "P9999", clientVersion: "7" })],
    ["código malicioso com dado privado", Object.assign(new Error(TEXTO), { code: NOME })],
    ["classe forjada com dado privado", Object.assign(new Error("x"), { name: ENDERECO })],
    ["erro comum com o texto", new Error(`${NOME}: ${TEXTO}`)],
    ["valor não-erro", `${TOKEN} ${TEXTO}`],
  ] as const) {
    it(`${nome} → "erro_desconhecido"`, async () => {
      await criarComFalha(erro);
      assert.deepEqual(doCreate(), [["[notifications] erro criando notification in-app:", "erro_desconhecido"]]);
      nadaSensivel();
    });
  }

  it("comportamento preservado: falha ao gravar não impede o push e devolve null", async () => {
    const r = await criarComFalha(new Prisma.PrismaClientValidationError(MENSAGEM_PRISMA, { clientVersion: "7" }));
    assert.equal(r, null);
    assert.equal(envios, 1);
  });
});

describe("log de falha ao contar o badge", () => {
  it("erro com dados privados na contagem: só o identificador", async () => {
    mockPrisma.notification.count = async () => {
      throw new Prisma.PrismaClientValidationError(`Invalid count: { where: { userId: "${NOME}", body: "${TEXTO}" } }`, { clientVersion: "7" });
    };
    const { sendPushNotification } = await import("../../src/lib/notifications");
    await sendPushNotification("u1", NOME, TEXTO, { type: "CHAT_NOVA_MENSAGEM" });
    const badge = chamadas.filter((c) => String(c[0]).includes("badge"));
    assert.deepEqual(badge, [["[push] falha ao contar o badge:", "validacao"]]);
    nadaSensivel();
    assert.equal(envios, 1, "o push segue sem o badge, como antes");
  });
});
