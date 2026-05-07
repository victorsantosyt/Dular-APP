import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({
    where: { safeScoreProfile: null },
    select: { id: true, nome: true },
  });

  console.log(`Usuários sem SafeScoreProfile: ${users.length}`);

  let created = 0;
  for (const user of users) {
    await prisma.safeScoreProfile.create({
      data: {
        userId: user.id,
        currentScore: 500,
        riskScore: 0,
        tier: "BRONZE",
      },
    });
    created++;
    console.log(`✅ ${user.nome} (${user.id})`);
  }

  console.log(`\nBackfill concluído: ${created} perfis criados.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
