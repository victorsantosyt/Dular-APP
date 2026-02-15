import { ReactNode } from "react";
import { View, ViewProps } from "react-native";
import { colors, radius, shadow } from "./tokens";

type Props = ViewProps & { children: ReactNode };

export function GlassCard({ children, style, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.stroke,
          padding: 16,
        },
        shadow.soft,
        style,
      ]}
    >
      {children}
    </View>
  );
}
