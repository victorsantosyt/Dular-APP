import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { MensagensView } from "@/screens/shared/MensagensView";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

export function MensagensDiaristaScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useGenderTheme("DIARISTA");

  return (
    <MensagensView
      theme={theme}
      infoTitle="Conversas dos seus serviços"
      infoText="Converse com os clientes para combinar os detalhes do serviço."
      onOpenChat={(item) =>
        navigation.navigate("ChatAberto", {
          roomId: item.servicoId,
          servicoId: item.servicoId,
          nomeUsuario: item.nome,
          categoria: item.categoria,
          categoriaIcon: item.categoriaIcon,
          avatarUrl: item.avatarUrl,
        })
      }
    />
  );
}

export default MensagensDiaristaScreen;
