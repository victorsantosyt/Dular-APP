import { View, StyleProp, ViewStyle } from "react-native";
import { dularColors, dularRadius } from "../theme/dular";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function DularCard({ children, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: dularColors.surface,
          borderRadius: dularRadius.lg,
          borderWidth: 1,
          borderColor: dularColors.border,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
