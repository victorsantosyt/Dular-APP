import React, { ReactNode, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, shadows } from "@/theme";

type Variant = "primary" | "secondary" | "outline" | "accent" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
type ThemeColors = ReturnType<typeof useDularColors>;

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
};

const sizeMap: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 6,  paddingHorizontal: 14, fontSize: 13 },
  md: { paddingVertical: 10, paddingHorizontal: 22, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 16 },
};

export function DButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  style,
  labelStyle,
}: Props) {
  const colors = useDularColors();
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 80, friction: 7 }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }).start();

  const sz = sizeMap[size];
  const isGradient = variant === "primary" || variant === "accent";

  const containerStyle: ViewStyle = {
    minHeight: 44,
    paddingVertical: sz.paddingVertical,
    paddingHorizontal: sz.paddingHorizontal,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: disabled ? 0.5 : 1,
  };

  const textStyle: TextStyle = { fontSize: sz.fontSize, fontWeight: "700" };

  const renderInner = () => (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={textColorFor(variant, colors)} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text style={[textStyle, { color: textColorFor(variant, colors) }, labelStyle]}>{label}</Text>
        </>
      )}
    </>
  );

  if (isGradient) {
    const gradient: [string, string] =
      variant === "primary"
        ? [colors.primary, colors.primaryDark]
        : [colors.accent, colors.accentDark];
    return (
      <Animated.View style={[{ transform: [{ scale }] }, gradientShadow(variant, colors), style]}>
        <Pressable
          onPress={onPress}
          onPressIn={onIn}
          onPressOut={onOut}
          disabled={disabled || loading}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={containerStyle}
          >
            {renderInner()}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  const flat = flatStyle(variant, colors);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled || loading}
        style={[containerStyle, flat]}
      >
        {renderInner()}
      </Pressable>
    </Animated.View>
  );
}

function textColorFor(v: Variant, colors: ThemeColors): string {
  switch (v) {
    case "primary":
    case "accent":
      return colors.white;
    case "secondary":
      return colors.primary;
    case "outline":
      return colors.primary;
    case "ghost":
      return colors.textSecondary;
    case "danger":
      return colors.error;
  }
}

function flatStyle(v: Variant, colors: ThemeColors): ViewStyle {
  switch (v) {
    case "secondary":
      return { borderWidth: 1, borderColor: colors.lavenderSoft, backgroundColor: colors.lavenderSoft };
    case "outline":
      return { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "transparent" };
    case "ghost":
      return { backgroundColor: "transparent" };
    case "danger":
      return { borderWidth: 1.5, borderColor: colors.error, backgroundColor: "transparent" };
    default:
      return {};
  }
}

function gradientShadow(v: Variant, colors: ThemeColors): ViewStyle {
  const color = v === "primary" ? colors.primary : colors.accent;
  return {
    ...shadows.primaryButton,
    shadowColor: color,
    borderRadius: radius.pill,
  };
}

const _styles = StyleSheet.create({}); // reserved for future static styles
