export const colors = {
  // Dular Soft Premium UI
  background: "#FBFAFF",
  surface: "#FFFFFF",

  primary: "#7B4EDB",
  primaryLight: "#A980F2",
  primaryDark: "#5F35B8",
  primaryDeep: "#111827",

  lavender: "#F3ECFF",
  lavenderSoft: "#F8F3FF",
  lavenderStrong: "#E7D8FF",

  textPrimary: "#111827",
  textSecondary: "#6B6475",
  textMuted: "#9B94A8",
  textOnPrimary: "#FFFFFF",
  textDisabled: "#C7BED7",

  border: "#EDE7F5",
  divider: "#EEE8F6",

  success: "#34C759",
  successSoft: "#E8F8ED",
  warning: "#F5A524",
  warningSoft: "#FFF5DB",
  danger: "#FF5A6E",
  dangerSoft: "#FFE8EC",
  notification: "#FF6B8A",

  overlay: "rgba(17, 24, 39, 0.35)",
  glassLight: "rgba(255, 255, 255, 0.16)",
  glassBorder: "rgba(255, 255, 255, 0.20)",
  whiteAlpha08: "rgba(255,255,255,0.08)",
  whiteAlpha20: "rgba(255,255,255,0.2)",
  whiteAlpha70: "rgba(255,255,255,0.7)",
  whiteAlpha80: "rgba(255,255,255,0.8)",
  whiteAlpha85: "rgba(255,255,255,0.85)",
  whiteAlpha90: "rgba(255,255,255,0.9)",

  // Brand accents and compatibility aliases
  white: "#FFFFFF",
  surfaceAlt: "#F8F3FF",
  cardStrong: "#F8F3FF",
  shadow: "rgba(91, 63, 163, 0.12)",

  pink: "#FF6B8A",
  pinkDark: "#EF5276",
  pinkSoft: "#FFE8EC",
  accent: "#FF6B8A",
  accentDark: "#EF5276",
  accentLight: "#FFE8EC",

  successDark: "#249A46",
  successLight: "#E8F8ED",
  warningLight: "#FFF5DB",
  dangerDark: "#D84056",
  error: "#FF5A6E",
  errorLight: "#FFE8EC",
  info: "#7B4EDB",
  infoLight: "#F3ECFF",
  purpleSoft: "#F8F3FF",
  greenSoft: "#E8F8ED",
  redSoft: "#FFE8EC",
  yellowSoft: "#FFF5DB",
  blueSoft: "#F3ECFF",

  // Legacy token names used across older screens.
  green: "#7B4EDB",
  greenDark: "#5F35B8",
  greenLight: "#F8F3FF",
  bg: "#FBFAFF",
  card: "#FFFFFF",
  ink: "#111827",
  sub: "#6B6475",
  muted: "#9B94A8",
  stroke: "#EDE7F5",
  star: "#F5A524",
  brand: "#7B4EDB",
  text: "#111827",
  surface2: "#F8F3FF",
  foreground: "#111827",
  secondary: "#F8F3FF",
  destructive: "#FF5A6E",
  mutedForeground: "#9B94A8",

  // Skeleton / shimmer loading state
  skeletonBg: "#E8E8F0",

  // Incident/alert specific colors (used in ReportIncident flow)
  incidentRed: "#E56B6F",
  incidentRedDark: "#B23B41",
  incidentRedBg: "#FDECEC",
  incidentAmber: "#F08A24",
  incidentCritical: "#7F1D1D",

  // Warning semantic shades
  warningDark: "#92400E",

  // Google brand colors (OAuth buttons — must match brand guidelines)
  googleBlue: "#4285F4",
  googleRed: "#EA4335",
  googleGreen: "#34A853",
  googleYellow: "#FBBC05",

  // Push notification accent
  pushGreen: "#1DB954",

  // Teal accent (verification/doc screens)
  teal: "#4FA38F",

  // Info palette (info banners)
  lightBlue: "#E0F2FE",
  infoTextDark: "#075985",

  // Onboarding/auth brand palette
  navyDeep: "#120A4D",
  navyMid: "#6F6A8F",
  pinkBright: "#FF3F86",
  primaryDeep2: "#4520B8",
  borderPurple: "#D8C5FF",

  // Pure black (for shadows)
  black: "#000000",

  // Neutral grays (step indicators, inactive UI)
  grayMid: "#888888",
  grayFeat: "#555555",
  grayText: "#666666",
  grayLight: "#AAAAAA",
  grayBorder: "#CCCCCC",
  grayDisabled: "#DDDDDD",

  // Onboarding / auth screens distinct palette
  onboardingBg: "#FCFAFF",
  onboardingPrimary: "#6D35E8",
  pinkSoftLight: "#FFF0F6",
  pinkBorder: "#FFD3E3",
  pinkMid: "#FF5A9B",
  lavenderSoftAlt: "#F5EFFF",
  lavenderMid: "#EFE6FF",
  lavenderDivider: "#E8E2F4",
  onboardingBorder: "#ECE4F8",
  primarySoftAlt: "#EEE7FF",
  successGreenAlt: "#39C96B",
  successSoftGreen: "#EFFFF4",
  purpleStep: "#7C5CFF",

  // Avatar skin and hair tones
  avatarSkin1: "#D99A73",
  avatarSkin2: "#B87352",
  avatarSkin3: "#E2B08A",
  avatarSkin4: "#C98962",
  avatarHair1: "#2C1634",
  avatarHair2: "#1B1021",
  avatarHair3: "#4B2E29",
  avatarHair4: "#25116D",

  dark: {
    background: "#15111F",
    surface: "#211A30",
    surfaceAlt: "#2B223D",
    textPrimary: "#FFFFFF",
    textSecondary: "#D7CFE7",
    border: "rgba(255,255,255,0.10)",
  },
} as const;
