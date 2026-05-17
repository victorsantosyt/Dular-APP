import type { NextConfig } from "next";

const devAllowedOrigin =
  process.env.DEV_ALLOWED_ORIGIN ??
  process.env.NEXT_PUBLIC_NGROK_HOST ??
  (process.env.NODE_ENV !== "production" ? "deduce-variable-almanac.ngrok-free.dev" : undefined);

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  ...(process.env.NODE_ENV !== "production" && devAllowedOrigin
    ? { allowedDevOrigins: [devAllowedOrigin] }
    : {}),
};

export default nextConfig;
