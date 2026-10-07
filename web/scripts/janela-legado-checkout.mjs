/**
 * Janela de legado do checkout — roda no build de PRODUÇÃO, depois de o
 * `npm run build` terminar bem (scripts/vercel-build.sh), com o código anterior
 * ainda no ar.
 *
 * O código atual grava uma StripeOperacao em todo checkout e põe a chave dela
 * na sessão; sessão sem essa operação só vale como legado se criada numa
 * janela em que o código ANTERIOR pode ter estado no ar (lib/origemDoCheckout).
 * Quem sabe disso é este passo, não a migration: a migration roda antes do
 * build e fica aplicada mesmo se o build falhar depois.
 *
 * Pergunta à produção (`/api/health`) quem está no ar:
 *  - `checkoutComOperacao: true` → deploy comum, nada a registrar (nenhuma
 *    janela se abre a cada deploy);
 *  - outra resposta → o código anterior está no ar (primeira implantação ou
 *    volta depois de rollback): registra a janela;
 *  - sem resposta → também registra (não dá para provar quem está no ar). A
 *    janela começa na última presença do código atual, então é estreita se
 *    ele estava servindo até agora.
 * Janela: `desde` = última presença do código atual (nula se nunca houve),
 * `ate` = agora (UTC). Erro de banco derruba o build: a versão no ar continua.
 *
 * Nunca imprime usuário, senha nem a URL do banco.
 *
 * Uso (em web/): node scripts/janela-legado-checkout.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

export const MARCO_PRESENCA = "presenca_checkout_com_operacao";
const TENTATIVAS = 3;
const ESPERA_MS = 10_000;

/** Quem está no ar: "com_operacao", "anterior" ou "desconhecida". */
export async function codigoNoAr({ env = process.env, buscar = fetch } = {}) {
  const dominio = (env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
  if (!dominio) return "desconhecida";
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      const resposta = await buscar(`https://${dominio}/api/health`, {
        signal: AbortSignal.timeout(ESPERA_MS),
        headers: { "cache-control": "no-cache" },
      });
      if (!resposta.ok) continue;
      const corpo = await resposta.json().catch(() => null);
      return corpo?.checkoutComOperacao === true ? "com_operacao" : "anterior";
    } catch {
      // rede ou tempo esgotado: tenta de novo
    }
  }
  return "desconhecida";
}

export async function registrarJanelaDeLegado({
  env = process.env,
  buscar = fetch,
  conectar = (url) => new pg.Client({ connectionString: url }),
  chavePresenca = MARCO_PRESENCA,
} = {}) {
  if (env.VERCEL_ENV !== "production") return { acao: "ignorado" };
  const noAr = await codigoNoAr({ env, buscar });
  if (noAr === "com_operacao") return { acao: "nenhuma", noAr };

  const url = env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED ausente; janela de legado não registrada.");
  const cliente = conectar(url);
  await cliente.connect();
  try {
    // Datas pelo próprio banco, em UTC: o Prisma lê TIMESTAMP sem fuso como UTC.
    // Devolvidas já formatadas: o `pg` leria TIMESTAMP sem fuso como hora local.
    const { rows } = await cliente.query(
      `INSERT INTO "StripeJanelaLegado" ("id", "desde", "ate", "origem", "createdAt")
       SELECT $1, (SELECT "em" FROM "StripeMarco" WHERE "chave" = $2), now() AT TIME ZONE 'UTC', $3, now() AT TIME ZONE 'UTC'
       RETURNING to_char("desde", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "desde", to_char("ate", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "ate"`,
      [randomUUID(), chavePresenca, noAr],
    );
    return { acao: "janela_registrada", noAr, desde: rows[0].desde, ate: rows[0].ate };
  } finally {
    await cliente.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  registrarJanelaDeLegado()
    .then((r) => {
      if (r.acao === "ignorado") console.log("[janela-legado] fora de produção: nada a registrar");
      else if (r.acao === "nenhuma") console.log("[janela-legado] o código no ar já grava a operação do checkout: nenhuma janela");
      else console.log(`[janela-legado] código no ar: ${r.noAr}; janela registrada de ${r.desde ?? "(sem limite)"} até ${r.ate} (UTC)`);
    })
    .catch((err) => {
      console.error("[janela-legado] ERRO: janela não registrada; o deploy para aqui e a versão no ar continua:", err?.message ?? err);
      process.exit(1);
    });
}
