import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton pattern para evitar vazamento de conexões em dev (HMR do Next.js).
// Em produção serverless, garante que o pool seja reutilizado entre invocações
// quando o módulo permanece em cache do lambda warm.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrisma() {
  const datasourceUrl = process.env.DATABASE_URL;
  if (!datasourceUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // O PrismaPg adapter cria/gerencia seu próprio pool de pg internamente
  // quando recebe { connectionString }. Não devemos criar pg.Pool fora deste
  // bloco, senão cada reload do módulo cria um novo pool e esgota conexões.
  const adapter = new PrismaPg({ connectionString: datasourceUrl });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

// Inicialização LAZY: o client só é construído no primeiro acesso, em tempo
// de execução. Construir (e validar DATABASE_URL) no import quebrava o
// `next build` — o "collect page data" importa cada rota sem env de runtime
// e o throw derrubava o build (visto em /api/admin/servicos/cancelar).
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrisma();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    // Métodos precisam de `this` = client real (não o Proxy).
    return typeof value === "function" ? value.bind(client) : value;
  },
});
