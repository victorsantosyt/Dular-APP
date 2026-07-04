import { notFound } from "next/navigation";

// Guarda de ambiente para /dev/* (ferramentas internas de smoke test).
// Sem esta guarda, /dev/smoke fica acessível publicamente em produção e expõe
// operações da API (register/login/ciclo de serviço) com credenciais seed
// hardcoded. Server Component: roda no servidor e devolve 404 em produção,
// antes de renderizar qualquer página cliente sob /dev.
// Evidência do defeito: auditoria Fases 3A/6A/7A (page.tsx sem checagem de NODE_ENV).
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
