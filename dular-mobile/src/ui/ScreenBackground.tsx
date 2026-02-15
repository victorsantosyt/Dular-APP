import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";
import { colors } from "./tokens";

export default function ScreenBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[colors.mintTop, colors.mintBottom]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}
