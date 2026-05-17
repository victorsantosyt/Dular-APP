// Script de diagnóstico de QA — NÃO INSERE DADOS, só lista.
// Uso: cd web && npx tsx prisma/qa-diagnostico.ts
//
// Imprime 4 tabelas:
//   1. EMPREGADORES ATIVOS
//   2. MONTADORES COMPLETOS POR CIDADE/UF
//   3. PROFISSIONAIS DE CASA COMPLETAS POR CIDADE/UF + NICHO
//   4. REGIÕES COM MONTADOR + DIARISTA/BABA/COZINHEIRA
//
// Nenhuma operação de escrita é executada.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: datasourceUrl });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

type NichoKey = "DIARISTA" | "BABA" | "COZINHEIRA";
type RegiaoStats = {
  mont: number;
  diaristas: Record<NichoKey, number>;
};

async function main() {
  console.log("=== EMPREGADORES ATIVOS ===");
  const empregadores = await prisma.user.findMany({
    where: { role: "EMPREGADOR", status: "ATIVO" },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      createdAt: true,
    },
    take: 50,
  });
  console.table(empregadores);

  console.log("\n=== MONTADORES COMPLETOS POR CIDADE/UF ===");
  const montadores = await prisma.montadorPerfil.findMany({
    where: { ativo: true, verificado: true },
    select: {
      userId: true,
      user: { select: { nome: true, status: true } },
      cidade: true,
      estado: true,
      especialidades: true,
      atendeTodaCidade: true,
      bairros: true,
    },
  });
  console.table(
    montadores.map((m) => ({
      userId: m.userId,
      nome: m.user?.nome ?? null,
      cidade: m.cidade,
      estado: m.estado,
      especialidades: (m.especialidades ?? []).join(","),
      atendeTodaCidade: m.atendeTodaCidade,
      bairros: (m.bairros ?? []).length,
    })),
  );

  console.log(
    "\n=== PROFISSIONAIS DE CASA COMPLETAS POR CIDADE/UF + NICHO ===",
  );
  const diaristas = await prisma.diaristaProfile.findMany({
    where: { ativo: true },
    select: {
      userId: true,
      user: { select: { nome: true, status: true } },
      cidade: true,
      estado: true,
      servicosOferecidos: true,
      atendeTodaCidade: true,
      bairros: {
        select: {
          bairro: { select: { nome: true, cidade: true, uf: true } },
        },
      },
      bio: true,
      precoLeve: true,
      precoBabaHora: true,
      precoCozinheiraBase: true,
      valorACombinar: true,
    },
  });
  console.table(
    diaristas.map((d) => ({
      userId: d.userId,
      nome: d.user?.nome ?? null,
      cidade: d.cidade,
      estado: d.estado,
      servicos: (d.servicosOferecidos ?? []).join(","),
      atendeTodaCidade: d.atendeTodaCidade,
      bairros: d.bairros.length,
      temBio: Boolean(d.bio?.trim()),
      valorACombinar: d.valorACombinar,
    })),
  );

  // Agregação para sugerir região com cobertura
  console.log("\n=== REGIÕES COM MONTADOR + DIARISTA/BABA/COZINHEIRA ===");
  const porRegiao = new Map<string, RegiaoStats>();

  function ensure(key: string): RegiaoStats {
    let stats = porRegiao.get(key);
    if (!stats) {
      stats = { mont: 0, diaristas: { DIARISTA: 0, BABA: 0, COZINHEIRA: 0 } };
      porRegiao.set(key, stats);
    }
    return stats;
  }

  for (const m of montadores) {
    if (!m.cidade || !m.estado) continue;
    const k = `${m.cidade}/${m.estado}`;
    ensure(k).mont += 1;
  }

  for (const d of diaristas) {
    if (!d.cidade || !d.estado) continue;
    const k = `${d.cidade}/${d.estado}`;
    const stats = ensure(k);
    for (const s of d.servicosOferecidos ?? []) {
      const key = String(s).toUpperCase() as NichoKey;
      if (key === "DIARISTA" || key === "BABA" || key === "COZINHEIRA") {
        stats.diaristas[key] += 1;
      }
    }
  }

  console.table(
    Array.from(porRegiao.entries()).map(([k, v]) => ({
      regiao: k,
      montadores: v.mont,
      diarista: v.diaristas.DIARISTA,
      baba: v.diaristas.BABA,
      cozinheira: v.diaristas.COZINHEIRA,
    })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  });
