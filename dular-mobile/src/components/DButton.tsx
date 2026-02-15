import { Pressable, Text, ActivityIndicator, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
};

export function DButton({ title, onPress, disabled, loading, variant = "primary", style }: Props) {
  const isDisabled = disabled || loading;

  const base: ViewStyle = {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  };

  const variants: Record<typeof variant, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled ? "#cbd5e1" : colors.primary,
      borderColor: isDisabled ? "#cbd5e1" : colors.primary,
    },
    secondary: {
      backgroundColor: "transparent",
      borderColor: colors.border,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
  };

  const textColor =
    variant === "primary" ? (isDisabled ? "#475569" : "#ffffff") : isDisabled ? "#94a3b8" : colors.text;

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={[base, variants[variant], style]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontWeight: "600" }}>{title}</Text>
      )}
    </Pressable>
  );
}
