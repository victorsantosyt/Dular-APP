import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { DiaristaHomeScreen } from "@/screens/diarista/DiaristaHomeScreen";
import { AgendamentosDiaristaScreen } from "@/screens/diarista/AgendamentosDiaristaScreen";
import { ServicosDiaristaScreen } from "@/screens/diarista/ServicosDiaristaScreen";
import { MensagensDiaristaScreen } from "@/screens/diarista/MensagensDiaristaScreen";
import DiaristaNotificacoes from "@/screens/diarista/DiaristaNotificacoes";
import DiaristaPerfil from "@/screens/diarista/DiaristaPerfil";
import DiaristaDetalhe from "@/screens/diarista/DiaristaDetalhe";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import SegurancaScreen from "@/screens/diarista/SegurancaScreen";
import DiaristaCarteira from "@/screens/diarista/DiaristaCarteira";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import SafeScoreScreen from "@/screens/perfil/SafeScoreScreen";
import SosFlowScreen from "@/screens/perfil/SosFlowScreen";
import ReportIncident from "@/screens/perfil/ReportIncident";
import Suporte from "@/screens/perfil/Suporte";
import Termos from "@/screens/perfil/Termos";
import Privacidade from "@/screens/perfil/Privacidade";
import { useAuth } from "@/stores/authStore";

export type DiaristaTabParamList = {
  // Container das abas reais (Home/Agendamentos/Novo/Mensagens/Perfil).
  DiaristaTabs: undefined;
  Home: undefined;
  Agendamentos: undefined;
  Novo: undefined;
  Mensagens: undefined;
  Notificacoes: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DetalheServico: { id: string };
  DiaristaDetalhe: { servicoId: string };
  Paywall: { mensagem?: string };
  Seguranca: { servicoId: string; enderecoServico?: string };
  Carteira: { from?: keyof DiaristaTabParamList } | undefined;
  VerificacaoDocs: undefined;
  SafeScore: undefined;
  SosFlow: undefined;
  ReportIncident: undefined;
  Suporte: undefined;
  Termos: undefined;
  Privacidade: undefined;
};

const Tab = createBottomTabNavigator<DiaristaTabParamList>();
const RootStack = createNativeStackNavigator<DiaristaTabParamList>();

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

// Abas reais (5). A bottom bar só existe aqui dentro.
function DiaristaTabs() {
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
      <Tab.Screen name="Novo" component={ServicosDiaristaScreen} />
      <Tab.Screen name="Mensagens" component={MensagensDiaristaScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

// Stack raiz: abas + telas de detalhe/sub-tela empilhadas acima (fora da bottom
// bar). goBack() volta para a origem real.
export function DiaristaNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="DiaristaTabs" component={DiaristaTabs} />
      <RootStack.Screen name="Notificacoes" component={DiaristaNotificacoes} />
      <RootStack.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <RootStack.Screen name="ProfissionalPerfil" component={ProfissionalPerfilScreen} />
      <RootStack.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <RootStack.Screen name="DiaristaDetalhe" component={DetalheServicoScreen} />
      <RootStack.Screen name="Paywall" component={PaywallScreen} />
      <RootStack.Screen name="Seguranca" component={SegurancaScreen} />
      <RootStack.Screen name="Carteira" component={DiaristaCarteira} />
      <RootStack.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <RootStack.Screen name="SafeScore" component={SafeScoreScreen} />
      <RootStack.Screen name="SosFlow" component={SosFlowScreen} />
      <RootStack.Screen name="ReportIncident" component={ReportIncident} />
      <RootStack.Screen name="Suporte" component={Suporte} />
      <RootStack.Screen name="Termos" component={Termos} />
      <RootStack.Screen name="Privacidade" component={Privacidade} />
    </RootStack.Navigator>
  );
}

export default DiaristaNavigator;
