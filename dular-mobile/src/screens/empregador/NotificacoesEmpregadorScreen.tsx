import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { NotificacoesView } from "@/screens/shared/NotificacoesView";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

/**
 * Notificações do Empregador.
 *
 * Era uma tela inteira só dela (315 linhas + 254 de componentes próprios),
 * fazendo o mesmo que a do montador e a da diarista com outro vocabulário de
 * tons, outras abas e outro cartão. Duas cópias do mesmo ecrã divergem
 * sozinhas — um ajuste caía num perfil e não no outro. Agora as três dividem
 * `NotificacoesView`; aqui fica só o que é próprio deste perfil: o tema e
 * para onde cada toque leva neste navegador.
 */
export function NotificacoesEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useGenderTheme();

  return (
    <NotificacoesView
      theme={theme}
      onVoltar={() => navigation.goBack()}
    />
  );
}

export default NotificacoesEmpregadorScreen;
