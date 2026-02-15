import React from "react";
import { View, Text, ScrollView, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { dularColors } from "../theme/dular";

type Props = {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  rightAction?: React.ReactNode;
};

export function Screen({ title, children, scroll = true, contentStyle, rightAction }: Props) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: dularColors.bg }}>
      {title ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: dularColors.bg,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: dularColors.text }}>{title}</Text>
          {rightAction}
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { padding: 16, paddingBottom: 32, gap: 12 },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 16, paddingBottom: 32 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
