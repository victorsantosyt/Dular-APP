import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Qual configuração de armazenamento vale. S3_* (bucket do staging) tem
 * precedência sobre AWS_*, que o runtime da Vercel pode injetar; produção, só
 * com AWS_*, continua igual.
 */
describe("configuração do S3", () => {
  const chaves = ["S3_BUCKET", "AWS_BUCKET_NAME"];
  let antes: Record<string, string | undefined>;
  beforeEach(() => { antes = Object.fromEntries(chaves.map((k) => [k, process.env[k]])); });
  afterEach(() => { for (const k of chaves) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } });

  it("staging: S3_BUCKET vale mesmo com AWS_BUCKET_NAME presente", async () => {
    const { s3Bucket } = await import("../../src/lib/s3");
    process.env.S3_BUCKET = "dular-staging-uploads";
    process.env.AWS_BUCKET_NAME = "bucket-de-producao";
    assert.equal(s3Bucket(), "dular-staging-uploads");
  });

  it("produção: só AWS_BUCKET_NAME, como hoje", async () => {
    const { s3Bucket } = await import("../../src/lib/s3");
    delete process.env.S3_BUCKET;
    process.env.AWS_BUCKET_NAME = "bucket-de-producao";
    assert.equal(s3Bucket(), "bucket-de-producao");
  });

  it("nenhum configurado: vazio (a rota falha, nada é gravado em outro lugar)", async () => {
    const { s3Bucket } = await import("../../src/lib/s3");
    delete process.env.S3_BUCKET;
    delete process.env.AWS_BUCKET_NAME;
    assert.equal(s3Bucket(), "");
  });
});
