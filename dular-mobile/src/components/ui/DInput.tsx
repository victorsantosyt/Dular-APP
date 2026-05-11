import React, { ReactNode, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "@/theme";

type Props = Omit<TextInputProps, "style"> & {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon?: ReactNode;
  error?: string;
  secureTextEntry?: boolean;
  containerStyle?: ViewStyle;
};

export function DInput({
  placeholder,
  value,
  onChangeText,
  icon,
  error,
  secureTextEntry,
  containerStyle,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.primary
    : colors.border;

  return (
    <View style={containerStyle}>
      <View style={[s.row, { borderColor }]}>
        {icon ? <View style={s.icon}>{icon}</View> : null}
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
      </View>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    marginLeft: spacing.sm,
  },
});
