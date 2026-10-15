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

function hookHarness(options: { build?: string; platform?: string; dev?: boolean; storageFails?: boolean; storage?: () => Promise<string | null>; response?: () => Promise<unknown> } = {}) {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const code = ts.transpileModule(readFileSync(new NodeURL("../src/hooks/useAppUpdate.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const slots: any[] = [];
  const cleanups: Array<undefined | (() => void)> = [];
  const queued: Array<() => void> = [];
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
    "react-native": { AppState: appState, Platform: { OS: options.platform ?? "android" }, Linking: { openURL: async () => {} } },
    "@react-native-async-storage/async-storage": { getItem: async () => { if (options.storageFails) throw Error(); return options.storage ? options.storage() : null; }, setItem: async () => { storageWrites++; if (options.storageFails) throw Error(); } },
    "expo-constants": { default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" }, __esModule: true },
    "expo-application": { nativeBuildVersion: options.build ?? "5", applicationId: policy.ANDROID_PACKAGE },
    "@/config/api": { default: "https://api.test", __esModule: true },
    "@/lib/appUpdate": { ...policy, fetchAndroidRelease: async () => { calls++; return options.response ? options.response() : release; } },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, __DEV__: options.dev ?? false, AbortController, setTimeout, clearTimeout, Map, Date: { now: () => clock } });
  return {
    render(enabled = true) { cursor = 0; const value = module.exports.useAppUpdate(enabled); while (queued.length) queued.shift()!(); return value; },
    unmount() { for (const cleanup of cleanups) cleanup?.(); },
    foreground() { appState.currentState = "active"; listener?.("active"); },
    background() { appState.currentState = "background"; listener?.("background"); },
    advance(ms: number) { clock += ms; },
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
  harness.advance(policy.UPDATE_CHECK_INTERVAL_MS);
  harness.background(); harness.foreground(); await flush();
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
