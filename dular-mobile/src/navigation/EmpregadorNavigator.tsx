import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import EmpregadorHome from "@/screens/empregador/EmpregadorHome";
import { BuscarScreen } from "@/screens/empregador/BuscarScreen";
import { AgendamentosEmpregadorScreen } from "@/screens/empregador/AgendamentosEmpregadorScreen";
import { MensagensEmpregadorScreen } from "@/screens/empregador/MensagensEmpregadorScreen";
import { DiaristaProfileScreen } from "@/screens/empregador/DiaristaProfileScreen";
import EmpregadorPerfil from "@/screens/empregador/EmpregadorPerfil";
import EmpregadorDetalhe from "@/screens/empregador/EmpregadorDetalhe";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import { useAuth } from "@/stores/authStore";

export type EmpregadorTabParamList = {
  Home: undefined;
  Buscar: undefined;
  SolicitarServico: undefined;
  Mensagens: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DiaristaProfile: { diaristaId: string; nome: string };
  DetalheServico: { id: string };
  EmpregadorDetalhe: { servicoId: string };
  Paywall: { mensagem?: string };
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
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={EmpregadorHome} />
      <Tab.Screen name="Buscar" component={BuscarScreen} />
      <Tab.Screen name="SolicitarServico" component={AgendamentosEmpregadorScreen} />
      <Tab.Screen name="Mensagens" component={MensagensEmpregadorScreen} />
      <Tab.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
      <Tab.Screen name="ProfissionalPerfil" component={DiaristaProfileScreen} />
      <Tab.Screen name="DiaristaProfile" component={DiaristaProfileScreen} />
      <Tab.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <Tab.Screen name="EmpregadorDetalhe" component={DetalheServicoScreen} />
      <Tab.Screen name="Paywall" component={PaywallScreen} />
    </Tab.Navigator>
  );
}

export default EmpregadorNavigator;
