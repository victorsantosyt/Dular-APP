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

type Variant = "primary" | "secondary" | "outline" | "accent" | "ghost" | "danger" | "warning";
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
  /**
   * Cor de acento opcional (identidade por gênero). Quando informada,
   * sobrescreve o `colors.primary` base nas variantes primary/secondary/outline
   * — usado p/ os perfis (rosa/verde) sem alterar o roxo padrão do empregador.
   */
  tint?: string;
  tintDark?: string;
  /**
   * Botão "chapado": cor sólida única (sem gradiente) e cantos arredondados
   * (radius.lg), igual aos botões das telas. Use nos perfis para padronizar.
   */
  flat?: boolean;
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
  tint,
  tintDark,
  flat,
}: Props) {
  const colors = useDularColors();
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 80, friction: 7 }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }).start();

  const sz = sizeMap[size];
  // Modo "flat" desativa o gradiente (cor sólida) — primary/accent caem no
  // caminho não-gradiente e ganham fundo sólido via flatStyle.
  const isGradient = (variant === "primary" || variant === "accent") && !flat;

  const containerStyle: ViewStyle = {
    minHeight: 44,
    paddingVertical: sz.paddingVertical,
    paddingHorizontal: sz.paddingHorizontal,
    borderRadius: flat ? radius.lg : radius.pill,
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
        <ActivityIndicator size="small" color={textColorFor(variant, colors, tint)} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text style={[textStyle, { color: textColorFor(variant, colors, tint) }, labelStyle]}>{label}</Text>
        </>
      )}
    </>
  );

  if (isGradient) {
    const gradient: [string, string] =
      variant === "primary"
        ? [tint ?? colors.primary, tintDark ?? tint ?? colors.primaryDark]
        : [colors.accent, colors.accentDark];
    return (
      <Animated.View style={[{ transform: [{ scale }] }, gradientShadow(variant, colors, tint), style]}>
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

  const flatVariantStyle = flatStyle(variant, colors, tint);
  // flat + primary/accent ganham a sombra de botão (igual ao gradiente).
  const flatShadow =
    flat && (variant === "primary" || variant === "accent")
      ? gradientShadow(variant, colors, tint)
      : undefined;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, flatShadow, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled || loading}
        style={[containerStyle, flatVariantStyle]}
      >
        {renderInner()}
      </Pressable>
    </Animated.View>
  );
}

function textColorFor(v: Variant, colors: ThemeColors, tint?: string): string {
  switch (v) {
    case "primary":
    case "accent":
      return colors.white;
    case "secondary":
      return tint ?? colors.primary;
    case "outline":
      return tint ?? colors.primary;
    case "ghost":
      return colors.textSecondary;
    case "danger":
      return colors.error;
    case "warning":
      return colors.white;
  }
}

function flatStyle(v: Variant, colors: ThemeColors, tint?: string): ViewStyle {
  switch (v) {
    case "primary":
      // Usado só no modo flat (sem gradiente): fundo sólido na cor de acento.
      return { backgroundColor: tint ?? colors.primary };
    case "accent":
      return { backgroundColor: colors.accent };
    case "secondary":
      return tint
        ? { borderWidth: 1, borderColor: tint, backgroundColor: "transparent" }
        : { borderWidth: 1, borderColor: colors.lavenderSoft, backgroundColor: colors.lavenderSoft };
    case "outline":
      return { borderWidth: 1.5, borderColor: tint ?? colors.primary, backgroundColor: "transparent" };
    case "ghost":
      return { backgroundColor: "transparent" };
    case "danger":
      return { borderWidth: 1.5, borderColor: colors.error, backgroundColor: "transparent" };
    case "warning":
      // Ação importante — cor de alerta âmbar (fundo cheio, texto branco).
      return { backgroundColor: colors.warning };
    default:
      return {};
  }
}

function gradientShadow(v: Variant, colors: ThemeColors, tint?: string): ViewStyle {
  const color = v === "primary" ? tint ?? colors.primary : colors.accent;
  return {
    ...shadows.primaryButton,
    shadowColor: color,
    borderRadius: radius.pill,
  };
}

const _styles = StyleSheet.create({}); // reserved for future static styles
