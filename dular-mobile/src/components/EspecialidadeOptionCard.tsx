import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadows, spacing, typography } from "@/theme";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Cor por gênero/perfil — aplicada quando selecionado. */
  theme: ProfileTheme;
};

/**
 * Card de seleção de especialidade do montador — estrutura ÚNICA, usada no gate
 * pós-login (MontadorEspecialidadesGateScreen) e no editor do perfil
 * (MontadorPerfil). Ícone + label + check, com cor por gênero via `theme`.
 */
export function EspecialidadeOptionCard({ label, active, onPress, disabled, theme }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.card,
        active && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
        pressed && s.pressed,
      ]}
    >
      <View style={[s.icon, { backgroundColor: theme.primarySoft }, active && { backgroundColor: theme.primary }]}>
        <AppIcon name="Wrench" size={22} color={active ? colors.white : theme.primary} strokeWidth={2.4} />
      </View>
      <View style={s.text}>
        <Text style={s.title}>{label}</Text>
      </View>
      <View style={[s.check, active && { borderColor: theme.primary, backgroundColor: theme.primary }]}>
        {active ? <AppIcon name="Check" size={16} color={colors.white} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export default EspecialidadeOptionCard;

const s = StyleSheet.create({
  pressed: { opacity: 0.72 },
  card: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.soft,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 4 },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
