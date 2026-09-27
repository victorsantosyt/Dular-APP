/**
 * `prisma migrate deploy` SÓ depois de confirmar que o banco é o de staging
 * (confirmar-banco.mjs: três evidências). Em qualquer falha, nada é migrado.
 *
 * Uso (em web/): node scripts/staging/migrar.mjs
 */
import { spawnSync } from "node:child_process";
import { confirmarBancoStaging } from "./confirmar-banco.mjs";

try {
  const r = await confirmarBancoStaging();
  console.log(`[staging] identidade confirmada (${r.banco}); migrando.`);
} catch (e) {
  console.error(`[staging] RECUSADO: ${e.falhaDeIdentidade ? e.message : "erro ao conferir o banco."}`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_UNPOOLED };
for (const args of [["prisma", "migrate", "deploy"], ["prisma", "migrate", "status"]]) {
  const r = spawnSync("npx", args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
