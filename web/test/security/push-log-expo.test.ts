import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * O log de envio à Expo não pode carregar o token do aparelho nem dados do
 * aviso. A resposta da Expo (`message`, `details`) é texto livre e pode trazer
 * o token (ex.: DeviceNotRegistered); exceções também. Só códigos de erro
 * conhecidos ou mensagens fixas vão para o console. Nenhum push real: o fetch
 * é falso e o console.error é capturado.
 */

const TOKEN = "ExponentPushToken[aparelhoSecreto123]";
const PRIVADOS = [TOKEN, "aparelhoSecreto123", "Victor santos lima", "Meu portão é o azul, código 4521"];

let chamadas: unknown[][];
const errorOriginal = console.error;
const fetchOriginal = globalThis.fetch;

function respostaExpo(ticket: unknown) {
  globalThis.fetch = (async () => ({ json: async () => ({ data: ticket }) })) as any;
}

function nadaSensivel() {
  const texto = JSON.stringify(chamadas, (_k, v) => (v instanceof Error ? `${v.name}: ${v.message} ${v.stack}` : v));
  for (const p of PRIVADOS) assert.ok(!texto.includes(p), `log expõe "${p}": ${texto}`);
}

beforeEach(() => {
  resetMockPrisma();
  chamadas = [];
  console.error = (...args: unknown[]) => void chamadas.push(args);
  mockPrisma.user.findUnique = async () => ({ pushToken: TOKEN });
  mockPrisma.notification.count = async () => 0;
  (mockPrisma as any).chatMessage.count = async () => 0;
});

afterEach(() => {
  console.error = errorOriginal;
  globalThis.fetch = fetchOriginal;
});

async function enviar() {
  const { sendPushNotification } = await import("../../src/lib/notifications");
  await sendPushNotification("u1", "Victor santos lima", "Meu portão é o azul, código 4521", { type: "CHAT_NOVA_MENSAGEM" });
}

describe("log do envio à Expo", () => {
  it("ticket.message com o token do aparelho: não vai para o log", async () => {
    respostaExpo({
      status: "error",
      message: `"${TOKEN}" is not a registered push notification recipient`,
      details: { error: "DeviceNotRegistered" },
    });
    await enviar();
    assert.equal(chamadas.length, 1);
    assert.deepEqual(chamadas[0], ["[push] erro ao enviar notificação:", "DeviceNotRegistered"]);
    nadaSensivel();
  });

  it("ticket.details com token e dados privados: só o código reconhecido", async () => {
    respostaExpo({
      status: "error",
      message: "falhou",
      details: { error: "MessageTooBig", expoPushToken: TOKEN, payload: { title: "Victor santos lima", body: "Meu portão é o azul, código 4521" } },
    });
    await enviar();
    assert.deepEqual(chamadas[0], ["[push] erro ao enviar notificação:", "MessageTooBig"]);
    nadaSensivel();
  });

  for (const codigo of ["DeviceNotRegistered", "MessageTooBig", "MessageRateExceeded", "MismatchSenderId", "InvalidCredentials"]) {
    it(`código reconhecido ${codigo} é registrado`, async () => {
      respostaExpo({ status: "error", details: { error: codigo } });
      await enviar();
      assert.deepEqual(chamadas[0], ["[push] erro ao enviar notificação:", codigo]);
    });
  }

  for (const [nome, details] of [
    ["código desconhecido", { error: "AlgoNovoDaExpo" }],
    ["código malicioso com o token", { error: TOKEN }],
    ["código com dado privado", { error: "Meu portão é o azul, código 4521" }],
    ["código não-texto", { error: { token: TOKEN } }],
    ["details ausente", undefined],
    ["details texto", `falha para ${TOKEN}`],
  ] as const) {
    it(`${nome} → "erro_desconhecido"`, async () => {
      respostaExpo({ status: "error", message: `erro com ${TOKEN}`, details });
      await enviar();
      assert.deepEqual(chamadas[0], ["[push] erro ao enviar notificação:", "erro_desconhecido"]);
      nadaSensivel();
    });
  }

  it("exceção com o token na mensagem: log com texto fixo", async () => {
    globalThis.fetch = (async () => {
      throw new Error(`fetch failed for ${TOKEN}: body={"title":"Victor santos lima"}`);
    }) as any;
    await enviar();
    assert.deepEqual(chamadas, [["[push] falha na chamada à Expo Push API."]]);
    nadaSensivel();
  });

  it("resposta HTTP que não é JSON (texto com o token): log com texto fixo", async () => {
    globalThis.fetch = (async () => ({
      json: async () => {
        throw new SyntaxError(`Unexpected token in "${TOKEN}"`);
      },
    })) as any;
    await enviar();
    assert.deepEqual(chamadas, [["[push] falha na chamada à Expo Push API."]]);
    nadaSensivel();
  });

  it("envio ok: nada no log", async () => {
    respostaExpo({ status: "ok", id: "ticket-1" });
    await enviar();
    assert.equal(chamadas.length, 0);
  });
});
