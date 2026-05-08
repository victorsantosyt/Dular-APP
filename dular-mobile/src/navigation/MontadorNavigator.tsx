import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MontadorHome } from "@/screens/montador/MontadorHome";

export type MontadorStackParamList = {
  MontadorHome: undefined;
};

const Stack = createNativeStackNavigator<MontadorStackParamList>();

export function MontadorNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MontadorHome" component={MontadorHome} />
    </Stack.Navigator>
  );
}

export default MontadorNavigator;
