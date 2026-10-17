import { S3Client } from "@aws-sdk/client-s3";

// Inicialização LAZY: env lido e S3Client construído no PRIMEIRO uso (runtime),
// nunca no import. Assim o `next build`/collect não lê env de S3 nem constrói o
// SDK, e um ambiente sem S3 configurado não afeta o build. Aceita S3_* ou AWS_*.
//
// S3_* tem precedência: no runtime da Vercel (Lambda) a plataforma pode injetar
// AWS_REGION e credenciais AWS_* próprias, que não são as do nosso bucket. O
// staging usa S3_* (bucket só de staging); produção segue com AWS_*.

let clientSingleton: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!clientSingleton) {
    const region = process.env.S3_REGION || process.env.AWS_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
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
  return process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME || "";
}
