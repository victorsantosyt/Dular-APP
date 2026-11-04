import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { NotificacoesView } from "@/screens/shared/NotificacoesView";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

export function DiaristaNotificacoes() {
  const navigation = useNavigation<Navigation>();
  const theme = useGenderTheme("DIARISTA");

  return (
    <NotificacoesView
      theme={theme}
      onVoltar={() => navigation.goBack()}
    />
  );
}

export default DiaristaNotificacoes;
