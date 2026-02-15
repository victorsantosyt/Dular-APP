import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "./s3";

export function makeKey(prefix: string, ext: string) {
  const id = crypto.randomBytes(16).toString("hex");
  const safeExt = ext.replace(".", "").toLowerCase();
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${id}.${safeExt}`;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "private",
    })
  );
}

export async function signGetUrl(key: string, expiresSec = 60) {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}
