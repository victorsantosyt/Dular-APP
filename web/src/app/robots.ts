import type { MetadataRoute } from "next";

// Só /admin (painel interno) e /api (consumidos pelo app mobile) ficam
// públicos neste domínio — nada aqui deve ser indexado por buscadores.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
