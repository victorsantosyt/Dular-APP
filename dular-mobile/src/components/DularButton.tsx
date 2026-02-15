import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleProp, Text, ViewStyle } from "react-native";
import { dularColors, dularRadius } from "../theme/dular";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
};

export function DularButton({ title, onPress, loading, variant = "primary", style }: Props) {
  if (variant === "ghost") {
    return (
      <Pressable
        onPress={onPress}
        disabled={loading}
        style={[
          {
            borderRadius: dularRadius.md,
            borderWidth: 1,
            borderColor: dularColors.border,
            backgroundColor: dularColors.surface,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignItems: "center",
          },
          style,
        ]}
      >
        {loading ? <ActivityIndicator color={dularColors.text} /> : <Text style={{ color: dularColors.text, fontWeight: "700" }}>{title}</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={loading} style={[{ borderRadius: dularRadius.md, overflow: "hidden" }, style]}>
      <LinearGradient colors={[dularColors.primary, dularColors.primary2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, alignItems: "center" }}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
