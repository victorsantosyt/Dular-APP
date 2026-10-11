import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { googlePlay, googlePlayLigado, loja, lojasProntas, ErroDeLoja } from "../../src/lib/lojas";

/**
 * DULAR_GOOGLE_PLAY_PREVIEW=ligado (issue #359): liga o Google Play só num
 * Preview da Vercel com o banco de staging validado. Em produção, local ou com
 * o banco errado, a variável é ignorada e as compras seguem desligadas.
 */

// URLs fictícias, no formato da Neon.
const STG_HOST = "ep-staging-aaa111.sa-east-1.aws.neon.tech";
const STG_DIRETA = `postgresql://dono_stg:senha-falsa@${STG_HOST}/neondb`;
const STG_POOLER = "postgresql://dono_stg:senha-falsa@ep-staging-aaa111-pooler.sa-east-1.aws.neon.tech/neondb";
const PROD_POOLER = "postgresql://dono_prod:senha-falsa@ep-producao-bbb222-pooler.sa-east-1.aws.neon.tech/neondb";

const previewLigado = (extra: Record<string, string | undefined> = {}) => ({
  VERCEL_ENV: "preview",
  DULAR_GOOGLE_PLAY_PREVIEW: "ligado",
  DULAR_DB_AMBIENTE: "staging",
  DULAR_STAGING_DB_HOST: STG_HOST,
  DATABASE_URL: STG_POOLER,
  DATABASE_URL_UNPOOLED: STG_DIRETA,
  ...extra,
});

const CHAVES = [
  "VERCEL_ENV",
  "DULAR_GOOGLE_PLAY_PREVIEW",
  "DULAR_DB_AMBIENTE",
  "DULAR_STAGING_DB_HOST",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
] as const;
const original = Object.fromEntries(CHAVES.map((k) => [k, process.env[k]]));
const buscarOriginal = googlePlay.buscar;

function usarAmbiente(env: Record<string, string | undefined>) {
  for (const k of CHAVES) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "br.com.dular.app";
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "x@y", private_key: "nao-usada" });
}

afterEach(() => {
  for (const k of CHAVES) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
  googlePlay.buscar = buscarOriginal;
  loja.implementada.GOOGLE = false;
});

describe("DULAR_GOOGLE_PLAY_PREVIEW", () => {
  it("Preview + ligado + banco de staging validado: liga", () => {
    assert.equal(googlePlayLigado(previewLigado()), true);
    usarAmbiente(previewLigado());
    assert.equal(lojasProntas().google, true);
  });

  it("produção: a variável é ignorada, mesmo com tudo de staging presente", () => {
    assert.equal(googlePlayLigado(previewLigado({ VERCEL_ENV: "production" })), false);
    usarAmbiente(previewLigado({ VERCEL_ENV: "production" }));
    assert.equal(lojasProntas().google, false);
  });

  it("produção com as variáveis reais de produção (sem nada de staging): a variável é ignorada", () => {
    const producao = {
      VERCEL_ENV: "production",
      DULAR_GOOGLE_PLAY_PREVIEW: "ligado",
      DATABASE_URL: PROD_POOLER,
      DATABASE_URL_UNPOOLED: PROD_POOLER.replace("-pooler", ""),
    };
    assert.equal(googlePlayLigado(producao), false);
    usarAmbiente(producao);
    assert.equal(lojasProntas().google, false);
  });

  it("produção: compra e consulta não chegam ao Google", async () => {
    usarAmbiente(previewLigado({ VERCEL_ENV: "production" }));
    let chamadas = 0;
    googlePlay.buscar = (async () => {
      chamadas++;
      throw new Error("não deveria chamar o Google");
    }) as typeof googlePlay.buscar;
    await assert.rejects(loja.verificar("GOOGLE", "token", "br.com.dular.diarista.pro.mensal"), (e) => {
      assert.ok(e instanceof ErroDeLoja);
      assert.equal(e.codigo, "LOJA_INDISPONIVEL");
      return true;
    });
    await assert.rejects(loja.consultar("GOOGLE", "token"), ErroDeLoja);
    assert.equal(chamadas, 0);
  });

  it("produção: o webhook responde 503 sem ler nada", async () => {
    usarAmbiente(previewLigado({ VERCEL_ENV: "production" }));
    const { POST } = await import("../../src/app/api/webhooks/google-play/route");
    const res = await POST(new Request("http://x/api/webhooks/google-play", { method: "POST", body: "{}" }));
    assert.equal(res.status, 503);
  });

  it("controle positivo: no Preview validado o webhook passa da trava (401 sem token OIDC)", async () => {
    usarAmbiente(previewLigado());
    const { POST } = await import("../../src/app/api/webhooks/google-play/route");
    const res = await POST(new Request("http://x/api/webhooks/google-play", { method: "POST", body: "{}" }));
    assert.equal(res.status, 401);
  });

  it("Preview com banco de produção no runtime: desligado", () => {
    assert.equal(googlePlayLigado(previewLigado({ DATABASE_URL: PROD_POOLER })), false);
  });

  it("Preview sem as provas do staging: desligado", () => {
    assert.equal(googlePlayLigado(previewLigado({ DULAR_DB_AMBIENTE: undefined })), false);
    assert.equal(googlePlayLigado(previewLigado({ DULAR_STAGING_DB_HOST: undefined })), false);
    assert.equal(googlePlayLigado(previewLigado({ DATABASE_URL_UNPOOLED: undefined })), false);
  });

  it("valor diferente de 'ligado', ausente, ou fora da Vercel: desligado", () => {
    assert.equal(googlePlayLigado(previewLigado({ DULAR_GOOGLE_PLAY_PREVIEW: "true" })), false);
    assert.equal(googlePlayLigado(previewLigado({ DULAR_GOOGLE_PLAY_PREVIEW: undefined })), false);
    assert.equal(googlePlayLigado(previewLigado({ VERCEL_ENV: undefined })), false);
    assert.equal(googlePlayLigado(previewLigado({ VERCEL_ENV: "development" })), false);
  });
});
