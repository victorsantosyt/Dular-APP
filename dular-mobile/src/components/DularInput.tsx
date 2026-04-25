/**
 * DInput — Input Dular (substitui DInput + DularInput)
 *
 * Suporta:
 *   - ícone à esquerda (prop icon)
 *   - ícone à direita (prop rightIcon)
 *   - label acima
 *   - estado de erro
 */

import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = TextInputProps & {
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function DInput({
  icon,
  rightIcon,
  label,
  error,
  containerStyle,
  style,
  ...rest
}: Props) {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.box, error ? styles.boxError : undefined]}>
        {icon ? <View style={styles.iconLeft}>{icon}</View> : null}

        <TextInput
          placeholderTextColor={colors.sub}
          style={[styles.input, style]}
          {...rest}
        />

        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// Alias de compatibilidade
export const DularInput = DInput;

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    ...typography.sub,
    marginBottom: 2,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  boxError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    paddingVertical: 0,
  },
  iconLeft: {
    marginRight: 2,
  },
  iconRight: {
    marginLeft: 2,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "600",
  },
});
