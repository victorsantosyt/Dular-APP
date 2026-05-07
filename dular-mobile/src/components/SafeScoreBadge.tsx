import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/theme/tokens";

type Props = {
  faixa: string;
  cor: string;
  bloqueado: boolean;
  totalServicos: number;
  verificado: boolean;
  style?: ViewStyle;
};

export function SafeScoreBadge({
  faixa,
  cor,
  bloqueado,
  totalServicos,
  verificado,
  style,
}: Props) {
  return (
    <View style={[s.wrap, bloqueado && s.wrapBlocked, style]}>
      <View style={[s.shield, { backgroundColor: cor }]}>
        <Ionicons name="shield-checkmark" size={18} color={colors.textOnPrimary} />
      </View>

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.label} numberOfLines={1}>{faixa}</Text>
          {verificado ? <Ionicons name="checkmark-circle" size={14} color={colors.green} /> : null}
        </View>
        <Text style={s.meta}>
          {totalServicos} serviço{totalServicos === 1 ? "" : "s"} concluído{totalServicos === 1 ? "" : "s"}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.card,
    padding: 10,
  },
  wrapBlocked: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  shield: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  meta: {
    marginTop: 1,
    color: colors.sub,
    fontSize: 11,
    fontWeight: "700",
  },
});
