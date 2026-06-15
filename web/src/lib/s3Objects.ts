import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "@/lib/s3";

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
  // Cast necessário por skew de versão entre @aws-sdk/client-s3 e
  // @aws-sdk/s3-request-presigner (duplicidade de @smithy/types). Em runtime
  // o client é aceito normalmente; o cast só silencia o conflito de tipos.
  return getSignedUrl(s3 as never, cmd, { expiresIn: expiresSec });
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

// Expiração das URLs de exibição (galerias/portfólio). Generosa o suficiente
// para uma sessão; o perfil é re-buscado ao focar e renova os links.
const DISPLAY_EXPIRES_SEC = 60 * 60 * 6; // 6h

/**
 * Converte keys do S3 em URLs assinadas para exibição. Defensivo: valores que
 * já são URL (http) ou data URL passam direto; se a assinatura falhar (ex.: S3
 * sem credenciais), devolve o valor cru em vez de quebrar a resposta.
 */
export async function signKeysForDisplay(
  keys: (string | null | undefined)[] | null | undefined,
  expiresSec = DISPLAY_EXPIRES_SEC,
): Promise<string[]> {
  const list = (keys ?? []).filter((k): k is string => Boolean(k));
  if (list.length === 0) return [];
  return Promise.all(
    list.map(async (k) => {
      if (/^https?:\/\//i.test(k) || k.startsWith("data:")) return k;
      try {
        return await signGetUrl(k, expiresSec);
      } catch {
        return k;
      }
    }),
  );
}
