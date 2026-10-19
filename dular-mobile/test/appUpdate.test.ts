import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { URL as NodeURL } from "node:url";
import * as policy from "../src/lib/appUpdate";

const release: policy.AndroidRelease = { versionCode: 6, versionName: "1.0.0", notes: ["Ajustes na abertura."], packageName: policy.ANDROID_PACKAGE, storeUrl: policy.PLAY_STORE_URL };
const now = 1000000000;

test("compara o build instalado, incluindo o mesmo nome público", () => {
  assert.equal(policy.shouldOfferUpdate(release, 5, null, now), true);
  assert.equal(policy.shouldOfferUpdate(release, 6, null, now), false);
  assert.equal(policy.shouldOfferUpdate(release, 7, null, now), false);
  for (const value of [null, "", "1.0", "0", "-1", "2100000001", " 5", "5x"]) assert.equal(policy.parseInstalledBuild(value), null);
  assert.equal(policy.parseInstalledBuild("5"), 5);
});

test("recusa manifesto adulterado e aceita apenas Play do Dular", () => {
  assert.deepEqual(policy.parseAndroidRelease({ android: release }), release);
  for (const value of [null, [], {}, { android: null }]) assert.equal(policy.parseAndroidRelease(value), null);
  for (const override of [{ versionCode: "6" }, { versionCode: 1.5 }, { versionCode: 2100000001 }, { versionName: " " }, { versionName: " 1.0" }, { versionName: "x".repeat(31) }, { notes: [" "] }, { notes: ["x".repeat(181)] }, { notes: Array(6).fill("Teste") }, { packageName: "outro.app" }, { storeUrl: "https://evil.test" }]) {
    assert.equal(policy.parseAndroidRelease({ android: { ...release, ...override } }), null);
  }
});

test("adiamento vale 24h por build e origem; datas corrompidas não prendem aviso", () => {
  assert.equal(policy.shouldOfferUpdate(release, 5, String(now - 100), now), false);
  assert.equal(policy.shouldOfferUpdate(release, 5, String(now - policy.UPDATE_SNOOZE_MS), now), true);
  assert.equal(policy.shouldOfferUpdate(release, 5, String(now + 1), now), true);
  assert.equal(policy.shouldOfferUpdate(release, 5, "inválido", now), true);
  assert.notEqual(policy.updateStorageKey("https://prod.test", 6), policy.updateStorageKey("https://preview.test", 6));
  assert.notEqual(policy.updateStorageKey("https://prod.test", 6), policy.updateStorageKey("https://prod.test", 7));
});

test("rede sem credenciais; offline, 404 e payload inválido são silenciosos", async () => {
  const signal = new AbortController().signal;
  let options: RequestInit | undefined;
  assert.deepEqual(await policy.fetchAndroidRelease("https://api.test", signal, (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(url, "https://api.test/api/app/version"); options = init;
    return { ok: true, json: async () => ({ android: release }) } as Response;
  }) as unknown as typeof fetch), release);
  assert.equal(options?.credentials, "omit");
  assert.deepEqual(options?.headers, { Accept: "application/json" });
  assert.equal(await policy.fetchAndroidRelease("https://api.test", signal, (async () => { throw Error("offline"); }) as unknown as typeof fetch), null);
  assert.equal(await policy.fetchAndroidRelease("https://api.test", signal, (async () => ({ ok: false })) as unknown as typeof fetch), null);
  assert.equal(await policy.fetchAndroidRelease("https://api.test", signal, (async () => ({ ok: true, json: async () => ({ android: null }) })) as unknown as typeof fetch), null);
});

test("loja tenta aplicativo e HTTPS; falha dupla permite repetir", async () => {
  const calls: string[] = [];
  assert.equal(await policy.openPlayStore(async (url) => { calls.push(url); if (url.startsWith("market:")) throw Error(); }), true);
  assert.deepEqual(calls, ["market://details?id=br.com.dular.app", policy.PLAY_STORE_URL]);
  assert.equal(await policy.openPlayStore(async () => { throw Error(); }), false);
  assert.equal(await policy.openPlayStore(async () => {}), true);
});

/** Igual ao Linking do React Native: openURL é método e depende de `this`. */
class LinkingFalso {
  abertas: string[] = [];
  constructor(private abrir: (url: string) => Promise<void> = async () => {}) {}
  _validateURL(url: string) { if (typeof url !== "string" || !url) throw new Error("URL inválida"); }
  openURL(url: string) { this._validateURL(url); this.abertas.push(url); return this.abrir(url); }
}

const FALHA = Symbol("sem resposta");

function hookHarness(options: { build?: string; platform?: string; dev?: boolean; storageFails?: boolean; storage?: () => Promise<string | null>; response?: () => Promise<unknown>; linking?: LinkingFalso } = {}) {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const code = ts.transpileModule(readFileSync(new NodeURL("../src/hooks/useAppUpdate.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const slots: any[] = [];
  const cleanups: Array<undefined | (() => void)> = [];
  const queued: Array<() => void> = [];
  // Relógio e temporizadores falsos: `advance` dispara o que vencer.
  let seqTimer = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const fakeSetTimeout = (fn: () => void, ms: number) => { const id = ++seqTimer; timers.set(id, { at: clock + (ms || 0), fn }); return id; };
  const fakeClearTimeout = (id: number) => { timers.delete(id); };
  let cursor = 0;
  let calls = 0;
  let storageWrites = 0;
  let clock = 1000000000;
  let listener: ((state: string) => void) | undefined;
  const appState = { currentState: "active", addEventListener: (_: string, callback: typeof listener) => { listener = callback; return { remove: () => { listener = undefined; } }; } };
  const react = {
    useState: (initial: unknown) => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value: unknown) => { slots[index] = value; }]; },
    useRef: (initial: unknown) => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
      const index = cursor++; const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous[i])) { slots[index] = deps; queued.push(() => { cleanups[index]?.(); cleanups[index] = effect() || undefined; }); }
    },
  };
  const mocks: Record<string, unknown> = {
    react,
    "react-native": { AppState: appState, Platform: { OS: options.platform ?? "android" }, Linking: options.linking ?? new LinkingFalso() },
    "@react-native-async-storage/async-storage": { getItem: async () => { if (options.storageFails) throw Error(); return options.storage ? options.storage() : null; }, setItem: async () => { storageWrites++; if (options.storageFails) throw Error(); } },
    "expo-constants": { default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" }, __esModule: true },
    "expo-application": { nativeBuildVersion: options.build ?? "5", applicationId: policy.ANDROID_PACKAGE },
    "@/config/api": { default: "https://api.test", __esModule: true },
    "@/lib/appUpdate": {
      ...policy,
      // `FALHA` simula consulta sem resposta (rede, DNS, 5xx); null é "sem anúncio".
      fetchAndroidRelease: async () => { calls++; const v = options.response ? await options.response() : release; return v === FALHA ? null : v; },
      consultarVersaoAndroid: async () => { calls++; const v = options.response ? await options.response() : release; return v === FALHA ? { ok: false } : { ok: true, release: v }; },
    },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, __DEV__: options.dev ?? false, AbortController, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, Map, Date: { now: () => clock } });
  return {
    render(enabled = true) { cursor = 0; const value = module.exports.useAppUpdate(enabled); while (queued.length) queued.shift()!(); return value; },
    unmount() { for (const cleanup of cleanups) cleanup?.(); },
    foreground() { appState.currentState = "active"; listener?.("active"); },
    background() { appState.currentState = "background"; listener?.("background"); },
    advance(ms: number) {
      const alvo = clock + ms;
      for (;;) {
        const proximos = [...timers.entries()].filter(([, t]) => t.at <= alvo).sort((a, b) => a[1].at - b[1].at);
        if (!proximos.length) break;
        const [id, t] = proximos[0];
        timers.delete(id);
        clock = Math.max(clock, t.at);
        t.fn();
      }
      clock = alvo;
    },
    /** Como `advance`, mas deixa as promessas andarem entre um temporizador e outro (como no app real). */
    async avancar(ms: number) {
      const alvo = clock + ms;
      for (;;) {
        await new Promise((resolve) => setImmediate(resolve));
        const proximos = [...timers.entries()].filter(([, t]) => t.at <= alvo).sort((a, b) => a[1].at - b[1].at);
        if (!proximos.length) break;
        const [id, t] = proximos[0];
        timers.delete(id);
        clock = Math.max(clock, t.at);
        t.fn();
      }
      clock = alvo;
      await new Promise((resolve) => setImmediate(resolve));
    },
    get agendados() { return timers.size; },
    get calls() { return calls; }, get storageWrites() { return storageWrites; },
  };
}
const flush = async () => { await new Promise((resolve) => setImmediate(resolve)); };

test("hook só consulta após bootstrap e em Android release; refresh não dispara em sequência", async () => {
  const harness = hookHarness();
  harness.render(false); await flush(); assert.equal(harness.calls, 0);
  harness.render(true); await flush();
  assert.equal(harness.render().release.versionCode, 6);
  harness.background(); harness.foreground(); await flush(); assert.equal(harness.calls, 1);
  harness.unmount();
  for (const options of [{ platform: "ios" }, { dev: true }, { build: "inválido" }]) {
    const skipped = hookHarness(options); skipped.render(); await flush(); assert.equal(skipped.calls, 0); skipped.unmount();
  }
});

test("falha de storage não bloqueia aviso nem repete após dispensar na sessão", async () => {
  const harness = hookHarness({ storageFails: true }); harness.render(); await flush();
  const current = harness.render(); assert.equal(current.release.versionCode, 6); current.dismiss(); await flush();
  assert.equal(harness.render().release, null); assert.equal(harness.storageWrites, 1); harness.unmount();
});

test("resposta atrasada após desmontar ou sair do app não mostra modal", async () => {
  for (const unmount of [true, false]) {
    let resolve!: (value: unknown) => void;
    const harness = hookHarness({ response: () => new Promise((done) => { resolve = done; }) }); harness.render();
    if (unmount) harness.unmount(); else harness.background();
    resolve(release); await flush(); assert.equal(harness.render().release, null); harness.unmount();
  }
});


test("dispensar invalida consulta que aguardava armazenamento; build nova ignora adiamento anterior", async () => {
  let count = 0;
  let finishStorage!: (value: string | null) => void;
  const harness = hookHarness({ storage: () => ++count === 1 ? Promise.resolve(null) : new Promise((resolve) => { finishStorage = resolve; }) });
  harness.render(); await flush();
  // A reavaliação do fim do intervalo dispara a segunda consulta (app aberto).
  harness.advance(policy.UPDATE_CHECK_INTERVAL_MS); await flush();
  assert.equal(harness.calls, 2);
  harness.render().dismiss(); finishStorage(null); await flush();
  assert.equal(harness.render().release, null);
  harness.unmount();
  const newBuild = hookHarness({ response: async () => ({ ...release, versionCode: 7 }), storage: async () => null });
  newBuild.render(); await flush(); assert.equal(newBuild.render().release.versionCode, 7); newBuild.unmount();
});

test("adiamento persistido recusa popup; nova consulta é permitida após cinco minutos", async () => {
  const harness = hookHarness({ storage: async () => String(1000000000 - 100) });
  harness.render(); await flush(); assert.equal(harness.render().release, null);
  harness.advance(policy.UPDATE_CHECK_INTERVAL_MS - 1); harness.background(); harness.foreground(); await flush(); assert.equal(harness.calls, 1);
  harness.advance(1); harness.background(); harness.foreground(); await flush(); assert.equal(harness.calls, 2); harness.unmount();
});

test("Atualizar: abre a Play pelo Linking real (método com this); market falha → HTTPS; as duas falham → erro e popup segue", async () => {
  const MARKET = "market://details?id=br.com.dular.app";

  // Sucesso direto: abre market:// e o popup recolhe em faixa (sem adiamento gravado).
  const direto = new LinkingFalso();
  const a = hookHarness({ linking: direto }); a.render(); await flush();
  await a.render().update(); await flush();
  assert.deepEqual(direto.abertas, [MARKET]);
  assert.equal(a.render().release.versionCode, 6, "o aviso continua disponível");
  assert.equal(a.render().recolhido, true, "sem popup; faixa para tentar de novo");
  assert.equal(a.render().error, null);
  assert.equal(a.storageWrites, 0, "Atualizar não grava adiamento");
  a.unmount();

  // Primeiro caminho falha, segundo abre.
  const fallback = new LinkingFalso(async (url) => { if (url.startsWith("market:")) throw new Error("No Activity found to handle Intent"); });
  const b = hookHarness({ linking: fallback }); b.render(); await flush();
  await b.render().update(); await flush();
  assert.deepEqual(fallback.abertas, [MARKET, policy.PLAY_STORE_URL]);
  assert.equal(b.render().recolhido, true);
  assert.equal(b.storageWrites, 0);
  b.unmount();

  // As duas falham: mensagem de erro, popup continua para tentar de novo.
  const nenhum = new LinkingFalso(async () => { throw new Error("No Activity found to handle Intent"); });
  const c = hookHarness({ linking: nenhum }); c.render(); await flush();
  await c.render().update(); await flush();
  assert.deepEqual(nenhum.abertas, [MARKET, policy.PLAY_STORE_URL]);
  assert.equal(c.render().release.versionCode, 6);
  assert.equal(c.render().error, "Não foi possível abrir a Google Play. Tente novamente.");
  assert.equal(c.render().recolhido, false, "abertura recusada: o popup continua");
  assert.equal(c.storageWrites, 0, "e nada é adiado");
  c.unmount();
});

test("loja aberta e volta sem atualizar: sem popup a cada retorno, faixa permite abrir de novo; 'Agora não' é o único adiamento", async () => {
  const MARKET = "market://details?id=br.com.dular.app";
  const linking = new LinkingFalso();
  const h = hookHarness({ linking }); h.render(); await flush();
  await h.render().update(); await flush();
  // Ida e volta da loja várias vezes, inclusive depois do intervalo de consulta.
  for (let i = 0; i < 3; i++) {
    h.background(); h.render();
    h.foreground(); h.render(); await flush();
    assert.equal(h.render().release?.versionCode, 6);
    assert.equal(h.render().recolhido, true, `retorno ${i + 1}: só a faixa`);
  }
  await h.avancar(policy.UPDATE_CHECK_INTERVAL_MS + 1000); h.foreground(); await flush();
  assert.equal(h.render().recolhido, true, "nova consulta não reabre o popup");
  // Ação acessível: abre a loja de novo.
  await h.render().update(); await flush();
  assert.deepEqual(linking.abertas, [MARKET, MARKET]);
  assert.equal(h.storageWrites, 0);
  // "Agora não" na faixa: adia 24 h e some.
  h.render().dismiss(); await flush();
  assert.equal(h.render().release, null);
  assert.equal(h.storageWrites, 1);
  h.unmount();
});

test("retorno com a versão atualizada: build instalada igual ou maior que a anunciada não mostra popup nem faixa", async () => {
  const atualizado = hookHarness({ build: "6" }); atualizado.render(); await flush();
  assert.equal(atualizado.render().release, null);
  assert.equal(atualizado.render().recolhido, false);
  atualizado.unmount();
  const maisNovo = hookHarness({ build: "7" }); maisNovo.render(); await flush();
  assert.equal(maisNovo.render().release, null);
  maisNovo.unmount();
});

test("faixa da loja: só em memória — processo novo sem adiamento mostra o popup outra vez", async () => {
  const a = hookHarness(); a.render(); await flush();
  await a.render().update(); await flush();
  assert.equal(a.render().recolhido, true);
  a.unmount();
  const b = hookHarness(); b.render(); await flush();
  assert.equal(b.render().release?.versionCode, 6);
  assert.equal(b.render().recolhido, false, "nada foi gravado: na próxima abertura o popup volta");
  b.unmount();
});

test("troca de conta: aviso consultado no perfil anterior continua valendo para o próximo, sem nova consulta", async () => {
  const harness = hookHarness();
  harness.render(true); await flush();
  assert.equal(harness.render(true).release.versionCode, 6);
  harness.render(false); await flush(); // login/troca de conta: o app sai do estado pronto
  harness.advance(6_000);
  assert.equal(harness.render(true).release?.versionCode, 6, "o perfil seguinte recebe o mesmo aviso");
  assert.equal(harness.calls, 1, "sem consulta extra por troca de conta");
  harness.unmount();
});

test("troca de conta no meio da consulta: a consulta interrompida não conta para o intervalo de cinco minutos", async () => {
  let resolve!: (value: unknown) => void;
  let primeira = true;
  const harness = hookHarness({ response: () => primeira ? (primeira = false, new Promise((done) => { resolve = done; })) : Promise.resolve(release) });
  harness.render(true);
  harness.render(false); // a troca de conta descarta a consulta em andamento
  resolve(release); await flush();
  harness.advance(6_000);
  harness.render(true); await flush();
  assert.equal(harness.calls, 2, "o próximo perfil consulta de novo");
  assert.equal(harness.render(true).release?.versionCode, 6);
  harness.unmount();
});

test("adiamento continua valendo para a instalação inteira, em qualquer perfil", async () => {
  const harness = hookHarness();
  harness.render(true); await flush();
  harness.render(true).dismiss(); await flush();
  harness.render(false); harness.advance(6_000); harness.render(true); await flush();
  assert.equal(harness.render(true).release, null, "Agora não vale para todos os perfis por 24h");
  harness.unmount();
});

test("durante login/bootstrap o aviso preservado não aparece; volta quando o app fica pronto", async () => {
  const harness = hookHarness();
  harness.render(true); await flush();
  assert.equal(harness.render(true).release.versionCode, 6);
  assert.equal(harness.render(false).release, null, "escondido enquanto o app não está pronto");
  await flush();
  assert.equal(harness.render(false).release, null);
  assert.equal(harness.render(true).release?.versionCode, 6);
  harness.unmount();
});

test("resposta tardia de consulta interrompida pela troca de conta não abre o popup no meio do login", async () => {
  let resolve!: (value: unknown) => void;
  const harness = hookHarness({ response: () => new Promise((done) => { resolve = done; }) });
  harness.render(true);
  harness.render(false);
  resolve(release); await flush();
  assert.equal(harness.render(false).release, null);
  harness.unmount();
});

test("erro de rede conclui a consulta: sem nova tentativa antes de cinco minutos, mesmo com idas e voltas", async () => {
  const harness = hookHarness({ response: async () => null });
  harness.render(true); await flush();
  for (let i = 0; i < 5; i++) { harness.advance(10_000); harness.background(); harness.foreground(); await flush(); }
  harness.render(false); harness.render(true); await flush();
  assert.equal(harness.calls, 1);
  harness.advance(policy.UPDATE_CHECK_INTERVAL_MS); harness.background(); harness.foreground(); await flush();
  assert.equal(harness.calls, 2);
  harness.unmount();
});

test("adiamento respeitado ao passar pelos três perfis em sequência", async () => {
  const harness = hookHarness();
  harness.render(true); await flush();
  harness.render(true).dismiss(); await flush();
  for (let perfil = 0; perfil < 3; perfil++) {
    harness.render(false); harness.advance(policy.UPDATE_CHECK_INTERVAL_MS); harness.render(true);
    harness.background(); harness.foreground(); await flush();
    assert.equal(harness.render(true).release, null, `perfil ${perfil + 1}`);
  }
  harness.unmount();
});

test("rede falha na abertura e volta com o app aberto: nova tentativa em segundos, sem reiniciar", async () => {
  let online = false;
  const harness = hookHarness({ response: async () => (online ? release : FALHA) });
  harness.render(true); await flush();
  assert.equal(harness.render(true).release, null);
  online = true;
  await harness.avancar(30_000); await flush();
  assert.equal(harness.calls, 2, "tentou de novo sem esperar cinco minutos nem reinício");
  assert.equal(harness.render(true).release?.versionCode, 6);
  harness.unmount();
});

test("falhas seguidas: espera dobra até o intervalo normal (sem rajada)", async () => {
  const harness = hookHarness({ response: async () => FALHA });
  harness.render(true); await flush();
  const tempos: number[] = [];
  let ultimo = harness.calls;
  for (let s = 0; s < 1200 && tempos.length < 6; s++) {
    await harness.avancar(1_000); await flush();
    if (harness.calls !== ultimo) { tempos.push(s + 1); ultimo = harness.calls; }
  }
  const intervalos = tempos.map((t, i) => t - (i ? tempos[i - 1] : 0));
  assert.deepEqual(intervalos, [30, 60, 120, 240, 300, 300]);
  harness.unmount();
});

test("anúncio novo com o app aberto: reavaliado no fim do intervalo, sem reinício", async () => {
  let atual: unknown = null;
  const harness = hookHarness({ response: async () => atual });
  harness.render(true); await flush();
  assert.equal(harness.render(true).release, null);
  atual = release;
  await harness.avancar(policy.UPDATE_CHECK_INTERVAL_MS); await flush();
  assert.equal(harness.render(true).release?.versionCode, 6);
  harness.unmount();
});

test("adiamento vencendo com o app aberto: o aviso volta sem reinício; antes disso não", async () => {
  const dispensadoEm = 1000000000;
  const harness = hookHarness({ storage: async () => String(dispensadoEm) });
  harness.render(true); await flush();
  assert.equal(harness.render(true).release, null, "adiado");
  await harness.avancar(policy.UPDATE_SNOOZE_MS - policy.UPDATE_CHECK_INTERVAL_MS); await flush();
  assert.equal(harness.render(true).release, null, "ainda dentro das 24 h");
  const antes = harness.calls;
  await harness.avancar(policy.UPDATE_CHECK_INTERVAL_MS); await flush();
  assert.ok(harness.calls > antes, `reavaliou (consultas ${antes} → ${harness.calls}, agendados ${harness.agendados})`);
  assert.equal(harness.render(true).release?.versionCode, 6, "24 h vencidas: volta com o app aberto");
  harness.unmount();
});

test("segundo plano cancela a agenda; login não recebe popup nem consulta", async () => {
  const harness = hookHarness({ response: async () => FALHA });
  harness.render(true); await flush();
  harness.background();
  await harness.avancar(10 * 60_000); await flush();
  assert.equal(harness.calls, 1, "nada em segundo plano");
  harness.render(false); harness.foreground(); await flush();
  assert.equal(harness.calls, 1, "durante login/bootstrap não consulta");
  assert.equal(harness.render(false).release, null);
  harness.render(true); await flush();
  assert.equal(harness.calls, 2, "pronto de novo: consulta");
  harness.unmount();
});

test("resposta definitiva sem anúncio (404, payload inválido) não vira rajada de tentativas", async () => {
  const harness = hookHarness({ response: async () => null });
  harness.render(true); await flush();
  await harness.avancar(policy.UPDATE_CHECK_INTERVAL_MS - 1); await flush();
  assert.equal(harness.calls, 1);
  await harness.avancar(1); await flush();
  assert.equal(harness.calls, 2);
  harness.unmount();
});

test("consulta do anúncio: sem resposta e 5xx/429/408 são 'não deu para saber'; 404 e payload inválido são definitivos", async () => {
  const signal = new AbortController().signal;
  const com = (r: unknown) => (async () => r) as unknown as typeof fetch;
  assert.deepEqual(await policy.consultarVersaoAndroid("https://api.test", signal, (async () => { throw Error("dns"); }) as unknown as typeof fetch), { ok: false });
  for (const status of [500, 503, 429, 408]) assert.deepEqual(await policy.consultarVersaoAndroid("https://api.test", signal, com({ ok: false, status })), { ok: false });
  assert.deepEqual(await policy.consultarVersaoAndroid("https://api.test", signal, com({ ok: false, status: 404 })), { ok: true, release: null });
  assert.deepEqual(await policy.consultarVersaoAndroid("https://api.test", signal, com({ ok: true, status: 200, json: async () => ({ android: null }) })), { ok: true, release: null });
  assert.deepEqual(await policy.consultarVersaoAndroid("https://api.test", signal, com({ ok: true, status: 200, json: async () => ({ android: release }) })), { ok: true, release });
});

test("timer único: idas e voltas, throttling e falhas nunca deixam mais de um agendamento do verificador", async () => {
  let online = false;
  const harness = hookHarness({ response: async () => (online ? release : FALHA) });
  harness.render(true); await flush();
  for (let i = 0; i < 6; i++) {
    harness.background(); harness.foreground(); await flush();
    assert.ok(harness.agendados <= 1, `agendados=${harness.agendados} na volta ${i}`);
    await harness.avancar(7_000);
    assert.ok(harness.agendados <= 1, `agendados=${harness.agendados} depois de avançar`);
  }
  online = true;
  await harness.avancar(policy.UPDATE_CHECK_INTERVAL_MS);
  assert.ok(harness.agendados <= 1);
  harness.unmount();
  assert.equal(harness.agendados, 0, "desmontado: nada fica agendado");
});

test("sem consultas concorrentes: voltar ao app e o timer vencer durante uma consulta em andamento não abrem outra", async () => {
  let resolver!: (v: unknown) => void;
  let pendentes = 0;
  const harness = hookHarness({ response: () => { pendentes++; return new Promise((r) => { resolver = (v) => { pendentes--; r(v); }; }); } });
  harness.render(true); await flush();
  assert.equal(harness.calls, 1);
  harness.foreground(); harness.foreground(); await flush();
  await harness.avancar(4_000);
  assert.equal(harness.calls, 1, "nenhuma segunda consulta enquanto a primeira não termina");
  resolver(release); await flush();
  assert.equal(pendentes, 0);
  assert.equal(harness.render(true).release?.versionCode, 6);
  harness.unmount();
});

test("resposta antiga descartada: consulta de antes da troca de conta não sobrescreve a mais nova", async () => {
  const respostas: Array<(v: unknown) => void> = [];
  const harness = hookHarness({ response: () => new Promise((r) => { respostas.push(r); }) });
  harness.render(true);                 // consulta 1 (perfil A)
  harness.render(false);                // troca de conta: consulta 1 descartada
  await harness.avancar(1_000);
  harness.render(true); await flush();  // consulta 2 (perfil B)
  assert.equal(respostas.length, 2);
  respostas[1](null); await flush();    // a nova diz: sem anúncio
  respostas[0](release); await flush(); // a antiga chega depois, com anúncio
  assert.equal(harness.render(true).release, null, "a resposta antiga não reabre o aviso");
  harness.unmount();
});

test("adiamento persistido respeitado depois da troca de conta, em processo novo (lido do armazenamento)", async () => {
  const harness = hookHarness({ storage: async () => String(1000000000 - 60_000) });
  harness.render(true); await flush();
  assert.equal(harness.render(true).release, null);
  harness.render(false); await harness.avancar(policy.UPDATE_CHECK_INTERVAL_MS);
  harness.render(true); await flush();
  assert.equal(harness.render(true).release, null, "outro perfil, mesmo adiamento da instalação");
  harness.unmount();
});
