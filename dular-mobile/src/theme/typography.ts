import { Platform, TextStyle } from "react-native";

const systemFont = Platform.select({
  ios: "System",
  android: "Inter",
  default: "System",
});

const base = {
  fontFamily: systemFont,
} satisfies TextStyle;

export const typography = {
  fontFamily: {
    regular: systemFont,
    medium: systemFont,
    bold: systemFont,
  },

  hero: {
    ...base,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -0.7,
  } satisfies TextStyle,

  h1: {
    ...base,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  } satisfies TextStyle,

  h2: {
    ...base,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
    letterSpacing: -0.25,
  } satisfies TextStyle,

  h3: {
    ...base,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600" as const,
    letterSpacing: -0.1,
  } satisfies TextStyle,

  title: {
    ...base,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  } satisfies TextStyle,

  body: {
    ...base,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  } satisfies TextStyle,

  bodyMedium: {
    ...base,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  } satisfies TextStyle,

  bodySm: {
    ...base,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  } satisfies TextStyle,

  bodySmMedium: {
    ...base,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  } satisfies TextStyle,

  caption: {
    ...base,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  } satisfies TextStyle,

  button: {
    ...base,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600" as const,
  } satisfies TextStyle,

  buttonSm: {
    ...base,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600" as const,
  } satisfies TextStyle,

  label: {
    ...base,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
    textTransform: "uppercase" as const,
  } satisfies TextStyle,

  // Compatibility aliases for older screens.
  h4: {
    ...base,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  } satisfies TextStyle,

  bodyMd: {
    ...base,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  } satisfies TextStyle,

  sub: {
    ...base,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  } satisfies TextStyle,

  small: {
    ...base,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  } satisfies TextStyle,

  btn: {
    ...base,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600" as const,
  } satisfies TextStyle,

  tab: {
    ...base,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  } satisfies TextStyle,
} as const;
