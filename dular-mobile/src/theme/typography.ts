import { Platform, TextStyle } from "react-native";

const systemFont = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

export const typography = {
  fontFamily: {
    regular: systemFont,
    medium: systemFont,
    bold: systemFont,
  },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const } satisfies TextStyle,
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const } satisfies TextStyle,
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const } satisfies TextStyle,
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const } satisfies TextStyle,
  bodyMedium: { fontSize: 16, lineHeight: 22, fontWeight: "500" as const } satisfies TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const } satisfies TextStyle,
  small: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const } satisfies TextStyle,

  // Compatibility aliases for older screens.
  h4: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const } satisfies TextStyle,
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const } satisfies TextStyle,
  sub: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const } satisfies TextStyle,
  btn: { fontSize: 15, lineHeight: 20, fontWeight: "800" as const } satisfies TextStyle,
  tab: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const } satisfies TextStyle,
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 0,
    textTransform: "uppercase" as const,
  } satisfies TextStyle,
} as const;
