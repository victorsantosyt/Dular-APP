/**
 * Conferência das variáveis de ambiente do Auth.js, feita em EXECUÇÃO.
 *
 * O `!` do TypeScript (`process.env.GOOGLE_CLIENT_ID!`) não confere nada: é
 * uma afirmação para o compilador, apagada na compilação. Com a variável
 * ausente, o provider era construído com `undefined` — foi assim que o login
 * da Apple passou a mandar `client_id=undefined` para a Apple em produção.
 *
 * POR QUE ISSO É QUESTÃO DE SEGURANÇA, E NÃO SÓ DE CONFIGURAÇÃO
 *
 * CVE-2026-73421: quando a configuração do Auth.js produz erro de servidor, o
 * objeto devolvido por `auth()` deixa de ser `null` e passa a ser um objeto de
 * erro — truthy. Quem checa `if (session)` passa a aceitar toda requisição.
 * Provider incompleto e `AUTH_SECRET` ausente são dois gatilhos citados no
 * próprio advisory.
 *
 * Aqui as checagens de sessão usam `session?.user?.id` e há teste travando o
 * padrão (`auth-sessao-nunca-truthy.test.ts`), então o gatilho não vira
 * exploração. Este módulo ataca o gatilho mesmo assim: as duas defesas custam
 * pouco e falham por motivos independentes.
 *
 * A SEVERIDADE É DIFERENTE PARA CADA CASO
 *
 * - `AUTH_SECRET` ausente: LANÇA. Sem ele nenhuma sessão é verificável, e é
 *   o gatilho que o advisory nomeia. Não há operação parcial possível.
 * - Provider incompleto: NÃO é registrado, e o motivo vai para o log com o
 *   nome exato das variáveis que faltam. Derrubar tudo porque a Apple está
 *   sem chave tiraria do ar o login do Google, que funciona — e o próprio
 *   `appleClientSecret.ts` já tinha tomado essa decisão para chave malformada.
 * - NENHUM provider configurado: LANÇA. Aí não existe login nenhum, e subir
 *   assim é anunciar uma porta que não abre.
 */
import { appleClientId, appleClientSecret } from "@/lib/appleClientSecret";

export type CredenciaisProvider = { clientId: string; clientSecret: string };

function faltando(nome: string): boolean {
  return !process.env[nome]?.trim();
}

/**
 * Durante `next build` não há requisição para servir — e o Next CARREGA os
 * módulos de rota para coletar a configuração de cada uma, então qualquer
 * `throw` na carga do módulo derruba a compilação.
 *
 * `AUTH_SECRET` é variável de EXECUÇÃO: na Vercel ela não está no ambiente de
 * build. Sem esta checagem, o guarda transformava "segredo ausente no build"
 * em "não dá para publicar" — que é falhar fechado no lugar errado. Falha
 * fechado onde importa: quando o servidor sobe e vai atender alguém.
 *
 * O Next define isto em build/index.js:
 *   process.env.NEXT_PHASE = PHASE_PRODUCTION_BUILD  // 'phase-production-build'
 */
function ehBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * `AUTH_SECRET` é o que assina e verifica a sessão. Sem ele o Auth.js entra em
 * erro de configuração — o estado exato que o advisory descreve.
 *
 * Em teste não exigimos: a suíte não levanta o Auth.js, e exigir aqui obrigaria
 * toda execução de teste a carregar segredo que ela não usa.
 */
export function exigirAuthSecret(): void {
  if (process.env.NODE_ENV === "test") return;
  if (ehBuild()) return;
  if (!faltando("AUTH_SECRET") || !faltando("NEXTAUTH_SECRET")) return;

  throw new Error(
    [
      "AUTH_SECRET ausente.",
      "",
      "É a chave que assina e verifica a sessão do Auth.js. Sem ela a",
      "configuração entra em erro, e nesse estado o objeto devolvido por",
      "`auth()` deixa de ser nulo e passa a ser um objeto de erro — truthy.",
      "Qualquer checagem de sessão escrita como `if (session)` passaria a",
      "aceitar toda requisição (CVE-2026-73421).",
      "",
      "O que fazer: defina AUTH_SECRET no ambiente.",
    ].join("\n"),
  );
}

/** Credenciais do Google, ou `null` com o motivo no log. */
export function credenciaisGoogle(): CredenciaisProvider | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) return { clientId, clientSecret };

  const ausentes = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(faltando);
  console.error(
    `[auth] provider Google NÃO registrado — variáveis ausentes: ${ausentes.join(", ")}. ` +
      "O botão 'Continuar com Google' vai falhar até isso ser corrigido.",
  );
  return null;
}

/** Credenciais da Apple, ou `null` com o motivo no log. */
export function credenciaisApple(): CredenciaisProvider | null {
  const clientId = appleClientId();
  const clientSecret = appleClientSecret();
  if (clientId && clientSecret) return { clientId, clientSecret };

  // Dois caminhos válidos: o dinâmico (.p8) e o legado (JWT pré-assinado).
  const faltaDinamico = ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"].filter(faltando);
  const faltaId = !clientId ? " APPLE_CLIENT_ID (ou APPLE_ID)" : "";
  console.error(
    "[auth] provider Apple NÃO registrado." +
      (faltaId ? ` Falta:${faltaId}.` : "") +
      (faltaDinamico.length
        ? ` Para o secret dinâmico faltam: ${faltaDinamico.join(", ")};`
        : "") +
      " ou defina APPLE_SECRET (JWT pré-assinado). O botão 'Continuar com Apple'" +
      " vai falhar até isso ser corrigido.",
  );
  return null;
}

/**
 * Lança se nenhum provider ficou utilizável. Chamada por `auth-oauth.ts` na
 * carga do módulo — antes de qualquer `auth()`, porque é impossível chamar
 * `auth()` sem carregar o módulo que a constrói.
 */
export function exigirAlgumProvider(quantidade: number): void {
  if (quantidade > 0) return;
  if (ehBuild()) return;

  throw new Error(
    [
      "Nenhum provider de OAuth configurado.",
      "",
      "O app entra só por Google e Apple. Sem nenhum dos dois não há login,",
      "e o Auth.js opera em estado de erro de configuração — ver as mensagens",
      "[auth] acima para saber exatamente o que falta.",
    ].join("\n"),
  );
}
