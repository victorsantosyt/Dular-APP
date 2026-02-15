import { TextInput, TextInputProps } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

export function DInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.sm + 2,
          color: colors.text,
          backgroundColor: "#fff",
        },
        props.style,
      ]}
    />
  );
}
