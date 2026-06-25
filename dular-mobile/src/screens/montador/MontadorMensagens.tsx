import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { MensagensView } from "@/screens/shared/MensagensView";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

export function MontadorMensagens() {
  const navigation = useNavigation<Navigation>();
  const theme = useProfileTheme("MONTADOR");

  return (
    <MensagensView
      theme={theme}
      infoTitle="Conversas dos seus serviços"
      infoText="Converse com os clientes para combinar os detalhes do serviço."
      onOpenChat={(item) =>
        navigation.navigate("MontadorChat", {
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

export default MontadorMensagens;
