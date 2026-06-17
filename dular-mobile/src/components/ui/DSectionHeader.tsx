import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, spacing } from "@/theme";

type Props = {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
  /** Cor do link de ação (identidade por gênero). Padrão: colors.primary. */
  actionColor?: string;
};

export function DSectionHeader({ title, action, onAction, style, actionColor }: Props) {
  return (
    <View style={[s.row, style]}>
      <Text style={s.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[s.action, actionColor ? { color: actionColor } : null]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
  },
  action: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
});
