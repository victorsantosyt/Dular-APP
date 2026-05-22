// Constrói um body multipart/form-data real como Buffer e devolve um Request
// web-standard com headers compatíveis com `formidable`.
//
// Por quê: passar uma instância de `FormData` como body do `Request` faz o
// runtime gerar um ReadableStream que `Readable.fromWeb()` não consegue
// transformar em algo aceito por formidable (erro `_transform() not
// implemented`). Construindo o body como Buffer e setando content-length
// explícito, formidable parsea normalmente.

import { signToken } from "../../src/lib/auth";
import type { JwtPayload } from "../../src/lib/auth";

type FilePart = { kind: "file"; name: string; filename: string; mime: string; data: Buffer };
type FieldPart = { kind: "field"; name: string; value: string };
type Part = FilePart | FieldPart;

const CRLF = "\r\n";

function randBoundary() {
  return `----DularTestBoundary${Math.random().toString(16).slice(2)}${Date.now()}`;
}

export function buildMultipart(parts: Part[]): { body: Buffer; contentType: string } {
  const boundary = randBoundary();
  const chunks: Buffer[] = [];

  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}${CRLF}`));
    if (p.kind === "file") {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"${CRLF}` +
            `Content-Type: ${p.mime}${CRLF}${CRLF}`,
        ),
      );
      chunks.push(p.data);
      chunks.push(Buffer.from(CRLF));
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${p.name}"${CRLF}${CRLF}${p.value}${CRLF}`,
        ),
      );
    }
  }
  chunks.push(Buffer.from(`--${boundary}--${CRLF}`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export function multipartRequest(
  url: string,
  parts: Part[],
  opts: { userId?: string; role?: JwtPayload["role"]; extraHeaders?: Record<string, string> } = {},
): Request {
  const { body, contentType } = buildMultipart(parts);
  const headers: Record<string, string> = {
    "content-type": contentType,
    "content-length": String(body.length),
    ...(opts.extraHeaders ?? {}),
  };
  if (opts.userId && opts.role) {
    headers.authorization = `Bearer ${signToken({ userId: opts.userId, role: opts.role })}`;
  }
  // Request aceita Buffer/Uint8Array como body.
  return new Request(url, { method: "POST", headers, body: body as unknown as BodyInit });
}

export const JPEG_VALID = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  Buffer.alloc(32, 0xaa),
  Buffer.from([0xff, 0xd9]),
]);

export const PNG_VALID = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 0xbb),
]);
