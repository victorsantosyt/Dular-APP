import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme";

export function Megaphone3DIcon({ size = 92 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id="mega" x1="20" y1="22" x2="82" y2="68" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.pink} />
        </LinearGradient>
      </Defs>
      <Path d="M23 44L72 24V72L23 52V44Z" fill="url(#mega)" />
      <Rect x="12" y="40" width="22" height="18" rx="7" fill={colors.primaryDark} />
      <Path d="M31 56L42 78" stroke={colors.primaryDark} strokeWidth="9" strokeLinecap="round" />
      <Circle cx="78" cy="34" r="5" fill={colors.pinkSoft} />
      <Circle cx="82" cy="58" r="4" fill={colors.pinkSoft} />
    </Svg>
  );
}

export default Megaphone3DIcon;
