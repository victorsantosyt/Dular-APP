import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

import {
  NOTA_MINIMA,
  pedidosNoUltimoAno,
  podePedirAvaliacao,
} from "./avaliacaoDaLoja.regras";

/**
 * Pedido de nota na App Store / Google Play.
 *
 * REGRAS DAS LOJAS, NÃO PREFERÊNCIAS NOSSAS
 *
 * 1. Não pode partir de um botão. A documentação do expo-store-review é
 *    explícita: "should be called after a signature user interaction and not
 *    from a button". Por isso este módulo não exporta nada que uma tela de
 *    configurações possa chamar — só o gancho do momento de sucesso.
 *
 * 2. Não pode haver pré-pergunta. Aquele padrão de "Está gostando do app?" e
 *    mandar só quem respondeu que sim para a loja VIOLA a política do Google
 *    Play e é desencorajado pelo HIG da Apple. O filtro tem que estar no
 *    MOMENTO, não numa triagem de quem parece feliz.
 *
 * 3. O sistema decide se mostra. `requestReview()` pode não exibir nada, e a
 *    Apple ignora além de ~3 pedidos por 365 dias, em silêncio. Como ela não
 *    avisa quando ignora, o app precisa do próprio livro-caixa — é o que este
 *    módulo guarda.
 *
 * 4. NÃO DÁ PARA MEDIR. No Android a promessa resolve quando a UI foi
 *    apresentada, não quando alguém avaliou. Não existe taxa de conversão a
 *    acompanhar aqui; o sinal real é a nota da loja subindo.
 *
 * A régua de frequência mora em `avaliacaoDaLoja.regras.ts`, sem dependência de
 * React Native, para poder ser exercitada fora do app.
 */

const CHAVE_PEDIDOS = "@dular:avaliacao_loja_pedidos";
const CHAVE_SUCESSOS = "@dular:avaliacao_loja_sucessos";

async function lerPedidos(): Promise<number[]> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_PEDIDOS);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista.filter((n) => typeof n === "number") : [];
  } catch {
    // Storage indisponível ou JSON corrompido. Devolver vazio é o lado
    // conservador: no máximo o app pede uma vez a mais do que devia, nunca
    // deixa de registrar um pedido que aconteceu.
    return [];
  }
}

async function lerSucessos(): Promise<number> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_SUCESSOS);
    const n = Number(bruto);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Pede a nota na loja, se todas as condições valerem.
 *
 * Chamar SEMPRE que um serviço terminar avaliado — a função decide sozinha se
 * é hora. Ela nunca lança: uma falha aqui não pode atrapalhar o fluxo que
 * acabou de dar certo.
 *
 * @param nota a nota que a pessoa acabou de dar ao serviço, 1 a 5.
 */
export async function pedirAvaliacaoDaLoja(nota: number): Promise<void> {
  try {
    // Atalho antes de qualquer I/O: nota baixa não mexe nem no contador.
    if (!Number.isFinite(nota) || nota < NOTA_MINIMA) return;

    const sucessos = (await lerSucessos()) + 1;
    // Conta mesmo quando não se pede: é este contador que autoriza o pedido
    // futuro, e ele precisa avançar mesmo nas vezes em que a régua barra.
    await AsyncStorage.setItem(CHAVE_SUCESSOS, String(sucessos));

    const agora = Date.now();
    const pedidos = await lerPedidos();
    if (!podePedirAvaliacao({ nota, sucessos, pedidos, agora })) return;

    // Só agora consultamos a loja: `isAvailableAsync` é a checagem recomendada
    // pela documentação. `hasAction()` não serve de porteiro — ele é quase
    // sempre `true` no iOS de produção.
    const disponivel = await StoreReview.isAvailableAsync();
    if (!disponivel) return;

    // Registrar ANTES de pedir: se a chamada falhar no meio, o pior desfecho é
    // esperar 90 dias a mais. O contrário — pedir e não registrar — repetiria o
    // pedido no próximo serviço e queimaria a cota anual sem ninguém perceber.
    await AsyncStorage.setItem(
      CHAVE_PEDIDOS,
      JSON.stringify([...pedidosNoUltimoAno(pedidos, agora), agora]),
    );

    await StoreReview.requestReview();
  } catch {
    // Silencioso de propósito: isto é um extra em cima de um fluxo que já deu
    // certo. Um erro aqui não deve virar alerta para quem acabou de avaliar.
  }
}

/** Só para depuração manual em desenvolvimento. Não usar em tela. */
export async function limparHistoricoDeAvaliacao(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CHAVE_PEDIDOS, CHAVE_SUCESSOS]);
  } catch {}
}
