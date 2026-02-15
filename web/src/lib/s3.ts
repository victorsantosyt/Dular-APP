import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.S3_REGION || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
  console.warn("[S3] Variáveis de ambiente ausentes. Uploads não funcionarão até configurar S3.");
}

export const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export const S3_BUCKET = process.env.S3_BUCKET || "";
