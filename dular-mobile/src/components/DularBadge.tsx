import { View, Text, StyleProp, ViewStyle } from "react-native";
import { dularColors, dularRadius } from "../theme/dular";

type Props = {
  text: string;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
};

export function DularBadge({ text, color, bg, style, icon }: Props) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          height: 28,
          borderRadius: dularRadius.md,
          backgroundColor: bg ?? "#EAF6F0",
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color: color ?? dularColors.success, fontWeight: "700", fontSize: 13 }}>{text}</Text>
    </View>
  );
}
