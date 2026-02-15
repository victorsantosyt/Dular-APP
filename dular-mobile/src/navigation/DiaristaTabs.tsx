import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DiaristaSolicitacoes from "../screens/diarista/DiaristaSolicitacoes";
import DiaristaCarteira from "../screens/diarista/DiaristaCarteira";
import DiaristaPerfil from "../screens/diarista/DiaristaPerfil";
import DularTabBar from "./DularTabBar";
import DiaristaPerfilStack from "./DiaristaPerfilStack";
import DiaristaDetalhe from "../screens/diarista/DiaristaDetalhe";
import ReportIncident from "../screens/perfil/ReportIncident";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

type Props = { onLogout: () => void };

function DiaristaHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="DiaristaSolicitacoes" component={DiaristaSolicitacoes} />
      <HomeStack.Screen name="DiaristaDetalhe" component={DiaristaDetalhe} />
      <HomeStack.Screen name="ReportIncident" component={ReportIncident} />
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
        name="Home"
        children={() => <DiaristaHomeStack key={homeKey} />}
        listeners={{
          tabPress: () => {
            setHomeKey((k) => k + 1);
          },
        }}
        options={{ title: "Home" }}
      />
      <Tab.Screen name="Carteira" component={DiaristaCarteira} />
      <Tab.Screen
        name="Perfil"
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
