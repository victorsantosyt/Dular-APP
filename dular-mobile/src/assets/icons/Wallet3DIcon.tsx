import React from "react";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme";

export function Wallet3DIcon({ size = 92 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id="wallet" x1="14" y1="24" x2="82" y2="78" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.pink} />
        </LinearGradient>
      </Defs>
      <Rect x="14" y="28" width="68" height="46" rx="14" fill="url(#wallet)" />
      <Rect x="54" y="42" width="30" height="20" rx="10" fill={colors.primaryDark} />
      <Circle cx="65" cy="52" r="4" fill={colors.white} />
      <Circle cx="66" cy="24" r="10" fill={colors.warning} />
      <Circle cx="47" cy="20" r="8" fill={colors.warningLight} />
    </Svg>
  );
}

export default Wallet3DIcon;
