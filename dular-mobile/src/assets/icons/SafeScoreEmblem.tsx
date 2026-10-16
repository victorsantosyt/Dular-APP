import React, { useId } from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import type { ProfileTheme } from "@/theme/profileTheme";
import type { SafeScoreTier } from "@/api/safeScoreApi";
import type { SafeScoreEmblemState } from "@/lib/safeScorePresentation";

type Props = { theme: ProfileTheme; state: SafeScoreEmblemState; size?: number };

const SHIELD = "M69 7C85 19 105 23 121 26L118 72C116 107 97 132 69 145C41 132 22 107 20 72L17 26C36 23 54 18 69 7Z";

export function SafeScoreEmblem({ theme, state, size = 120 }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const muted = state === "unavailable";
  const light = muted ? "#D7DCE6" : theme.primaryLight;
  const main = muted ? "#939CAE" : theme.primary;
  const dark = muted ? "#596579" : theme.primaryDark;
  return (
    <Svg width={size} height={size * 1.12} viewBox="0 0 138 155" fill="none" accessible={false}>
      <Defs>
        <LinearGradient id={`${id}rim`} x1="20" y1="8" x2="115" y2="143" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFFFFF" /><Stop offset="0.25" stopColor={light} />
          <Stop offset="0.5" stopColor="#FFFFFF" /><Stop offset="1" stopColor={main} />
        </LinearGradient>
        <LinearGradient id={`${id}face`} x1="35" y1="28" x2="107" y2="119" gradientUnits="userSpaceOnUse">
          <Stop stopColor={light} /><Stop offset="0.42" stopColor={main} /><Stop offset="1" stopColor={dark} />
        </LinearGradient>
        <RadialGradient id={`${id}glass`} cx="43" cy="39" rx="83" ry="94" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFFFFF" stopOpacity="0.65" />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="71" cy="146" rx="37" ry="6" fill={dark} opacity="0.08" />
      <G transform="rotate(-5 69 78)">
      <Path d={SHIELD} transform="translate(2 3)" fill={dark} opacity="0.12" />
      <Path d={SHIELD} fill={`url(#${id}rim)`} stroke={light} strokeWidth="1.5" />
      <Path d="M69 15C84 26 101 30 113 32L111 71C109 101 92 124 69 137C46 124 29 101 27 71L25 32C41 29 57 23 69 15Z" fill={dark} opacity="0.12" />
      <Path d="M69 20C82 29 98 34 108 36L106 71C104 97 89 119 69 131C49 119 34 97 32 71L30 36C44 33 58 27 69 20Z" fill={`url(#${id}face)`} stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="1.5" />
      <Path d="M69 20C82 29 98 34 108 36L106 71C104 97 89 119 69 131C49 119 34 97 32 71L30 36C44 33 58 27 69 20Z" fill={`url(#${id}glass)`} />
      <Path d="M22 30C42 26 54 21 68 11" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <Path d="M115 39L113 74C111 103 95 126 73 139" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      {state === "verified" ? <>
        <Path d="M48 79L63 93L91 61" stroke={dark} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
        <Path d="M47 75L62 89L90 57" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      </> : state === "observation" || state === "restricted" ? <>
        <Path d="M69 51V79" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
        <Circle cx="69" cy="97" r="5.5" fill="#FFFFFF" />
      </> : state === "unavailable" ? <>
        <Path d="M55 62C55 42 86 43 86 62C86 74 69 75 69 86" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
        <Circle cx="69" cy="101" r="4.5" fill="#FFFFFF" />
      </> : <>
        <Circle cx="69" cy="62" r="12" fill="#FFFFFF" fillOpacity="0.95" />
        <Path d="M47 100C47 73 91 73 91 100C78 108 60 108 47 100Z" fill="#FFFFFF" fillOpacity="0.95" />
      </>}
      </G>
    </Svg>
  );
}

const MEDAL_COLORS: Record<SafeScoreTier, readonly [string, string]> = {
  BRONZE: ["#EFB47B", "#985126"], SILVER: ["#DDE4EE", "#73839B"],
  GOLD: ["#FFE29A", "#B3791C"], PLATINUM: ["#C7E7E5", "#477D87"],
};

export function SafeScoreMedal({ tier }: { tier: SafeScoreTier }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [light, dark] = MEDAL_COLORS[tier];
  return <Svg width={29} height={36} viewBox="0 0 32 40" fill="none" accessible={false}>
    <Defs><LinearGradient id={id} x1="3" y1="2" x2="28" y2="33" gradientUnits="userSpaceOnUse">
      <Stop stopColor={light} /><Stop offset="1" stopColor={dark} />
    </LinearGradient></Defs>
    <Path d="M7 23L4 39L12 35L16 38L20 34L28 38L25 23Z" fill={dark} />
    <Circle cx="16" cy="16" r="14" fill={`url(#${id})`} stroke={light} strokeWidth="2" />
    <Circle cx="16" cy="16" r="10.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" />
    <Path d="M16 7L18.5 13L25 13.5L20 18L21.5 24L16 20.5L10.5 24L12 18L7 13.5L13.5 13Z" fill={light} />
  </Svg>;
}
