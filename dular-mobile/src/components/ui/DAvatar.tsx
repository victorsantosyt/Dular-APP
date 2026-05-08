import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme";

type Size = "sm" | "md" | "lg" | "xl";

type Props = {
  size?: Size;
  uri?: string;
  initials?: string;
  online?: boolean;
};

const SIZE_MAP: Record<Size, number> = {
  sm: 36,
  md: 48,
  lg: 72,
  xl: 104,
};

const PORTRAIT_PALETTES = [
  {
    bg: [colors.lavender, colors.surface] as const,
    skin: colors.avatarSkin1,
    hair: colors.avatarHair1,
    shirt: colors.primary,
  },
  {
    bg: [colors.dangerSoft, colors.surface] as const,
    skin: colors.avatarSkin2,
    hair: colors.avatarHair2,
    shirt: colors.notification,
  },
  {
    bg: [colors.lavenderSoft, colors.surface] as const,
    skin: colors.avatarSkin3,
    hair: colors.avatarHair3,
    shirt: colors.primary,
  },
  {
    bg: [colors.lavenderSoft, colors.surface] as const,
    skin: colors.avatarSkin4,
    hair: colors.avatarHair4,
    shirt: colors.primaryLight,
  },
];

function getPortraitPalette(seed?: string) {
  const source = seed || "Dular";
  const code = source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PORTRAIT_PALETTES[code % PORTRAIT_PALETTES.length];
}

export function DAvatar({ size = "md", uri, initials, online }: Props) {
  const px = SIZE_MAP[size];
  const radiusPx = px / 2;
  const dotSize = Math.max(10, Math.round(px * 0.22));
  const portrait = getPortraitPalette(initials);

  return (
    <View style={{ width: px, height: px }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: px, height: px, borderRadius: radiusPx, backgroundColor: colors.lavenderSoft }}
        />
      ) : initials ? (
        <View
          style={[
            s.initialsFallback,
            {
              width: px,
              height: px,
              borderRadius: radiusPx,
            },
          ]}
        >
          <Text style={[s.initialsText, { fontSize: Math.max(13, Math.round(px * 0.32)) }]}>
            {initials.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      ) : (
        <LinearGradient
          colors={portrait.bg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: px,
            height: px,
            borderRadius: radiusPx,
            alignItems: "center",
            justifyContent: "flex-end",
            overflow: "hidden",
          }}
        >
          <View
            style={[
              s.hair,
              {
                width: px * 0.6,
                height: px * 0.56,
                borderRadius: px * 0.3,
                top: px * 0.12,
                backgroundColor: portrait.hair,
              },
            ]}
          />
          <View
            style={[
              s.face,
              {
                width: px * 0.42,
                height: px * 0.44,
                borderRadius: px * 0.21,
                top: px * 0.19,
                backgroundColor: portrait.skin,
              },
            ]}
          />
          <View
            style={[
              s.neck,
              {
                width: px * 0.18,
                height: px * 0.16,
                bottom: px * 0.18,
                borderRadius: px * 0.06,
                backgroundColor: portrait.skin,
              },
            ]}
          />
          <View
            style={[
              s.shirt,
              {
                width: px * 0.72,
                height: px * 0.34,
                borderTopLeftRadius: px * 0.28,
                borderTopRightRadius: px * 0.28,
                backgroundColor: portrait.shirt,
              },
            ]}
          />
        </LinearGradient>
      )}

      {online ? (
        <View
          style={[
            s.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hair: {
    position: "absolute",
    alignSelf: "center",
  },
  face: {
    position: "absolute",
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: colors.whiteAlpha70,
  },
  neck: {
    position: "absolute",
    alignSelf: "center",
  },
  shirt: {
    position: "absolute",
    bottom: -1,
    alignSelf: "center",
  },
  dot: {
    position: "absolute",
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  initialsFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initialsText: {
    color: colors.primary,
    fontWeight: "800",
    letterSpacing: 0,
  },
});
