import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

import { api } from "@/lib/api";
import {
  MotivoPaywall,
  deveExibirIntro,
  podeConsultarIntro,
  type RespostaClaimIntro,
} from "@/lib/paywall";
import { useAuth } from "@/stores/authStore";

/**
 * Apresenta o Premium UMA VEZ POR CONTA, logo depois que a conta fica apta a
 * usar o app.
 *
 * Antes daqui morava um `let jaApresentouPlanos = false` de módulo, e o estado
 * era do PROCESSO, não da conta: fechar e abrir o app zerava a flag e a mesma
 * conta gratuita levava o paywall de novo, toda vez. Trocar de conta sem
 * encerrar o app dava o problema espelhado — a flag continuava ligada e a
 * conta nova não via nada.
 *
 * Agora quem decide é `POST /api/me/subscription/claim-intro`: a marca fica em
 * `User.premiumIntroShownAt`, então vale para fechar/reabrir, logout/login,
 * outro aparelho e reinstalação. O Set abaixo é só para não repetir a
 * requisição a cada volta para a Home; é por `userId`, então a troca de conta
 * volta a perguntar.
 *
 * Momento: a Home só monta depois de bootstrap, gates de cadastro (gênero,
 * dados pessoais, nichos/especialidades) e do gate de endereço — ver
 * RootNavigator. Somando `bootstrapStatus === "authenticated"`, não há como
 * reivindicar a apresentação de uma conta a meio caminho de abrir.
 *
 * O outro gatilho do paywall — cota do gratuito esgotada — é `useLimiteDePlano`
 * e não passa por aqui: ele reage ao 403 LIMIT_EXCEEDED e pode abrir a tela
 * quantas vezes a pessoa esbarrar no limite.
 *
 * Vive como hook compartilhado porque vale para os dois perfis com paywall
 * (diarista e montador). O empregador não tem plano e não usa isto.
 */
const jaConsultadas = new Set<string>();

export function useApresentarPlanos() {
  const navigation = useNavigation<any>();
  const userId = useAuth((state) => state.user?.id ?? null);
  const autenticado = useAuth((state) => state.bootstrapStatus === "authenticated");

  useEffect(() => {
    if (!podeConsultarIntro({ autenticado, userId, jaConsultadas })) return;

    const conta = userId as string;
    jaConsultadas.add(conta);
    let vivo = true;

    api
      .post<RespostaClaimIntro>("/api/me/subscription/claim-intro")
      .then((res) => {
        if (!vivo || !deveExibirIntro(res.data)) return;
        navigation.navigate("Paywall", { motivo: MotivoPaywall.FIRST_LOGIN });
      })
      .catch(() => {
        // Sem resposta do backend não houve marca — e sem marca não se decide
        // nada no cliente. Libera a conta para tentar de novo quando a Home
        // remontar: se por acaso o servidor tiver gravado antes de a conexão
        // cair, a próxima tentativa recebe `shouldShow: false` e ninguém vê a
        // tela duas vezes.
        jaConsultadas.delete(conta);
      });

    return () => {
      vivo = false;
    };
  }, [autenticado, navigation, userId]);
}
