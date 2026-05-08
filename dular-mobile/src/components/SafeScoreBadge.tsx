import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  faixa: string;
  style?: ViewStyle;
  // Optional legacy props — accepted for spread-compatibility with existing callers
  cor?: string;
  bloqueado?: boolean;
  totalServicos?: number;
  verificado?: boolean;
  tier?: string;
};

function faixaColor(faixa: string): string {
  switch (faixa) {
    case "Excelente":      return colors.success;
    case "Confiável":      return colors.primary;
    case "Em observação":  return colors.warning;
    case "Restrito":       return colors.error;
    default:               return colors.textMuted;
  }
}

function faixaBg(faixa: string): string {
  switch (faixa) {
    case "Excelente":      return colors.successSoft;
    case "Confiável":      return colors.lavender;
    case "Em observação":  return colors.warningSoft;
    case "Restrito":       return colors.dangerSoft;
    default:               return colors.surfaceAlt;
  }
}

export function SafeScoreBadge({ faixa, style }: Props) {
  const fg = faixaColor(faixa);
  const bg = faixaBg(faixa);

  return (
    <View style={[s.badge, { backgroundColor: bg, borderColor: fg }, style]}>
      <Ionicons name="shield-checkmark" size={14} color={fg} />
      <Text style={[s.label, { color: fg }]} numberOfLines={1}>
        {faixa}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    ...typography.label,
    fontWeight: "600",
  },
});
