import { View, TextInput, StyleProp, ViewStyle, TextInputProps } from "react-native";
import { dularColors, dularRadius } from "../theme/dular";

type Props = TextInputProps & {
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function DularInput({ icon, containerStyle, style, ...rest }: Props) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          borderRadius: dularRadius.md,
          borderWidth: 1,
          borderColor: dularColors.border,
          backgroundColor: dularColors.surface,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        },
        containerStyle,
      ]}
    >
      {icon}
      <TextInput
        placeholderTextColor={dularColors.muted}
        style={[
          {
            flex: 1,
            color: dularColors.text,
            paddingVertical: 0,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
