import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { NotificacoesView } from "@/screens/shared/NotificacoesView";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

export function MontadorNotificacoes() {
  const navigation = useNavigation<Navigation>();
  const theme = useProfileTheme("MONTADOR");

  return (
    <NotificacoesView
      theme={theme}
      onVoltar={() => navigation.goBack()}
      onOpenChat={(servicoId) => navigation.navigate("MontadorChat", { servicoId })}
      onOpenServico={(servicoId) => navigation.navigate("MontadorDetalheSolicitacao", { servicoId })}
    />
  );
}

export default MontadorNotificacoes;
