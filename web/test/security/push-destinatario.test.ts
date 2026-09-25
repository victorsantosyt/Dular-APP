import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * Todo push leva `destinatarioId`: com o app aberto, o aparelho descarta
 * aviso que não é da conta autenticada. Nenhum push real: fetch é falso.
 */
describe("sendPushNotification — destinatarioId no data", () => {
  const fetchOriginal = globalThis.fetch;
  let enviado: any = null;

  beforeEach(() => {
    resetMockPrisma();
    enviado = null;
    mockPrisma.user.findUnique = async () => ({ pushToken: "ExponentPushToken[aparelho]" });
    mockPrisma.notification.count = async () => 0;
    (mockPrisma as any).chatMessage.count = async () => 0;
    globalThis.fetch = (async (_url: string, init: any) => {
      enviado = JSON.parse(init.body);
      return { json: async () => ({ data: { status: "ok" } }) };
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("inclui o destinatário junto dos dados do aviso", async () => {
    const { sendPushNotification } = await import("../../src/lib/notifications");
    await sendPushNotification("u-victor", "Nova mensagem", "oi", { type: "CHAT_NOVA_MENSAGEM", servicoId: undefined });
    assert.equal(enviado.data.destinatarioId, "u-victor");
    assert.equal(enviado.data.type, "CHAT_NOVA_MENSAGEM");
  });

  it("vale também sem data", async () => {
    const { sendPushNotification } = await import("../../src/lib/notifications");
    await sendPushNotification("u-josafa", "t", "b");
    assert.deepEqual(enviado.data, { destinatarioId: "u-josafa" });
  });

  it("dados do chamador não sobrescrevem o destinatário", async () => {
    const { sendPushNotification } = await import("../../src/lib/notifications");
    await sendPushNotification("u-victor", "t", "b", { destinatarioId: "u-outro" });
    assert.equal(enviado.data.destinatarioId, "u-victor");
  });
});
