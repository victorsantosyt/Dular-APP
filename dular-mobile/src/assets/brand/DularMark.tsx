import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "@/theme";

type Props = {
  size?: number;
  variant?: "color" | "white" | "purple";
};

export function DularMark({ size = 44, variant = "color" }: Props) {
  const isWhite = variant === "white";
  const isPurple = variant === "purple";
  const fill = isWhite ? colors.white : isPurple ? colors.primary : "url(#dularMarkGradient)";
  const heart = isWhite ? colors.primary : colors.white;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="dularMarkGradient" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.pink} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Path
        d="M11 29.4C11 26.9 12.1 24.6 14.1 23L27.1 12.3C30 9.9 34 9.9 36.9 12.3L49.9 23C51.9 24.6 53 26.9 53 29.4V47C53 51.4 49.4 55 45 55H19C14.6 55 11 51.4 11 47V29.4Z"
        fill={fill}
      />
      <Path
        d="M24.7 29.2C27 26.8 30.7 27 32 30C33.3 27 37 26.8 39.3 29.2C41.8 31.9 40.7 36.1 32 41.5C23.3 36.1 22.2 31.9 24.7 29.2Z"
        fill={heart}
      />
    </Svg>
  );
}

export default DularMark;
