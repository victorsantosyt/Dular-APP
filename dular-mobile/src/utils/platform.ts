import { Platform, StyleSheet } from "react-native";
import { colors } from "@/theme/tokens";

export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

/**
 * Returns platform-specific value.
 * platformSelect({ ios: 16, android: 12 }) → 16 on iOS, 12 on Android
 */
export function platformSelect<T>(options: { ios: T; android: T }): T {
  return isIOS ? options.ios : options.android;
}

/**
 * Merges base styles with platform-specific overrides.
 */
export function platformStyles(base: object, ios?: object, android?: object) {
  return StyleSheet.flatten([base, isIOS ? ios : android]);
}

/**
 * Cross-platform shadow (shadow* props on iOS, elevation on Android).
 */
export const shadow = (elevation = 4) =>
  isIOS
    ? {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: elevation / 2 },
        shadowOpacity: 0.12,
        shadowRadius: elevation,
      }
    : { elevation };
