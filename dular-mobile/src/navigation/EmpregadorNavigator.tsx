import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { AgendamentosEmpregadorScreen } from "@/screens/empregador/AgendamentosEmpregadorScreen";
import EmpregadorHome from "@/screens/empregador/EmpregadorHome";
import { BuscarScreen } from "@/screens/empregador/BuscarScreen";
import { EmpregadorServiceFlowNavigator } from "@/navigation/EmpregadorServiceFlowNavigator";
import { MensagensEmpregadorScreen } from "@/screens/empregador/MensagensEmpregadorScreen";
import { NotificacoesEmpregadorScreen } from "@/screens/empregador/NotificacoesEmpregadorScreen";
import { DiaristaProfileScreen } from "@/screens/empregador/DiaristaProfileScreen";
import MontadorPublicProfile from "@/screens/empregador/MontadorPublicProfile";
import EmpregadorPerfil from "@/screens/empregador/EmpregadorPerfil";
import EmpregadorDetalhe from "@/screens/empregador/EmpregadorDetalhe";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import AlterarSenha from "@/screens/perfil/AlterarSenha";
import Privacidade from "@/screens/perfil/Privacidade";
import ReportIncident from "@/screens/perfil/ReportIncident";
import Termos from "@/screens/perfil/Termos";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import { useAuth } from "@/stores/authStore";
import type { ServiceCategory, TipoProfissional } from "@/screens/empregador/service-flow/ServiceFlowContext";

export type EmpregadorTabParamList = {
  Home: undefined;
  Buscar: undefined;
  Agendamentos: undefined;
  /** Pode receber pré-seleção da Home / Busca / perfil público. Sem params,
   *  abre o flow no estado inicial. */
  SolicitarServico:
    | undefined
    | { categoriaInicial?: ServiceCategory; tipoInicial?: TipoProfissional; profissionalId?: string; profissionalNome?: string };
  Mensagens: undefined;
  Notificacoes: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DiaristaProfile: { diaristaId: string; nome: string };
  MontadorPublicProfile: { montadorId: string; nome?: string };
  DetalheServico: { id: string };
  EmpregadorDetalhe: { servicoId: string };
  Paywall: { mensagem?: string };
  VerificacaoDocs: undefined;
  AlterarSenha: undefined;
  ReportIncident: undefined;
  Termos: undefined;
  Privacidade: undefined;
};

const Tab = createBottomTabNavigator<EmpregadorTabParamList>();

function PerfilScreen() {
  const clearSession = useAuth((state) => state.clearSession);
  return <EmpregadorPerfil onLogout={() => { void clearSession(); }} />;
}

function DetalheServicoScreen(props: any) {
  return <EmpregadorDetalhe {...props} />;
}

export function EmpregadorNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <DBottomTabBar {...props} variant="empregador" />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="Home" component={EmpregadorHome} />
      <Tab.Screen name="Buscar" component={BuscarScreen} />
      <Tab.Screen name="Agendamentos" component={AgendamentosEmpregadorScreen} />
      <Tab.Screen name="SolicitarServico" component={EmpregadorServiceFlowNavigator} />
      <Tab.Screen name="Mensagens" component={MensagensEmpregadorScreen} />
      <Tab.Screen name="Notificacoes" component={NotificacoesEmpregadorScreen} />
      <Tab.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
      <Tab.Screen name="ProfissionalPerfil" component={DiaristaProfileScreen} />
      <Tab.Screen name="DiaristaProfile" component={DiaristaProfileScreen} />
      <Tab.Screen name="MontadorPublicProfile" component={MontadorPublicProfile} />
      <Tab.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <Tab.Screen name="EmpregadorDetalhe" component={DetalheServicoScreen} />
      <Tab.Screen name="Paywall" component={PaywallScreen} />
      <Tab.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <Tab.Screen name="AlterarSenha" component={AlterarSenha} />
      <Tab.Screen name="ReportIncident" component={ReportIncident} />
      <Tab.Screen name="Termos" component={Termos} />
      <Tab.Screen name="Privacidade" component={Privacidade} />
    </Tab.Navigator>
  );
}

export default EmpregadorNavigator;
