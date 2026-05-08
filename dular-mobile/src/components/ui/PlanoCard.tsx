import { StyleSheet, Text, View } from "react-native";
import { DButton } from "@/components/DButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { shadow } from "@/utils/platform";

export interface PlanoCardProps {
  nome: string;
  preco: string;
  beneficios: string[];
  atual: boolean;
  destaque: boolean;
  onSelecionar: () => void;
  carregando?: boolean;
}

export default function PlanoCard({
  nome,
  preco,
  beneficios,
  atual,
  destaque,
  onSelecionar,
  carregando = false,
}: PlanoCardProps) {
  const bg = atual
    ? colors.successSoft
    : destaque
    ? colors.lavenderSoft
    : colors.surface;

  const borderColor = atual
    ? colors.success
    : destaque
    ? colors.primary
    : colors.border;

  const borderWidth = destaque ? 2 : 1;

  return (
    <View style={[s.card, { backgroundColor: bg, borderColor, borderWidth }, shadow(2)]}>
      {/* "Mais popular" badge — top right, only if destaque and not current plan */}
      {destaque && !atual ? (
        <View style={s.badgeWrap}>
          <View style={s.badge}>
            <Text style={s.badgeText}>Mais popular</Text>
          </View>
        </View>
      ) : null}

      <Text style={s.nome}>{nome}</Text>
      <Text style={s.preco}>{preco}</Text>

      <View style={s.divider} />

      <View style={s.beneficios}>
        {beneficios.map((b) => (
          <View key={b} style={s.beneficioRow}>
            <AppIcon name="Check" size={16} color={colors.success} strokeWidth={2.5} />
            <Text style={s.beneficioText}>{b}</Text>
          </View>
        ))}
      </View>

      <View style={s.divider} />

      <DButton
        title={atual ? "Plano atual ✓" : "Assinar"}
        variant={atual ? "outline" : "primary"}
        disabled={atual}
        loading={!atual && carregando}
        onPress={onSelecionar}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  badgeWrap: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
    fontSize: 11,
  },
  nome: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  preco: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  beneficios: {
    gap: spacing.xs,
  },
  beneficioRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  beneficioText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
});
