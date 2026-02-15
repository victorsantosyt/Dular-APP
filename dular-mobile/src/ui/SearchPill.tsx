import { Ionicons } from "@expo/vector-icons";
import { TextInput, View, TouchableOpacity, TextInputProps } from "react-native";
import { colors, radius, shadow } from "./tokens";

type Props = TextInputProps & {
  onSubmit?: () => void;
};

export function SearchPill({ onSubmit, style, ...rest }: Props) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.stroke,
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 10,
        },
        shadow.soft,
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        {...rest}
        style={[
          {
            flex: 1,
            color: colors.ink,
            paddingVertical: 2,
            fontSize: 15,
          },
          rest.style,
        ]}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {onSubmit ? (
        <TouchableOpacity onPress={onSubmit} hitSlop={10}>
          <Ionicons name="arrow-forward" size={18} color={colors.brand} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
