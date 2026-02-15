import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, radius, shadow } from "./tokens";

type Props = {
  icon: ReactNode;
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function CategoryCard({ icon, label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flex: 1,
          backgroundColor: selected ? colors.cardStrong : colors.card,
          borderRadius: radius.lg,
          paddingVertical: 14,
          paddingHorizontal: 12,
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: selected ? colors.brand : colors.stroke,
        },
        shadow.soft,
      ]}
    >
      <View>{icon}</View>
      <Text
        style={{
          color: selected ? colors.brand : colors.ink,
          fontWeight: selected ? "700" : "600",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
