import React from "react";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { colors } from "@/theme";

export function SOSIcon({ size = 76 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 76 76" fill="none">
      <Circle cx="38" cy="38" r="36" fill={colors.redSoft} />
      <Circle cx="38" cy="38" r="28" fill={colors.danger} />
      <Circle cx="38" cy="38" r="34" stroke={colors.danger} strokeOpacity="0.25" strokeWidth="4" />
      <SvgText x="38" y="44" textAnchor="middle" fontSize="18" fontWeight="900" fill={colors.white}>
        SOS
      </SvgText>
    </Svg>
  );
}

export default SOSIcon;
