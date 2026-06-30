import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { AppIcon } from "./AppIcon";
import { colors } from "@/theme";

type Props = {
  onPress: () => void;
  /** Cor do ícone. Passe theme.icon para seguir o gênero/perfil. */
  color?: string;
  /** Cor da borda. Passe theme.border para seguir o gênero/perfil. */
  borderColor?: string;
};

/**
 * BackCircleButton — botão de voltar padrão do app.
 *
 * Seta ">" (ChevronRight) dentro de um círculo com borda, alinhado à direita
 * do header. É o mesmo padrão criado na Carteira do montador e replicado em
 * todas as telas com botão de voltar nos perfis (montador/diarista/empregador),
 * mantendo a identidade visual consistente.
 */
export function BackCircleButton({ onPress, color, borderColor }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={({ pressed }) => [
        styles.btn,
        { borderColor: borderColor ?? colors.border },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name="ChevronRight" size={20} color={color ?? colors.textPrimary} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
