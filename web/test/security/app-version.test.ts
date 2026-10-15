import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET, dynamic } from "../../src/app/api/app/version/route";

const originalRelease = process.env.ANDROID_APP_RELEASE;
const validRelease = { versionCode: 100, versionName: "1.0.0", notes: ["Melhorias na abertura do app."] };

afterEach(() => {
  if (originalRelease === undefined) delete process.env.ANDROID_APP_RELEASE;
  else process.env.ANDROID_APP_RELEASE = originalRelease;
});

describe("GET /api/app/version", () => {
  it("é dinâmico, público e entrega a versão e a URL fixa da Play sem cache", async () => {
    process.env.ANDROID_APP_RELEASE = JSON.stringify(validRelease);
    const response = await GET();
    assert.equal(dynamic, "force-dynamic");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      android: {
        ...validRelease,
        packageName: "br.com.dular.app",
        storeUrl: "https://play.google.com/store/apps/details?id=br.com.dular.app",
      },
    });
  });

  it("remove espaços externos e permite lista vazia de novidades", async () => {
    process.env.ANDROID_APP_RELEASE = JSON.stringify({ ...validRelease, versionName: " 1.0.0 ", notes: [" Novidade "] });
    const first = await (await GET()).json();
    assert.equal(first.android.versionName, "1.0.0");
    assert.deepEqual(first.android.notes, ["Novidade"]);
    process.env.ANDROID_APP_RELEASE = JSON.stringify({ ...validRelease, notes: [] });
    assert.deepEqual((await (await GET()).json()).android.notes, []);
  });

  it("não captura a configuração na importação: cada chamada lê o ambiente atual", async () => {
    delete process.env.ANDROID_APP_RELEASE;
    assert.deepEqual(await (await GET()).json(), { android: null });
    process.env.ANDROID_APP_RELEASE = JSON.stringify(validRelease);
    assert.equal((await (await GET()).json()).android.versionCode, 100);
    process.env.ANDROID_APP_RELEASE = JSON.stringify({ ...validRelease, versionCode: 101 });
    assert.equal((await (await GET()).json()).android.versionCode, 101);
    delete process.env.ANDROID_APP_RELEASE;
    assert.deepEqual(await (await GET()).json(), { android: null });
  });

  const invalidValues: [string, unknown][] = [
    ["nulo", null], ["array", []], ["string", "release"], ["número", 100],
    ["objeto vazio", {}],
    ["código zero", { ...validRelease, versionCode: 0 }],
    ["código negativo", { ...validRelease, versionCode: -1 }],
    ["código fracionário", { ...validRelease, versionCode: 1.5 }],
    ["código em string", { ...validRelease, versionCode: "100" }],
    ["código acima do limite Android", { ...validRelease, versionCode: 2_100_000_001 }],
    ["código inseguro", { ...validRelease, versionCode: Number.MAX_SAFE_INTEGER + 1 }],
    ["nome vazio", { ...validRelease, versionName: "  " }],
    ["nome longo", { ...validRelease, versionName: "a".repeat(31) }],
    ["nome numérico", { ...validRelease, versionName: 100 }],
    ["notas ausentes", { versionCode: 100, versionName: "1.0.0" }],
    ["notas não array", { ...validRelease, notes: "Novidade" }],
    ["notas demais", { ...validRelease, notes: Array(6).fill("Novidade") }],
    ["nota vazia", { ...validRelease, notes: [" "] }],
    ["nota longa", { ...validRelease, notes: ["a".repeat(181)] }],
    ["nota não textual", { ...validRelease, notes: [null] }],
    ["URL injetada", { ...validRelease, storeUrl: "https://example.com" }],
    ["campo extra", { ...validRelease, required: true }],
  ];
  for (const [name, value] of invalidValues) {
    it(`desabilita o aviso sem erro para ${name}`, async () => {
      process.env.ANDROID_APP_RELEASE = JSON.stringify(value);
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { android: null });
    });
  }

  it("desabilita o aviso para JSON malformado ou vazio", async () => {
    for (const raw of ["", " ", "{", '{"versionCode":100,']) {
      process.env.ANDROID_APP_RELEASE = raw;
      const response = await GET();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { android: null });
    }
  });

  it("aceita os limites documentados", async () => {
    process.env.ANDROID_APP_RELEASE = JSON.stringify({ versionCode: 2_100_000_000, versionName: "a".repeat(30), notes: Array(5).fill("a".repeat(180)) });
    assert.equal((await (await GET()).json()).android.versionCode, 2_100_000_000);
  });
});
