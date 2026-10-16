import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Raiz do repositório, a partir DESTE arquivo (não do diretório de onde o
// comando roda): o servidor importa shared/ (ex.: shared/safescore/guia.ts),
// que fica fora de web/.
const raizDoRepositorio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const devAllowedOrigin =
  process.env.DEV_ALLOWED_ORIGIN ??
  process.env.NEXT_PUBLIC_NGROK_HOST ??
  (process.env.NODE_ENV !== "production" ? "deduce-variable-almanac.ngrok-free.dev" : undefined);

const nextConfig: NextConfig = {
  turbopack: {
    root: raizDoRepositorio,
  },
  ...(process.env.NODE_ENV !== "production" && devAllowedOrigin
    ? { allowedDevOrigins: [devAllowedOrigin] }
    : {}),
};

export default nextConfig;
