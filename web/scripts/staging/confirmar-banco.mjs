/**
 * Confere que DATABASE_URL_UNPOOLED aponta para o banco de STAGING antes de
 * qualquer migração, seed ou build de preview. Exige três evidências
 * independentes, e sai com código 1 ao menor desvio:
 *
 *   1. DULAR_DB_AMBIENTE=staging — variável que só existe em Preview/Development;
 *   2. host da conexão igual a DULAR_STAGING_DB_HOST — anotado quando o
 *      staging foi criado;
 *   3. a marca no próprio banco: COMMENT ON DATABASE ... IS 'dular-staging'.
 *
 * Primeira vez (`--marcar`): o banco só é marcado se o schema public estiver
 * VAZIO — um banco com tabelas nunca vira "staging" por este script.
 *
 * Nunca imprime usuário, senha nem a URL.
 *
 * Uso (em web/):
 *   node scripts/staging/confirmar-banco.mjs            # confere
 *   node scripts/staging/confirmar-banco.mjs --marcar   # primeira vez
 */
import pg from "pg";

export const MARCA_STAGING = "dular-staging";

function falhar(msg) {
  const e = new Error(msg);
  e.falhaDeIdentidade = true;
  throw e;
}

export async function confirmarBancoStaging({ marcar = false, env = process.env } = {}) {
  if (env.DULAR_DB_AMBIENTE !== "staging") falhar("DULAR_DB_AMBIENTE não é 'staging'.");
  const esperado = (env.DULAR_STAGING_DB_HOST ?? "").trim();
  if (!esperado) falhar("DULAR_STAGING_DB_HOST ausente.");
  const bruta = env.DATABASE_URL_UNPOOLED;
  if (!bruta) falhar("DATABASE_URL_UNPOOLED ausente.");

  let url;
  try {
    url = new URL(bruta);
  } catch {
    falhar("DATABASE_URL_UNPOOLED inválida.");
  }
  if (url.hostname !== esperado) falhar("Host da conexão diferente de DULAR_STAGING_DB_HOST.");
  if (url.hostname.includes("-pooler.")) falhar("Conexão com pooler; migrações precisam da direta.");

  const cliente = new pg.Client({ connectionString: bruta });
  await cliente.connect();
  try {
    const { rows } = await cliente.query(
      `SELECT current_database() AS banco,
              shobj_description(d.oid, 'pg_database') AS marca,
              (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tabelas
         FROM pg_database d WHERE d.datname = current_database()`,
    );
    const { banco, marca, tabelas } = rows[0];

    if (marca === MARCA_STAGING) return { banco, host: url.hostname, tabelas, marcadoAgora: false };
    if (!marcar) falhar("O banco não tem a marca de staging.");
    if (tabelas !== 0) falhar(`Banco sem marca e com ${tabelas} tabela(s) em public: recusado.`);

    await cliente.query(`COMMENT ON DATABASE "${banco.replace(/"/g, '""')}" IS '${MARCA_STAGING}'`);
    const conf = await cliente.query(
      "SELECT shobj_description(oid, 'pg_database') AS marca FROM pg_database WHERE datname = current_database()",
    );
    if (conf.rows[0].marca !== MARCA_STAGING) falhar("Não foi possível gravar a marca.");
    return { banco, host: url.hostname, tabelas, marcadoAgora: true };
  } finally {
    await cliente.end();
  }
}

const mascarar = (host) => host.replace(/^(ep-[a-z]+-[a-z]+)-[a-z0-9]+/, "$1-*****");

if (import.meta.url === `file://${process.argv[1]}`) {
  confirmarBancoStaging({ marcar: process.argv.includes("--marcar") })
    .then((r) => {
      console.log(
        `[staging] banco confirmado: ${r.banco} em ${mascarar(r.host)}` +
          ` (${r.tabelas} tabelas em public${r.marcadoAgora ? "; marca gravada agora" : ""})`,
      );
    })
    .catch((e) => {
      console.error(`[staging] RECUSADO: ${e.falhaDeIdentidade ? e.message : "erro ao conectar/conferir o banco."}`);
      process.exit(1);
    });
}
