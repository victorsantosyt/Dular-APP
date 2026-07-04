import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "../src/lib/password";

/**
 * SEED DE PRODUÇÃO — Beta 0
 *
 * Cria somente o mínimo operacional, tudo parametrizado por env (nunca
 * credencial hardcoded, nunca usuário demo, nunca dado de teste):
 *   1. Admin inicial          — PROD_ADMIN_EMAIL + PROD_ADMIN_PASSWORD
 *   2. Bairros da cidade piloto — PILOT_CITY + PILOT_UF + PILOT_BAIRROS (CSV)
 *
 * O que NÃO é semeado, por decisão oficial do produto:
 *   - Categorias de serviço: são enums de código, não existe tabela a semear.
 *   - FeatureLimit: Beta 0 não monetiza; limites ficam inertes (Sprint 3).
 *
 * Idempotência: apenas upserts em chaves únicas. Re-execução não duplica
 * nada; para o admin, atualiza nome/senha (permite rotação de credencial
 * re-rodando com PROD_ADMIN_PASSWORD novo).
 *
 * Uso: npm run seed:prod  (exige as envs acima; aborta com erro claro sem elas)
 */

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} é obrigatória para o seed de produção`);
  }
  return value;
}

async function main() {
  // ── 1. Admin inicial ────────────────────────────────────────────────────────
  const adminEmail = requireEnv("PROD_ADMIN_EMAIL");
  const adminPassword = requireEnv("PROD_ADMIN_PASSWORD");
  if (adminPassword.length < 8) {
    throw new Error("PROD_ADMIN_PASSWORD precisa ter no mínimo 8 caracteres");
  }
  const adminNome = process.env.PROD_ADMIN_NOME?.trim() || "Admin Dular";
  const adminTelefone = process.env.PROD_ADMIN_TELEFONE?.trim() || undefined;

  const senhaHash = await hashPassword(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      nome: adminNome,
      senhaHash,
      role: "ADMIN",
      ...(adminTelefone ? { telefone: adminTelefone } : {}),
    },
    create: {
      nome: adminNome,
      email: adminEmail,
      senhaHash,
      role: "ADMIN",
      ...(adminTelefone ? { telefone: adminTelefone } : {}),
    },
  });
  console.log(`✔ admin: ${admin.email} (role=${admin.role})`);

  // ── 2. Bairros da cidade piloto ─────────────────────────────────────────────
  const cidade = process.env.PILOT_CITY?.trim();
  const uf = process.env.PILOT_UF?.trim();
  const bairrosCsv = process.env.PILOT_BAIRROS?.trim();

  if (cidade || uf || bairrosCsv) {
    if (!cidade || !uf || !bairrosCsv) {
      throw new Error(
        "Defina PILOT_CITY, PILOT_UF e PILOT_BAIRROS juntas (ou nenhuma)",
      );
    }
    const bairros = bairrosCsv
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    for (const nome of bairros) {
      await prisma.bairro.upsert({
        where: { nome_cidade_uf: { nome, cidade, uf } },
        update: {},
        create: { nome, cidade, uf },
      });
    }
    console.log(`✔ bairros: ${bairros.length} em ${cidade}-${uf}`);
  } else {
    console.warn(
      "⚠ nenhum bairro semeado — defina PILOT_CITY/PILOT_UF/PILOT_BAIRROS " +
        "(a busca por bairro depende disso na cidade piloto)",
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
