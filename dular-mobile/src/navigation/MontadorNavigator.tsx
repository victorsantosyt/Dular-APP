import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MontadorHome } from "@/screens/montador/MontadorHome";
import MontadorPerfil from "@/screens/montador/MontadorPerfil";

export type MontadorStackParamList = {
  MontadorHome: undefined;
  MontadorPerfil: undefined;
};

const Stack = createNativeStackNavigator<MontadorStackParamList>();

export function MontadorNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MontadorHome" component={MontadorHome} />
      <Stack.Screen name="MontadorPerfil" component={MontadorPerfil} />
    </Stack.Navigator>
  );
}

export default MontadorNavigator;
