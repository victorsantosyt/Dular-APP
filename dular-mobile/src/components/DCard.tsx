import { View, ViewProps } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

export function DCard({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.sm + 2,
          backgroundColor: colors.card,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
    />
  );
}
