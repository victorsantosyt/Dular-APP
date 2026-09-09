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
import { garantirAutoVerifyForaDeProducao } from "@/lib/autoVerificacao";

export function register(): void {
  // Auto-aprovação de KYC ligada em produção. Ver a função para o porquê de
  // derrubar o boot em vez de apenas ignorar a flag.
  garantirAutoVerifyForaDeProducao();
}
