/**
 * Zera `senhaHash` de todo usuário que não seja ADMIN.
 *
 * Rodar de dentro de `web/`:
 *   npm run senhas:limpar          (mostra o que faria, não escreve)
 *   npm run senhas:limpar -- --aplicar
 *
 * POR QUE
 *
 * O app entra por OAuth. Uma conta comum não usa senha para nada: não há tela
 * que peça, não há rota que aceite. Mas contas antigas carregam `senhaHash` de
 * quando o cadastro por telefone+senha existia.
 *
 * `POST /api/auth/login` hoje recusa quem não é ADMIN, então essas senhas não
 * abrem nada. Isso é uma checagem — uma linha de código que alguém pode
 * afrouxar. Credencial que não existe não depende de checagem nenhuma.
 *
 * O QUE NÃO FAZ
 *
 * Não toca em ADMIN: é a única conta que usa senha, no painel. Não apaga
 * usuário, não mexe em papel, status ou perfil. Só `senhaHash = null`.
 *
 * Idempotente: rodar de novo não encontra mais nada para limpar.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  console.error("\n✖ DATABASE_URL não definida.\n");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const aplicar = process.argv.includes("--aplicar");

async function main() {
  // `role: { not: "ADMIN" }` deixaria de fora quem tem role NULL — e conta sem
  // papel definido também não usa senha. O filtro precisa ser explícito.
  const alvo = {
    NOT: { senhaHash: null },
    OR: [{ role: { not: "ADMIN" as const } }, { role: null }],
  };

  const porPapel = await prisma.user.groupBy({
    by: ["role"],
    where: alvo,
    _count: { _all: true },
  });

  const total = porPapel.reduce((s, r) => s + r._count._all, 0);
  const admins = await prisma.user.count({ where: { role: "ADMIN", NOT: { senhaHash: null } } });

  console.log("");
  console.log("Contas NÃO-ADMIN com senha:");
  if (porPapel.length === 0) {
    console.log("  (nenhuma — nada a fazer)");
  } else {
    for (const r of porPapel.sort((a, b) => b._count._all - a._count._all)) {
      console.log(`  ${String(r.role ?? "(sem papel)").padEnd(12)} ${r._count._all}`);
    }
    console.log(`  ${"TOTAL".padEnd(12)} ${total}`);
  }
  console.log("");
  console.log(`ADMINs com senha (preservados): ${admins}`);
  console.log("");

  if (total === 0) return;

  if (!aplicar) {
    console.log("Simulação — nada foi escrito. Para aplicar:");
    console.log("  npm run senhas:limpar -- --aplicar");
    console.log("");
    return;
  }

  const r = await prisma.user.updateMany({ where: alvo, data: { senhaHash: null } });
  console.log(`✓ ${r.count} senha(s) removida(s).`);

  const sobrou = await prisma.user.count({ where: alvo });
  if (sobrou > 0) {
    console.error(`\n✖ ainda restam ${sobrou} — a limpeza não fechou.\n`);
    process.exit(1);
  }
  console.log("✓ conferido: nenhuma conta não-ADMIN com senha.");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
