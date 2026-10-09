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
 *  - a resposta EXATA do código anterior (`{ ok: true, status: "ok", ts }`,
 *    a única forma que ela já teve) → primeira implantação ou volta depois de
 *    rollback: registra a janela;
 *  - qualquer outra coisa (sem resposta, erro, HTML, JSON de outra forma) →
 *    não dá para provar quem está no ar: NÃO abre janela e derruba o deploy
 *    (a versão no ar continua). Para publicar mesmo assim, numa emergência,
 *    JANELA_LEGADO_SAUDE_DESCONHECIDA=prosseguir publica sem janela.
 * Janela: `desde` = última presença verificada do código atual em produção
 * (nula se nunca houve). Nasce ABERTA: quem a fecha é a primeira presença
 * verificada do código atual em produção — a troca real, que pode vir horas
 * depois deste build ou nunca (lib/origemDoCheckout). Erro de banco derruba o
 * build: a versão no ar continua.
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

/** A saúde do código anterior: exatamente `{ ok: true, status: "ok", ts: "<ISO>" }`. */
function saudeDoCodigoAnterior(corpo) {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return false;
  const chaves = Object.keys(corpo).sort().join(",");
  return chaves === "ok,status,ts" && corpo.ok === true && corpo.status === "ok" && typeof corpo.ts === "string" && !Number.isNaN(Date.parse(corpo.ts));
}

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
      if (corpo?.checkoutComOperacao === true) return "com_operacao";
      if (saudeDoCodigoAnterior(corpo)) return "anterior";
      return "desconhecida";
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
  if (noAr === "desconhecida") {
    if (env.JANELA_LEGADO_SAUDE_DESCONHECIDA === "prosseguir") return { acao: "sem_janela", noAr };
    throw new Error(
      "a saúde da produção não identificou o código no ar; nenhuma janela foi aberta e o deploy para aqui " +
        "(para publicar mesmo assim, sem janela: JANELA_LEGADO_SAUDE_DESCONHECIDA=prosseguir).",
    );
  }

  const url = env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED ausente; janela de legado não registrada.");
  const cliente = conectar(url);
  await cliente.connect();
  try {
    // Datas pelo próprio banco, em UTC: o Prisma lê TIMESTAMP sem fuso como UTC.
    // Devolvidas já formatadas: o `pg` leria TIMESTAMP sem fuso como hora local.
    // Sem `ate`: a janela fica aberta até a troca real (a presença verificada).
    const { rows } = await cliente.query(
      `INSERT INTO "StripeJanelaLegado" ("id", "desde", "ate", "origem", "createdAt")
       SELECT $1, (SELECT "em" FROM "StripeMarco" WHERE "chave" = $2), NULL, $3, now() AT TIME ZONE 'UTC'
       RETURNING to_char("desde", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "desde", to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "aberta"`,
      [randomUUID(), chavePresenca, noAr],
    );
    return { acao: "janela_registrada", noAr, desde: rows[0].desde, aberta: rows[0].aberta };
  } finally {
    await cliente.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  registrarJanelaDeLegado()
    .then((r) => {
      if (r.acao === "ignorado") console.log("[janela-legado] fora de produção: nada a registrar");
      else if (r.acao === "nenhuma") console.log("[janela-legado] o código no ar já grava a operação do checkout: nenhuma janela");
      else if (r.acao === "sem_janela") console.warn("[janela-legado] AVISO: código no ar não identificado; publicado SEM janela (JANELA_LEGADO_SAUDE_DESCONHECIDA=prosseguir)");
      else console.log(`[janela-legado] código no ar: anterior; janela aberta desde ${r.desde ?? "(sem limite)"} (UTC), registrada em ${r.aberta}; fecha na primeira presença verificada do código novo em produção`);
    })
    .catch((err) => {
      console.error("[janela-legado] ERRO: janela não registrada; o deploy para aqui e a versão no ar continua:", err?.message ?? err);
      process.exit(1);
    });
}
