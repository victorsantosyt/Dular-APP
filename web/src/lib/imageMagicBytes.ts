// Detecção do tipo real de imagem a partir dos primeiros bytes do arquivo.
// Defende contra arquivos com MIME ou extensão forjada no multipart.
//
//   JPEG: FF D8 FF
//   PNG : 89 50 4E 47 0D 0A 1A 0A

export type DetectedImageMime = "image/jpeg" | "image/png";

export function detectImageMime(buffer: Buffer): DetectedImageMime | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  return null;
}

export function extensionForMime(mime: DetectedImageMime) {
  return mime === "image/png" ? ".png" : ".jpg";
}
