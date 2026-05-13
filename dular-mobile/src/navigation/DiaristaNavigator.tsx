import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { DiaristaHomeScreen } from "@/screens/diarista/DiaristaHomeScreen";
import { AgendamentosDiaristaScreen } from "@/screens/diarista/AgendamentosDiaristaScreen";
import { MensagensDiaristaScreen } from "@/screens/diarista/MensagensDiaristaScreen";
import DiaristaPerfil from "@/screens/diarista/DiaristaPerfil";
import DiaristaDetalhe from "@/screens/diarista/DiaristaDetalhe";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import SegurancaScreen from "@/screens/diarista/SegurancaScreen";
import DiaristaCarteira from "@/screens/diarista/DiaristaCarteira";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import Suporte from "@/screens/perfil/Suporte";
import { useAuth } from "@/stores/authStore";

export type DiaristaTabParamList = {
  Home: undefined;
  Agendamentos: undefined;
  Novo: undefined;
  Mensagens: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DetalheServico: { id: string };
  DiaristaDetalhe: { servicoId: string };
  Paywall: { mensagem?: string };
  Seguranca: { servicoId: string; enderecoServico?: string };
  Carteira: undefined;
  VerificacaoDocs: undefined;
  Suporte: undefined;
};

const Tab = createBottomTabNavigator<DiaristaTabParamList>();

function PerfilScreen() {
  const clearSession = useAuth((state) => state.clearSession);
  return <DiaristaPerfil onLogout={() => { void clearSession(); }} />;
}

function ProfissionalPerfilScreen() {
  const clearSession = useAuth((state) => state.clearSession);
  return <DiaristaPerfil onLogout={() => { void clearSession(); }} />;
}

function DetalheServicoScreen(props: any) {
  return <DiaristaDetalhe {...props} />;
}

export function DiaristaNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <DBottomTabBar {...props} variant="diarista" />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="Home" component={DiaristaHomeScreen} />
      <Tab.Screen name="Agendamentos" component={AgendamentosDiaristaScreen} />
      <Tab.Screen name="Novo" component={AgendamentosDiaristaScreen} />
      <Tab.Screen name="Mensagens" component={MensagensDiaristaScreen} />
      <Tab.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
      <Tab.Screen name="ProfissionalPerfil" component={ProfissionalPerfilScreen} />
      <Tab.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <Tab.Screen name="DiaristaDetalhe" component={DetalheServicoScreen} />
      <Tab.Screen name="Paywall" component={PaywallScreen} />
      <Tab.Screen name="Seguranca" component={SegurancaScreen} />
      <Tab.Screen name="Carteira" component={DiaristaCarteira} />
      <Tab.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <Tab.Screen name="Suporte" component={Suporte} />
    </Tab.Navigator>
  );
}

export default DiaristaNavigator;
