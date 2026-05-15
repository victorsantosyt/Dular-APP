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

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
