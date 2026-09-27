import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockPrisma, resetMockPrisma } from "./_mocks";
import { conferirBancoDoAmbiente, pushRemotoPermitido, tempoRealPermitido } from "../../src/lib/ambientePreview";

/**
 * Preview da Vercel usa o banco de STAGING; produção usa o real. As travas
 * fazem um erro de configuração falhar fechado e mantêm push e tempo real
 * desligados no preview (lib/ambientePreview).
 */

describe("banco por ambiente", () => {
  it("preview sem a marca de staging: recusa abrir conexão", () => {
    assert.throws(() => conferirBancoDoAmbiente({ VERCEL_ENV: "preview" }), /staging/);
    assert.throws(() => conferirBancoDoAmbiente({ VERCEL_ENV: "preview", DULAR_DB_AMBIENTE: "producao" }), /staging/);
  });

  it("preview com a marca de staging: segue", () => {
    assert.doesNotThrow(() => conferirBancoDoAmbiente({ VERCEL_ENV: "preview", DULAR_DB_AMBIENTE: "staging" }));
  });

  it("produção: segue sem marca; recusa se vier marcada como staging", () => {
    assert.doesNotThrow(() => conferirBancoDoAmbiente({ VERCEL_ENV: "production" }));
    assert.throws(() => conferirBancoDoAmbiente({ VERCEL_ENV: "production", DULAR_DB_AMBIENTE: "staging" }), /staging/);
  });

  it("fora da Vercel (testes, local): não interfere", () => {
    assert.doesNotThrow(() => conferirBancoDoAmbiente({}));
  });
});

describe("push remoto por ambiente", () => {
  it("preview: desligado, salvo liberação explícita", () => {
    assert.equal(pushRemotoPermitido({ VERCEL_ENV: "preview" }), false);
    assert.equal(pushRemotoPermitido({ VERCEL_ENV: "preview", DULAR_PUSH_PREVIEW: "sim" }), false);
    assert.equal(pushRemotoPermitido({ VERCEL_ENV: "preview", DULAR_PUSH_PREVIEW: "ligado" }), true);
  });

  it("produção e local: ligado", () => {
    assert.equal(pushRemotoPermitido({ VERCEL_ENV: "production" }), true);
    assert.equal(pushRemotoPermitido({}), true);
  });

  describe("sendPushNotification no preview", () => {
    let enviados: number;
    let consultou: boolean;
    const fetchOriginal = globalThis.fetch;
    const envOriginal = process.env.VERCEL_ENV;
    beforeEach(() => {
      resetMockPrisma();
      enviados = 0;
      consultou = false;
      globalThis.fetch = (async () => {
        enviados++;
        return { json: async () => ({ data: { status: "ok" } }) };
      }) as any;
      mockPrisma.user.findUnique = async (a: any) => {
        if (a?.select?.pushToken) consultou = true;
        return a?.select?.pushToken ? { pushToken: "ExponentPushToken[aparelho]" } : { status: "ATIVO" };
      };
      mockPrisma.notification.count = async () => 0;
      (mockPrisma as any).chatMessage.count = async () => 0;
    });
    afterEach(() => {
      globalThis.fetch = fetchOriginal;
      if (envOriginal === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = envOriginal;
    });

    it("não consulta token nem chama a Expo", async () => {
      process.env.VERCEL_ENV = "preview";
      const { sendPushNotification } = await import("../../src/lib/notifications");
      await sendPushNotification("u1", "t", "c", { type: "CHAT_NOVA_MENSAGEM", servicoId: "s1" });
      assert.equal(enviados, 0);
      assert.equal(consultou, false);
    });

    it("controle positivo: fora do preview o mesmo envio chega à Expo", async () => {
      delete process.env.VERCEL_ENV;
      const { sendPushNotification } = await import("../../src/lib/notifications");
      await sendPushNotification("u1", "t", "c", { type: "CHAT_NOVA_MENSAGEM", servicoId: "s1" });
      assert.equal(enviados, 1);
    });
  });
});

describe("tempo real (Ably) por ambiente", () => {
  const envOriginal = { VERCEL_ENV: process.env.VERCEL_ENV, ABLY_API_KEY: process.env.ABLY_API_KEY };
  afterEach(() => {
    for (const [k, v] of Object.entries(envOriginal)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("preview: desligado, salvo liberação explícita", () => {
    assert.equal(tempoRealPermitido({ VERCEL_ENV: "preview" }), false);
    assert.equal(tempoRealPermitido({ VERCEL_ENV: "preview", DULAR_ABLY_PREVIEW: "ligado" }), true);
    assert.equal(tempoRealPermitido({ VERCEL_ENV: "production" }), true);
    assert.equal(tempoRealPermitido({}), true);
  });

  it("controle positivo: fora do preview o cliente Ably é criado", async () => {
    delete process.env.VERCEL_ENV;
    process.env.ABLY_API_KEY = "appTeste.chaveTeste:segredo-falso";
    const { getAblyRest } = await import("../../src/lib/ably");
    assert.ok(getAblyRest());
  });

  it("preview: recusa mesmo com o cliente já criado; publicar e presença não quebram", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.ABLY_API_KEY = "appTeste.chaveTeste:segredo-falso";
    const { getAblyRest, publishChatEvent, isUserPresentInRoom, createChatTokenRequest } = await import("../../src/lib/ably");
    assert.throws(() => getAblyRest(), /desligado neste preview/);
    await assert.doesNotReject(publishChatEvent("svc-1", { id: "m1", roomId: "r1", type: "TEXT" }));
    assert.equal(await isUserPresentInRoom("svc-1", "u1"), false);
    await assert.rejects(createChatTokenRequest("u1", ["svc-1"]), /desligado neste preview/);
  });
});
