import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION ?? process.env.S3_REGION;
const bucket = process.env.AWS_BUCKET_NAME ?? process.env.S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY;

if (!region || !bucket || !accessKeyId || !secretAccessKey) {
  console.warn("[S3] Variáveis de ambiente ausentes. Uploads não funcionarão até configurar S3.");
}

export const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export const S3_BUCKET = bucket || "";
