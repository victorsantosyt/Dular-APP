/**
 * A trava de `AUTO_VERIFY_PROFILES`, isolada de propósito.
 *
 * Mora sozinha aqui, e não em `autoVerificacao.ts`, por causa de quem a
 * chama: `src/instrumentation.ts`. O Next compila o instrumentation para os
 * DOIS runtimes quando existe middleware, e o bundle do Edge não aceita
 * módulos de Node — `autoVerificacao.ts` importa o Prisma, que usa
 * `node:util/types`, e o deploy é recusado na publicação (o build passa; é a
 * validação do Edge que barra).
 *
 * Por isso este arquivo não importa NADA. Só lê `process.env`, que existe nos
 * dois runtimes. Se um dia alguém precisar de um import aqui, o lugar certo é
 * outro módulo — não este.
 */

/**
 * Recusa `AUTO_VERIFY_PROFILES=true` em produção.
 *
 * A env aprova KYC de quem editar o perfil enquanto estiver ligada. Ligada e
 * esquecida em produção, ela verifica todo mundo que passar por lá — sem
 * ninguém perceber, porque a promoção é silenciosa e o status não regride.
 *
 * "Não está declarada em ambiente nenhum" não é proteção: quem tem acesso ao
 * painel de deploy adiciona a variável em segundos. A proteção precisa estar
 * no código.
 *
 * LANÇA em vez de ignorar a flag e seguir. Subir com a flag desligada
 * silenciosamente esconderia a configuração errada — quem a ligou acharia
 * que funcionou, e ninguém iria olhar. É preferível não subir: KYC
 * comprometido em produção é pior do que indisponibilidade.
 */
export function garantirAutoVerifyForaDeProducao(): void {
  if (process.env.AUTO_VERIFY_PROFILES !== "true") return;
  if (process.env.NODE_ENV !== "production") return;

  throw new Error(
    [
      "AUTO_VERIFY_PROFILES=true com NODE_ENV=production.",
      "",
      "Essa variável aprova a verificação de identidade automaticamente e",
      "existe só para QA/E2E. Em produção, ela verificaria todo profissional",
      "que editar o perfil, sem conferência humana.",
      "",
      "O que fazer: remova AUTO_VERIFY_PROFILES do ambiente de produção.",
      "Para conta de teste com verificação, use `contaDemo`",
      "(prisma/marcar-contas-demo.ts) — ela cobre o caso sem afetar mais",
      "ninguém.",
    ].join("\n"),
  );
}
