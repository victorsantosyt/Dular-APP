import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "@/theme";

export function PaperPlane3DIcon({ size = 92 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id="plane" x1="14" y1="18" x2="80" y2="76" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.pink} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Path d="M12 44L80 14C84 12 88 16 86 20L56 84C54 88 48 87 47 82L42 57L17 51C12 50 9 46 12 44Z" fill="url(#plane)" />
      <Path d="M42 57L82 18" stroke={colors.white} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
    </Svg>
  );
}

export default PaperPlane3DIcon;
