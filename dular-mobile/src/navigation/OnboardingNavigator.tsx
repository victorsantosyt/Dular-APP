import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SplashScreen } from "@/screens/onboarding/SplashScreen";
import { WelcomeScreen } from "@/screens/onboarding/WelcomeScreen";
import { BenefitsScreen } from "@/screens/onboarding/BenefitsScreen";
import { SecurityScreen } from "@/screens/onboarding/SecurityScreen";
import { StartScreen } from "@/screens/onboarding/StartScreen";
import { RoleSelectScreen } from "@/screens/onboarding/RoleSelectScreen";
import { GeneroSelectScreen } from "@/screens/onboarding/GeneroSelectScreen";
import { LoginScreen } from "@/screens/onboarding/LoginScreen";

export type OnboardingStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Benefits: undefined;
  Security: undefined;
  Start: undefined;
  RoleSelect: undefined;
  GeneroSelect: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

type Props = {
  initialRouteName?: keyof OnboardingStackParamList;
};

export default function OnboardingNavigator({ initialRouteName = "Splash" }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Benefits" component={BenefitsScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="Start" component={StartScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen
        name="GeneroSelect"
        component={GeneroSelectScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
