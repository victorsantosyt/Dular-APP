/**
 * SearchPill — Campo de busca estilo pill
 *
 * Card branco, border-radius 14px, ícone verde à esquerda,
 * sombra sutil (shadow.card).
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radius, shadow } from "@/theme/tokens";

type Props = TextInputProps & {
  onSubmit?: () => void;
};

export function SearchPill({ onSubmit, style, ...rest }: Props) {
  return (
    <View style={[styles.box, shadow.card, style as any]}>
      <Ionicons name="search" size={18} color={colors.green} />

      <TextInput
        {...rest}
        style={styles.input}
        placeholderTextColor={colors.sub}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />

      {onSubmit ? (
        <TouchableOpacity onPress={onSubmit} hitSlop={10}>
          <Ionicons name="arrow-forward-circle" size={22} color={colors.green} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    paddingVertical: 0,
  },
});
