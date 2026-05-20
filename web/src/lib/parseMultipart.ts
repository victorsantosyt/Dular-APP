import { Readable } from "node:stream";
import formidable, { type Files, type Fields, type Options } from "formidable";

export async function parseMultipart(req: Request, opts?: Options): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({
    multiples: true,
    ...opts,
  });

  if (!req.body) {
    throw new Error("Requisição sem corpo (body).");
  }

  // Next.js App Router entrega Web `Request`; formidable espera um Node
  // IncomingMessage com `.headers` (lower-case) para ler content-length e
  // content-type. Convertendo o body para Readable e anexando os headers
  // manualmente cobre os dois requisitos.
  const stream = Readable.fromWeb(req.body as any);
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const nodeLike = Object.assign(stream, { headers });

  return await new Promise((resolve, reject) => {
    form.parse(nodeLike as any, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}
