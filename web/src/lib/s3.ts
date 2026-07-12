import { S3Client } from "@aws-sdk/client-s3";

// Inicialização LAZY: env lido e S3Client construído no PRIMEIRO uso (runtime),
// nunca no import. Assim o `next build`/collect não lê env de S3 nem constrói o
// SDK, e um ambiente sem S3 configurado não afeta o build. Aceita AWS_* ou S3_*.

let clientSingleton: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!clientSingleton) {
    const region = process.env.AWS_REGION ?? process.env.S3_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY;
    if (!region || !s3Bucket() || !accessKeyId || !secretAccessKey) {
      console.warn("[S3] Variáveis de ambiente ausentes. Uploads não funcionarão até configurar S3.");
    }
    clientSingleton = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
      },
    });
  }
  return clientSingleton;
}

/** Nome do bucket, lido em runtime (sem leitura de env em import-time). */
export function s3Bucket(): string {
  return process.env.AWS_BUCKET_NAME ?? process.env.S3_BUCKET ?? "";
}
