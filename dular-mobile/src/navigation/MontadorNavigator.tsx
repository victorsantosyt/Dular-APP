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
import CarteiraScreen from "@/screens/montador/CarteiraScreen";
import ChatScreen from "@/screens/chat/ChatScreen";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import SafeScoreScreen from "@/screens/perfil/SafeScoreScreen";
import SosFlowScreen from "@/screens/perfil/SosFlowScreen";
import ReportIncident from "@/screens/perfil/ReportIncident";
import Suporte from "@/screens/perfil/Suporte";
import Termos from "@/screens/perfil/Termos";
import Privacidade from "@/screens/perfil/Privacidade";
import AlterarSenha from "@/screens/perfil/AlterarSenha";
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
  Carteira: { from?: keyof MontadorTabParamList } | undefined;
  VerificacaoDocs: undefined;
  SafeScore: undefined;
  SosFlow: undefined;
  ReportIncident: undefined;
  Suporte: undefined;
  Termos: undefined;
  Privacidade: undefined;
  AlterarSenha: undefined;
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
      <Tab.Screen
        name="MontadorChat"
        component={ChatScreen}
        options={{ tabBarStyle: { display: "none" } }}
      />
      <Tab.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <Tab.Screen name="Carteira" component={CarteiraScreen} />
      <Tab.Screen name="SafeScore" component={SafeScoreScreen} />
      <Tab.Screen name="SosFlow" component={SosFlowScreen} />
      <Tab.Screen name="ReportIncident" component={ReportIncident} />
      <Tab.Screen name="Suporte" component={Suporte} />
      <Tab.Screen name="Termos" component={Termos} />
      <Tab.Screen name="Privacidade" component={Privacidade} />
      <Tab.Screen name="AlterarSenha" component={AlterarSenha} />
    </Tab.Navigator>
  );
}

export default MontadorNavigator;
