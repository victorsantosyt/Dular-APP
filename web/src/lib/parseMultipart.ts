import { Readable } from "node:stream";
import formidable, { type Files, type Fields, type Options } from "formidable";

export async function parseMultipart(req: Request, opts?: Options): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({
    multiples: true,
    ...opts,
  });

  const stream = Readable.fromWeb(req.body as any);

  return await new Promise((resolve, reject) => {
    form.parse(stream as any, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}
