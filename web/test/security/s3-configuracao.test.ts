import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configuracaoS3 } from "../../src/lib/s3";

/**
 * Configuração de armazenamento: um conjunto só. S3_* (bucket do staging) tem
 * precedência e nunca se mistura com AWS_* (produção, ou injetado pelo runtime).
 */
describe("configuração do S3", () => {
  const S3 = { S3_REGION: "sa-east-1", S3_BUCKET: "dular-staging-uploads", S3_ACCESS_KEY_ID: "id-staging", S3_SECRET_ACCESS_KEY: "seg-staging" };
  const AWS = { AWS_REGION: "us-east-1", AWS_BUCKET_NAME: "bucket-de-producao", AWS_ACCESS_KEY_ID: "id-prod", AWS_SECRET_ACCESS_KEY: "seg-prod" };

  it("staging: só S3_*, mesmo com AWS_* presente (injetado ou não)", () => {
    assert.deepEqual(configuracaoS3({ ...S3, ...AWS }), { fonte: "S3_*", region: "sa-east-1", bucket: "dular-staging-uploads", accessKeyId: "id-staging", secretAccessKey: "seg-staging" });
  });

  it("S3_* incompleto não completa com AWS_*: bucket vazio, upload falha", () => {
    for (const falta of Object.keys(S3)) {
      const env: Record<string, string | undefined> = { ...S3, ...AWS, [falta]: undefined };
      const c = configuracaoS3(env);
      assert.equal(c.fonte, "S3_*");
      assert.equal(c.bucket, "", `sem ${falta}`);
      assert.notEqual(c.accessKeyId, "id-prod");
      assert.notEqual(c.region, "us-east-1");
    }
  });

  it("produção: só AWS_*, como hoje", () => {
    assert.deepEqual(configuracaoS3(AWS), { fonte: "AWS_*", region: "us-east-1", bucket: "bucket-de-producao", accessKeyId: "id-prod", secretAccessKey: "seg-prod" });
  });

  it("nada configurado: sem bucket", () => {
    assert.deepEqual(configuracaoS3({}), { fonte: "nenhuma", bucket: "" });
  });

  it("upload sem ACL (bucket com ACLs desativadas recusaria ACL private)", () => {
    const fonte = readFileSync(new URL("../../src/lib/s3Objects.ts", import.meta.url), "utf8").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(fonte, /ACL\s*:/);
  });
});
