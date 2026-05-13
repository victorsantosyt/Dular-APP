import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { MontadorHome } from "@/screens/montador/MontadorHome";
import MontadorAgenda from "@/screens/montador/MontadorAgenda";
import MontadorSolicitacoes from "@/screens/montador/MontadorSolicitacoes";
import MontadorMensagens from "@/screens/montador/MontadorMensagens";
import MontadorPerfil from "@/screens/montador/MontadorPerfil";
import MontadorNotificacoes from "@/screens/montador/MontadorNotificacoes";
import MontadorDetalheSolicitacao from "@/screens/montador/MontadorDetalheSolicitacao";
import MontadorDetalheServico from "@/screens/montador/MontadorDetalheServico";
import ChatScreen from "@/screens/chat/ChatScreen";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";

export type MontadorTabParamList = {
  MontadorHome: undefined;
  MontadorAgenda: undefined;
  MontadorSolicitacoes: undefined;
  MontadorMensagens: undefined;
  MontadorPerfil: undefined;
  MontadorNotificacoes: undefined;
  MontadorDetalheSolicitacao: { servicoId: string };
  MontadorDetalheServico: { servicoId: string };
  MontadorChat: { servicoId: string };
};

const Tab = createBottomTabNavigator<MontadorTabParamList>();

export function MontadorNavigator() {
  const { pendentes } = useMontadorServicos();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <DBottomTabBar
          {...props}
          variant="montador"
          requestsBadge={pendentes.length > 0 ? pendentes.length : undefined}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="MontadorHome" component={MontadorHome} />
      <Tab.Screen name="MontadorAgenda" component={MontadorAgenda} />
      <Tab.Screen name="MontadorSolicitacoes" component={MontadorSolicitacoes} />
      <Tab.Screen name="MontadorMensagens" component={MontadorMensagens} />
      <Tab.Screen name="MontadorPerfil" component={MontadorPerfil} />
      <Tab.Screen name="MontadorNotificacoes" component={MontadorNotificacoes} />
      <Tab.Screen name="MontadorDetalheSolicitacao" component={MontadorDetalheSolicitacao} />
      <Tab.Screen name="MontadorDetalheServico" component={MontadorDetalheServico} />
      <Tab.Screen name="MontadorChat" component={ChatScreen} />
    </Tab.Navigator>
  );
}

export default MontadorNavigator;
