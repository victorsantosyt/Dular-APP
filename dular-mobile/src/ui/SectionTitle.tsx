import { Text, View } from "react-native";
import { colors } from "./tokens";

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginTop: 6, marginBottom: subtitle ? 2 : 0 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}
