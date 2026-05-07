import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "@/theme";

export function Shield3DIcon({ size = 92 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id="shield3d" x1="18" y1="10" x2="76" y2="86" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.pink} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Path d="M48 8L78 20V43C78 62 66.5 78.5 48 88C29.5 78.5 18 62 18 43V20L48 8Z" fill="url(#shield3d)" />
      <Path d="M34 48L44 58L64 36" stroke={colors.white} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default Shield3DIcon;
