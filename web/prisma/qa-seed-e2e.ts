// Script idempotente de seed QA E2E — Iporá/GO
// Garante 3 perfis QA (Empregador, Montador, Profissional de Casa) prontos
// para testes ponta-a-ponta. Re-executar não duplica nada (upsert por email).
//
// Uso:
//   ALLOW_QA_SEED=true npx tsx prisma/qa-seed-e2e.ts
//
// NÃO executar em produção sem autorização explícita.
// NÃO apaga nenhum dado real — só faz upsert dos 3 emails marcados [QA].

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "../src/lib/password";
import {
  getDiaristaProfileCompleteness,
  type DiaristaProfileForCompleteness,
} from "../src/lib/diaristaProfile";

// ============================================================================
// GUARD — abortar se ALLOW_QA_SEED não estiver setado
// ============================================================================
if (process.env.ALLOW_QA_SEED !== "true") {
  console.error(
    "❌ ALLOW_QA_SEED=true não definido. Abortando para evitar execução acidental.",
  );
  console.error(
    "   Uso: ALLOW_QA_SEED=true npx tsx prisma/qa-seed-e2e.ts",
  );
  process.exit(1);
}

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ============================================================================
// Constantes QA — emails QA-only, nunca colidem com dados reais
// ============================================================================
const QA_EMAIL_EMPREGADOR = "qa.empregador.e2e@dular.test";
const QA_EMAIL_MONTADOR = "qa.montador.e2e@dular.test";
const QA_EMAIL_DIARISTA = "qa.profissional.casa.e2e@dular.test";

const QA_CIDADE = "Iporá";
const QA_ESTADO = "GO";
const QA_BAIRRO = "Centro";

const QA_SENHA = "qaqa1234";

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const senhaHash = await hashPassword(QA_SENHA);

  // --------------------------------------------------------------------------
  // 1) Empregador QA
  // --------------------------------------------------------------------------
  const empregador = await prisma.user.upsert({
    where: { email: QA_EMAIL_EMPREGADOR },
    update: {
      nome: "[QA] Empregador E2E",
      role: "EMPREGADOR",
      status: "ATIVO",
    },
    create: {
      email: QA_EMAIL_EMPREGADOR,
      nome: "[QA] Empregador E2E",
      role: "EMPREGADOR",
      status: "ATIVO",
      senhaHash,
    },
  });

  const empregadorPerfil = await prisma.empregadorPerfil.upsert({
    where: { userId: empregador.id },
    update: {
      cidade: QA_CIDADE,
      estado: QA_ESTADO,
      ativo: true,
    },
    create: {
      userId: empregador.id,
      cidade: QA_CIDADE,
      estado: QA_ESTADO,
      ativo: true,
    },
  });

  // --------------------------------------------------------------------------
  // 2) Montador QA
  // --------------------------------------------------------------------------
  const montador = await prisma.user.upsert({
    where: { email: QA_EMAIL_MONTADOR },
    update: {
      nome: "[QA] Montador E2E",
      role: "MONTADOR",
      status: "ATIVO",
    },
    create: {
      email: QA_EMAIL_MONTADOR,
      nome: "[QA] Montador E2E",
      role: "MONTADOR",
      status: "ATIVO",
      senhaHash,
    },
  });

  const montadorPerfil = await prisma.montadorPerfil.upsert({
    where: { userId: montador.id },
    update: {
      ativo: true,
      verificado: true,
      bio: "Profissional QA E2E — montagem de móveis, reparos básicos",
      cidade: QA_CIDADE,
      estado: QA_ESTADO,
      atendeTodaCidade: true,
      bairros: [],
      especialidades: ["montagem", "reparos", "eletrica_basica"],
      valorACombinar: true,
      portfolioFotos: [],
    },
    create: {
      userId: montador.id,
      ativo: true,
      verificado: true,
      bio: "Profissional QA E2E — montagem de móveis, reparos básicos",
      cidade: QA_CIDADE,
      estado: QA_ESTADO,
      atendeTodaCidade: true,
      bairros: [],
      especialidades: ["montagem", "reparos", "eletrica_basica"],
      valorACombinar: true,
      portfolioFotos: [],
    },
  });

  // --------------------------------------------------------------------------
  // 3) Profissional de Casa QA (DiaristaProfile com 3 nichos)
  // --------------------------------------------------------------------------
  const diarista = await prisma.user.upsert({
    where: { email: QA_EMAIL_DIARISTA },
    update: {
      nome: "[QA] Profissional Casa E2E",
      role: "DIARISTA",
      status: "ATIVO",
    },
    create: {
      email: QA_EMAIL_DIARISTA,
      nome: "[QA] Profissional Casa E2E",
      role: "DIARISTA",
      status: "ATIVO",
      senhaHash,
    },
  });

  const diaristaPerfil = await prisma.diaristaProfile.upsert({
    where: { userId: diarista.id },
    update: {
      ativo: true,
      verificacao: "VERIFICADO",
      bio: "Profissional QA E2E — limpeza, cuidados infantis e culinária",
      cidade: QA_CIDADE,
      estado: QA_ESTADO,
      atendeTodaCidade: true,
      servicosOferecidos: ["DIARISTA", "BABA", "COZINHEIRA"],
      precoLeve: 8000,
      precoMedio: 10000,
      precoPesada: 12000,
      precoBabaHora: 5000,
      precoCozinheiraBase: 15000,
      taxaMinima: null,
      valorACombinar: false,
      cobraDeslocamento: false,
      portfolioFotos: [],
    },
    create: {
      userId: diarista.id,
      ativo: true,
      verificacao: "VERIFICADO",
      bio: "Profissional QA E2E — limpeza, cuidados infantis e culinária",
      cidade: QA_CIDADE,
      estado: QA_ESTADO,
      atendeTodaCidade: true,
      servicosOferecidos: ["DIARISTA", "BABA", "COZINHEIRA"],
      precoLeve: 8000,
      precoMedio: 10000,
      precoPesada: 12000,
      precoBabaHora: 5000,
      precoCozinheiraBase: 15000,
      taxaMinima: null,
      valorACombinar: false,
      cobraDeslocamento: false,
      portfolioFotos: [],
    },
  });

  // --------------------------------------------------------------------------
  // Validar completude do perfil profissional via helper
  // --------------------------------------------------------------------------
  const diaristaParaCompletude: DiaristaProfileForCompleteness = {
    ativo: diaristaPerfil.ativo,
    bio: diaristaPerfil.bio,
    servicosOferecidos: diaristaPerfil.servicosOferecidos,
    cidade: diaristaPerfil.cidade,
    estado: diaristaPerfil.estado,
    atendeTodaCidade: diaristaPerfil.atendeTodaCidade,
    raioAtendimentoKm: diaristaPerfil.raioAtendimentoKm,
    precoLeve: diaristaPerfil.precoLeve,
    precoMedio: diaristaPerfil.precoMedio,
    precoPesada: diaristaPerfil.precoPesada,
    precoBabaHora: diaristaPerfil.precoBabaHora as unknown as
      | number
      | string
      | null,
    precoCozinheiraBase: diaristaPerfil.precoCozinheiraBase as unknown as
      | number
      | string
      | null,
    taxaMinima: diaristaPerfil.taxaMinima as unknown as
      | number
      | string
      | null,
    valorACombinar: diaristaPerfil.valorACombinar,
    bairros: [],
    user: { nome: diarista.nome, status: diarista.status },
  };

  const completudeDiarista = getDiaristaProfileCompleteness(
    diaristaParaCompletude,
  );

  // --------------------------------------------------------------------------
  // Relatório final
  // --------------------------------------------------------------------------
  console.log("\n=== SEED QA E2E CONCLUÍDO ===");

  console.log("\nEmpregador:");
  console.log("  userId:", empregador.id);
  console.log("  email:", empregador.email);
  console.log("  region:", QA_CIDADE, "/", QA_ESTADO);
  console.log("  perfilId:", empregadorPerfil.id);
  console.log("  ativo:", empregadorPerfil.ativo);

  console.log("\nMontador:");
  console.log("  userId:", montador.id);
  console.log("  email:", montador.email);
  console.log("  cidade:", montadorPerfil.cidade, "/", montadorPerfil.estado);
  console.log("  verificado:", montadorPerfil.verificado);
  console.log("  ativo:", montadorPerfil.ativo);
  console.log("  atendeTodaCidade:", montadorPerfil.atendeTodaCidade);
  console.log("  especialidades:", montadorPerfil.especialidades);
  console.log("  valorACombinar:", montadorPerfil.valorACombinar);

  console.log("\nProfissional de Casa:");
  console.log("  userId:", diarista.id);
  console.log("  email:", diarista.email);
  console.log(
    "  cidade:",
    diaristaPerfil.cidade,
    "/",
    diaristaPerfil.estado,
  );
  console.log("  verificacao:", diaristaPerfil.verificacao);
  console.log("  ativo:", diaristaPerfil.ativo);
  console.log("  atendeTodaCidade:", diaristaPerfil.atendeTodaCidade);
  console.log("  servicos:", diaristaPerfil.servicosOferecidos);
  console.log(
    "  precos (centavos):",
    "leve=" + diaristaPerfil.precoLeve,
    "medio=" + diaristaPerfil.precoMedio,
    "pesada=" + diaristaPerfil.precoPesada,
  );
  console.log(
    "  precoBabaHora:",
    diaristaPerfil.precoBabaHora?.toString() ?? null,
  );
  console.log(
    "  precoCozinheiraBase:",
    diaristaPerfil.precoCozinheiraBase?.toString() ?? null,
  );
  console.log("  perfilCompleto:", completudeDiarista.completo);
  if (!completudeDiarista.completo) {
    console.log("  motivosIncompleto:", completudeDiarista.motivos);
  }

  console.log("\nRegião QA:", QA_CIDADE, "/", QA_ESTADO);
  console.log("Bairro de referência:", QA_BAIRRO);
  console.log("Senha QA (todos os 3 usuários):", QA_SENHA);
  console.log(
    "\nComando para rodar novamente (idempotente):",
  );
  console.log("  ALLOW_QA_SEED=true npx tsx prisma/qa-seed-e2e.ts");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end().catch(() => {});
    process.exit(1);
  });
