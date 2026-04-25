import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ClienteHome from "@/screens/cliente/ClienteHome";
import ClienteMinhas from "@/screens/cliente/ClienteMinhas";
import ClienteDetalhe from "@/screens/cliente/ClienteDetalhe";
import ClientePerfil from "@/screens/cliente/ClientePerfil";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import ReportIncident from "@/screens/perfil/ReportIncident";
import DularTabBar from "@/navigation/DularTabBar";
import { CLIENTE_STACK_ROUTES, PERFIL_STACK_ROUTES, TAB_ROUTES } from "@/navigation/routes";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const SolicStack = createNativeStackNavigator();
const PerfilStack = createNativeStackNavigator();

type Props = { onLogout: () => void };

function ClienteHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name={CLIENTE_STACK_ROUTES.HOME} component={ClienteHome} />
    </HomeStack.Navigator>
  );
}

function ClienteSolicStack() {
  return (
    <SolicStack.Navigator screenOptions={{ headerShown: false }}>
      <SolicStack.Screen name={CLIENTE_STACK_ROUTES.MINHAS} component={ClienteMinhas} />
      <SolicStack.Screen name={CLIENTE_STACK_ROUTES.DETALHE} component={ClienteDetalhe} />
    </SolicStack.Navigator>
  );
}

function ClientePerfilStack({ onLogout }: Props) {
  return (
    <PerfilStack.Navigator screenOptions={{ headerShown: false }}>
      <PerfilStack.Screen name={CLIENTE_STACK_ROUTES.PERFIL} children={() => <ClientePerfil onLogout={onLogout} />} />
      <PerfilStack.Screen name={PERFIL_STACK_ROUTES.VERIFICACAO_DOCS} component={VerificacaoDocs} />
      <PerfilStack.Screen name={PERFIL_STACK_ROUTES.REPORT_INCIDENT} component={ReportIncident} />
    </PerfilStack.Navigator>
  );
}

export default function ClienteTabs({ onLogout }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBar={(props) => <DularTabBar {...props} insets={insets} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name={TAB_ROUTES.HOME} component={ClienteHomeStack} />
      <Tab.Screen name={TAB_ROUTES.SOLICITACOES} component={ClienteSolicStack} />
      <Tab.Screen name={TAB_ROUTES.PERFIL} children={() => <ClientePerfilStack onLogout={onLogout} />} />
    </Tab.Navigator>
  );
}
