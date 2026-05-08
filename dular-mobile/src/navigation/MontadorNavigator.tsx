import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "@/theme";

export type MontadorStackParamList = {
  MontadorHome: undefined;
};

const Stack = createNativeStackNavigator<MontadorStackParamList>();

function MontadorHomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Área do Montador</Text>
      <Text style={styles.body}>
        A operação de montadores está em preparação.{"\n"}Em breve disponível.
      </Text>
    </View>
  );
}

export function MontadorNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MontadorHome" component={MontadorHomeScreen} />
    </Stack.Navigator>
  );
}

export default MontadorNavigator;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
