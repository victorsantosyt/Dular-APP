/**
 * O que um preview da Vercel pode tocar.
 *
 * Production usa o banco real; Preview e Development usam o banco de STAGING
 * (projeto Neon separado, só dados sintéticos). Quem garante isso é a
 * configuração das variáveis na Vercel — e estas travas fazem um erro dessa
 * configuração falhar fechado, em vez de um preview ler e gravar produção.
 * Serviços externos com efeito real (push, tempo real) ficam desligados no
 * preview, salvo liberação explícita.
 *
 * `DULAR_DB_AMBIENTE=staging` existe só em Preview/Development, ao lado das
 * variáveis do banco de staging. O build do preview confere também a marca
 * gravada no próprio banco (scripts/staging/confirmar-banco.mjs).
 */

type Env = Record<string, string | undefined>;

/**
 * Banco de uma URL Postgres, sem a diferença do pooler da Neon: o host com
 * pooler só acrescenta `-pooler` ao primeiro rótulo. Mesma regra de
 * scripts/staging/confirmar-banco.mjs (build).
 */
function bancoDaUrl(bruta: string | undefined) {
  if (!bruta) return null;
  try {
    const u = new URL(bruta);
    const host = u.hostname.replace(/^([^.]+)-pooler\./, "$1.");
    return host ? { host, banco: u.pathname, usuario: u.username } : null;
  } catch {
    return null;
  }
}

export function conferirBancoDoAmbiente(env: Env = process.env): void {
  if (env.VERCEL_ENV === "preview") {
    if (env.DULAR_DB_AMBIENTE !== "staging") {
      throw new Error("Preview sem banco de staging: DULAR_DB_AMBIENTE=staging ausente.");
    }
    // A variável só diz o que o ambiente DEVERIA ser; quem decide o banco é a
    // URL. As duas conexões têm que ser do host de staging, mesmo banco e
    // mesmo usuário. As mensagens nunca levam host, usuário ou senha.
    const staging = env.DULAR_STAGING_DB_HOST?.trim();
    if (!staging) throw new Error("Preview sem DULAR_STAGING_DB_HOST.");
    const runtime = bancoDaUrl(env.DATABASE_URL);
    const direta = bancoDaUrl(env.DATABASE_URL_UNPOOLED);
    if (!runtime || runtime.host !== staging) {
      throw new Error("Preview: DATABASE_URL não é do banco de staging.");
    }
    if (!direta || direta.host !== runtime.host || direta.banco !== runtime.banco || direta.usuario !== runtime.usuario) {
      throw new Error("Preview: DATABASE_URL e DATABASE_URL_UNPOOLED não são o mesmo banco de staging.");
    }
  }
  if (env.VERCEL_ENV === "production" && env.DULAR_DB_AMBIENTE === "staging") {
    throw new Error("Produção configurada com o banco de staging.");
  }
}

/**
 * Push remoto no preview só com liberação explícita: lá só existem usuários
 * sintéticos, e um token de aparelho real registrado no staging não pode
 * receber aviso por engano.
 */
export function pushRemotoPermitido(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== "preview" || env.DULAR_PUSH_PREVIEW === "ligado";
}

/**
 * Tempo real (Ably) no preview só com liberação explícita: não há como
 * provar que a ABLY_API_KEY do Preview é de um app separado do de produção.
 * Desligado, o app cai no polling, que já é o caminho de reserva do chat.
 */
export function tempoRealPermitido(env: Env = process.env): boolean {
  return env.VERCEL_ENV !== "preview" || env.DULAR_ABLY_PREVIEW === "ligado";
}
