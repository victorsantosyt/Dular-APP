import { Platform, ViewStyle } from "react-native";

function platformShadow(ios: ViewStyle, android: ViewStyle): ViewStyle {
  return Platform.select({
    ios,
    android,
    default: ios,
  }) as ViewStyle;
}

export const shadows = {
  card: platformShadow(
    {
      shadowColor: "#5B3FA3",
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    { elevation: 4 },
  ),
  soft: platformShadow(
    {
      shadowColor: "#5B3FA3",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    { elevation: 2 },
  ),
  floating: platformShadow(
    {
      shadowColor: "#3B2A66",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -6 },
    },
    { elevation: 10 },
  ),
  primaryButton: platformShadow(
    {
      shadowColor: "#7B4EDB",
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    { elevation: 8 },
  ),

  // Compatibility aliases.
  medium: platformShadow(
    {
      shadowColor: "#5B3FA3",
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    { elevation: 4 },
  ),
  strong: platformShadow(
    {
      shadowColor: "#7B4EDB",
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    { elevation: 8 },
  ),
} as const;
