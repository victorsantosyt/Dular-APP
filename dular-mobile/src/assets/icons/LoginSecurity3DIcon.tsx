import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme";

export function LoginSecurity3DIcon({ size = 180 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <Defs>
        <LinearGradient id="phone" x1="48" y1="20" x2="128" y2="150" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.white} />
          <Stop offset="1" stopColor={colors.purpleSoft} />
        </LinearGradient>
        <LinearGradient id="security" x1="92" y1="46" x2="152" y2="132" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.pink} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Rect x="50" y="20" width="74" height="136" rx="22" fill="url(#phone)" stroke={colors.primaryLight} strokeWidth="4" />
      <Circle cx="87" cy="70" r="18" fill={colors.primaryLight} />
      <Path d="M60 113C66 99 108 99 114 113" stroke={colors.primary} strokeWidth="8" strokeLinecap="round" />
      <Rect x="24" y="66" width="48" height="48" rx="16" fill={colors.primary} />
      <Path d="M38 86V80C38 74 42 70 48 70C54 70 58 74 58 80V86" stroke={colors.white} strokeWidth="5" strokeLinecap="round" />
      <Rect x="36" y="84" width="24" height="18" rx="6" fill={colors.white} />
      <Path d="M129 52L156 64V86C156 105 146 119 129 128C112 119 102 105 102 86V64L129 52Z" fill="url(#security)" />
      <Path d="M118 88L126 96L142 78" stroke={colors.white} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default LoginSecurity3DIcon;
