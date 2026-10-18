import { S3Client } from "@aws-sdk/client-s3";

// Inicialização LAZY: env lido e S3Client construído no PRIMEIRO uso (runtime),
// nunca no import. Assim o `next build`/collect não lê env de S3 nem constrói o
// SDK, e um ambiente sem S3 configurado não afeta o build.
//
// S3_* (staging, bucket próprio) tem precedência sobre AWS_* (produção): no
// runtime da Vercel a plataforma pode injetar AWS_REGION e credenciais AWS_*
// próprias, que não são as do nosso bucket.

let clientSingleton: S3Client | null = null;

type ConfiguracaoS3 = { fonte: "S3_*" | "AWS_*" | "nenhuma"; region?: string; bucket: string; accessKeyId?: string; secretAccessKey?: string };

/**
 * Um conjunto só, nunca campos misturados: com qualquer S3_* presente, valem
 * SÓ os quatro S3_* (faltou um, a configuração está incompleta e o upload
 * falha — nada vai para outro bucket). Sem S3_*, valem os AWS_* (produção).
 */
export function configuracaoS3(env: Record<string, string | undefined> = process.env): ConfiguracaoS3 {
  const s3 = { region: env.S3_REGION, bucket: env.S3_BUCKET, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY };
  if (Object.values(s3).some(Boolean)) return { fonte: "S3_*", ...s3, bucket: Object.values(s3).every(Boolean) ? s3.bucket! : "" };
  if (env.AWS_BUCKET_NAME) {
    return { fonte: "AWS_*", region: env.AWS_REGION, bucket: env.AWS_BUCKET_NAME, accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY };
  }
  return { fonte: "nenhuma", bucket: "" };
}

export function getS3Client(): S3Client {
  if (!clientSingleton) {
    const { region, bucket, accessKeyId, secretAccessKey } = configuracaoS3();
    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      console.warn("[S3] Configuração de armazenamento incompleta. Uploads não funcionarão até configurar S3.");
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
  return configuracaoS3().bucket;
}
