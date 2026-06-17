import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
      <Tab.Screen name="Novo" component={ServicosDiaristaScreen} />
      <Tab.Screen name="Mensagens" component={MensagensDiaristaScreen} />
      <Tab.Screen name="Notificacoes" component={DiaristaNotificacoes} />
      <Tab.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
      <Tab.Screen name="ProfissionalPerfil" component={ProfissionalPerfilScreen} />
      <Tab.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <Tab.Screen name="DiaristaDetalhe" component={DetalheServicoScreen} />
      <Tab.Screen name="Paywall" component={PaywallScreen} />
      <Tab.Screen name="Seguranca" component={SegurancaScreen} />
      <Tab.Screen name="Carteira" component={DiaristaCarteira} />
      <Tab.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <Tab.Screen name="SafeScore" component={SafeScoreScreen} />
      <Tab.Screen name="SosFlow" component={SosFlowScreen} />
      <Tab.Screen name="ReportIncident" component={ReportIncident} />
      <Tab.Screen name="Suporte" component={Suporte} />
      <Tab.Screen name="Termos" component={Termos} />
      <Tab.Screen name="Privacidade" component={Privacidade} />
    </Tab.Navigator>
  );
}

export default DiaristaNavigator;
