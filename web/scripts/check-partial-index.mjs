/**
 * Recusa migration que apague o índice único parcial de Subscription.
 *
 * Rodar de dentro de `web/`:
 *   node scripts/check-partial-index.mjs
 *
 * O QUE ESTE ÍNDICE FAZ
 *
 *   CREATE UNIQUE INDEX "Subscription_provider_externalId_key"
 *     ON "Subscription" ("provider", "externalId")
 *     WHERE "externalId" IS NOT NULL;
 *
 * Impede que o MESMO recibo de compra de loja (`externalId`) ative plano em
 * duas contas. Sem ele, um comprovante vira plano ilimitado para quem repassá-lo.
 *
 * POR QUE PRECISA DE UMA TRAVA
 *
 * O índice é PARCIAL (tem `WHERE`), e a sintaxe do Prisma não representa isso.
 * Como não está no schema, nada no fluxo normal o protege: quem lê só o
 * `schema.prisma` não sabe que ele existe. O Prisma em si não o remove — isso
 * foi verificado, `migrate diff` devolve vazio. O risco é humano: apagar à mão
 * ao escrever SQL cru numa migration, coisa que este projeto faz com frequência.
 *
 * O QUE ESTE SCRIPT NÃO COBRE
 *
 * Só lê os .sql do repositório. Não detecta alguém rodando DROP INDEX
 * direto no banco por psql — para isso não há trava possível no CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const INDICE = "Subscription_provider_externalId_key";
const DIR_MIGRATIONS = "prisma/migrations";

/**
 * `DROP INDEX` seguido do nome, tolerando o que o Postgres aceita no meio:
 * `CONCURRENTLY`, `IF EXISTS`, aspas, e schema qualificado (`public.`).
 */
const PADRAO = new RegExp(
  String.raw`DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(?:"?\w+"?\s*\.\s*)?"?${INDICE}"?`,
  "i",
);

function arquivosSql(dir) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivosSql(caminho));
    else if (nome.endsWith(".sql")) achados.push(caminho);
  }
  return achados;
}

const arquivos = arquivosSql(DIR_MIGRATIONS);
const culpados = [];

for (const arquivo of arquivos) {
  const linhas = readFileSync(arquivo, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    // Ignora linha comentada: um DROP dentro de comentário não executa, e
    // recusar por causa dele ensinaria a contornar a trava.
    if (linha.trim().startsWith("--")) return;
    if (PADRAO.test(linha)) culpados.push(`${arquivo}:${i + 1}: ${linha.trim()}`);
  });
}

if (culpados.length > 0) {
  console.error(`\n✖ Migration remove o índice "${INDICE}".\n`);
  culpados.forEach((c) => console.error(`  ${c}`));
  console.error(
    [
      "",
      "Esse índice impede que o mesmo recibo de compra de loja (externalId)",
      "ative plano em duas contas diferentes. Ele não está no schema.prisma",
      "porque o Prisma não representa índice parcial — ver o comentário acima",
      "de `model Subscription`.",
      "",
      "Se a remoção NÃO for intencional, apague a linha de DROP INDEX.",
      "Se FOR intencional, é decisão de arquitetura sobre uma proteção de",
      "segurança: discuta antes, não mergeie.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `✓ ${arquivos.length} migrations verificadas; nenhuma remove "${INDICE}".`,
);
