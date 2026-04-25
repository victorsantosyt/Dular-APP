import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DiaristaSolicitacoes from "@/screens/diarista/DiaristaSolicitacoes";
import DiaristaCarteira from "@/screens/diarista/DiaristaCarteira";
import DularTabBar from "@/navigation/DularTabBar";
import DiaristaPerfilStack from "@/navigation/DiaristaPerfilStack";
import DiaristaDetalhe from "@/screens/diarista/DiaristaDetalhe";
import ReportIncident from "@/screens/perfil/ReportIncident";
import { DIARISTA_STACK_ROUTES, PERFIL_STACK_ROUTES, TAB_ROUTES } from "@/navigation/routes";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

type Props = { onLogout: () => void };

function DiaristaHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name={DIARISTA_STACK_ROUTES.SOLICITACOES} component={DiaristaSolicitacoes} />
      <HomeStack.Screen name={DIARISTA_STACK_ROUTES.DETALHE} component={DiaristaDetalhe} />
      <HomeStack.Screen name={PERFIL_STACK_ROUTES.REPORT_INCIDENT} component={ReportIncident} />
    </HomeStack.Navigator>
  );
}

export default function DiaristaTabs({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [homeKey, setHomeKey] = useState(0);
  console.log("🔥🔥🔥 DIARISTA TABS RENDERIZADO 🔥🔥🔥");
  return (
    <Tab.Navigator
      tabBar={(props) => <DularTabBar {...props} insets={insets} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name={TAB_ROUTES.HOME}
        children={() => <DiaristaHomeStack key={homeKey} />}
        listeners={{
          tabPress: () => {
            setHomeKey((k) => k + 1);
          },
        }}
        options={{ title: TAB_ROUTES.HOME }}
      />
      <Tab.Screen name={TAB_ROUTES.CARTEIRA} component={DiaristaCarteira} />
      <Tab.Screen
        name={TAB_ROUTES.PERFIL}
        children={() => <DiaristaPerfilStack onLogout={onLogout} />}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
