import React from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme";

export function Calendar3DIcon({ size = 92 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id="calendarBody" x1="18" y1="16" x2="78" y2="84" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.primaryDark} />
        </LinearGradient>
      </Defs>
      <Rect x="17" y="20" width="62" height="60" rx="16" fill="url(#calendarBody)" />
      <Rect x="17" y="20" width="62" height="18" rx="10" fill={colors.pink} />
      <Path d="M35 16V26M61 16V26" stroke={colors.white} strokeWidth="6" strokeLinecap="round" />
      <Path d="M35 56L44 65L63 45" stroke={colors.white} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default Calendar3DIcon;
