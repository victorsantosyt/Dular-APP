import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius } from "@/theme";

type Props = {
  total: number;
  active: number;
};

function Dot({ active }: { active: boolean }) {
  const width = useRef(new Animated.Value(active ? 20 : 7)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? 20 : 7,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, width]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width,
          backgroundColor: active ? colors.primary : colors.border,
        },
      ]}
    />
  );
}

export function PageDots({ total, active }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <Dot key={index} active={index === active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: radius.full,
  },
});
