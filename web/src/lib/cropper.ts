export async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas não suportado");

  // Limita o tamanho final para evitar arquivos gigantes (mantendo proporção).
  const MAX_DIMENSION = 600; // px
  const maxSide = Math.max(pixelCrop.width, pixelCrop.height);
  const scale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;

  const outWidth = Math.max(1, Math.round(pixelCrop.width * scale));
  const outHeight = Math.max(1, Math.round(pixelCrop.height * scale));

  canvas.width = outWidth;
  canvas.height = outHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outWidth,
    outHeight
  );

  // Compressão leve para reduzir peso do arquivo.
  return canvas.toDataURL("image/jpeg", 0.82);
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // CORS
    image.src = url;
  });
}
