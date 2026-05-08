import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ClienteHome from "@/screens/cliente/ClienteHome";
import { BuscarScreen } from "@/screens/cliente/BuscarScreen";
import { AgendamentosClienteScreen } from "@/screens/cliente/AgendamentosClienteScreen";
import { MensagensClienteScreen } from "@/screens/cliente/MensagensClienteScreen";
import { DiaristaProfileScreen } from "@/screens/cliente/DiaristaProfileScreen";
import ClientePerfil from "@/screens/cliente/ClientePerfil";
import ClienteDetalhe from "@/screens/cliente/ClienteDetalhe";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import { useAuth } from "@/stores/authStore";

export type ClienteTabParamList = {
  Home: undefined;
  Buscar: undefined;
  SolicitarServico: undefined;
  Mensagens: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DiaristaProfile: { diaristaId: string; nome: string };
  DetalheServico: { id: string };
  ClienteDetalhe: { servicoId: string };
  Paywall: { mensagem?: string };
};

const Tab = createBottomTabNavigator<ClienteTabParamList>();

function PerfilScreen() {
  const clearSession = useAuth((state) => state.clearSession);
  return <ClientePerfil onLogout={() => { void clearSession(); }} />;
}

function DetalheServicoScreen(props: any) {
  return <ClienteDetalhe {...props} />;
}

export function ClienteNavigator() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={ClienteHome} />
      <Tab.Screen name="Buscar" component={BuscarScreen} />
      <Tab.Screen name="SolicitarServico" component={AgendamentosClienteScreen} />
      <Tab.Screen name="Mensagens" component={MensagensClienteScreen} />
      <Tab.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
      <Tab.Screen name="ProfissionalPerfil" component={DiaristaProfileScreen} />
      <Tab.Screen name="DiaristaProfile" component={DiaristaProfileScreen} />
      <Tab.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <Tab.Screen name="ClienteDetalhe" component={DetalheServicoScreen} />
      <Tab.Screen name="Paywall" component={PaywallScreen} />
    </Tab.Navigator>
  );
}

export default ClienteNavigator;
