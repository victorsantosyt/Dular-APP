/**
 * Verificações que precisam falhar ANTES de o servidor atender qualquer
 * requisição.
 *
 * O `register` do Next roda uma vez por processo, no start, e precisa terminar
 * antes de o servidor ficar pronto — então um `throw` aqui impede a aplicação
 * de subir. É o comportamento desejado: há configuração que é pior aceitar do
 * que recusar.
 *
 * Não roda durante o build (`phase-production-build`), então uma env errada no
 * ambiente de build não quebra a compilação — quebra o servidor, que é onde
 * ela faria dano.
 */
// Importa do módulo isolado, NÃO de "@/lib/autoVerificacao": este arquivo é
// compilado também para o runtime Edge (por existir middleware), e lá o
// Prisma que aquele módulo importa faz o deploy ser recusado.
import { garantirAutoVerifyForaDeProducao } from "@/lib/autoVerificacaoGuard";

export function register(): void {
  // Auto-aprovação de KYC ligada em produção. Ver a função para o porquê de
  // derrubar o boot em vez de apenas ignorar a flag.
  garantirAutoVerifyForaDeProducao();

  // Retomada das operações Stripe que uma queda deixou no meio. SÓ no runtime
  // Node e por import DINÂMICO: o módulo puxa o Prisma, e um import estático
  // aqui levaria o Prisma ao bundle do Edge (deploy recusado). Não bloqueia o
  // boot: a varredura roda depois, em segundo plano.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    void import("@/lib/varreduraDeOperacoes")
      .then(({ iniciarVarreduraDeOperacoes }) => iniciarVarreduraDeOperacoes())
      .catch((err) => console.error("[instrumentation] varredura de operações Stripe não iniciou:", err));
  }
}
