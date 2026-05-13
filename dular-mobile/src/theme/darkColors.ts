/**
 * Paleta dark mode — espelha 1:1 as chaves de `colors` (light).
 * Qualquer chave nova adicionada em `colors.ts` precisa ser replicada aqui.
 */
export const darkColors = {
  // Dular Soft Premium UI — fundo e superfícies
  background: "#1A1035",
  surface: "#241848",

  primary: "#7C5CFF",
  primaryLight: "#A080FF",
  primaryDark: "#5F35B8",
  primaryDeep: "#0A0A14",

  lavender: "#3D2875",
  lavenderSoft: "#2D1F58",
  lavenderStrong: "#4A3280",

  textPrimary: "#F0F0F8",
  textSecondary: "#A0A0B8",
  textMuted: "#6B6B88",
  textOnPrimary: "#FFFFFF",
  textDisabled: "#5A5673",

  border: "#3D2875",
  divider: "#3D2875",

  success: "#4CAF50",
  successSoft: "#1A2E1B",
  warning: "#FF9800",
  warningSoft: "#3A2A0F",
  danger: "#F44336",
  dangerSoft: "#3A1414",
  notification: "#FF6B9A",

  overlay: "rgba(10, 6, 40, 0.6)",
  glassLight: "rgba(124, 92, 255, 0.08)",
  glassBorder: "rgba(124, 92, 255, 0.15)",
  whiteAlpha08: "rgba(255,255,255,0.08)",
  whiteAlpha20: "rgba(255,255,255,0.2)",
  whiteAlpha70: "rgba(255,255,255,0.7)",
  whiteAlpha80: "rgba(255,255,255,0.8)",
  whiteAlpha85: "rgba(255,255,255,0.85)",
  whiteAlpha90: "rgba(255,255,255,0.9)",

  // Brand accents and compatibility aliases
  white: "#FFFFFF",
  surfaceAlt: "#2D1F58",
  cardStrong: "#2D1F58",
  shadow: "rgba(0, 0, 0, 0.5)",

  pink: "#FF6B9A",
  pinkDark: "#E54F7C",
  pinkSoft: "#3A1A26",
  accent: "#FF6B9A",
  accentDark: "#E54F7C",
  accentLight: "#3A1A26",

  successDark: "#3D8B40",
  successLight: "#1A2E1B",
  warningLight: "#3A2A0F",
  dangerDark: "#C42A1F",
  error: "#F44336",
  errorLight: "#3A1414",
  info: "#7C5CFF",
  infoLight: "#2D1F58",
  purpleSoft: "#2D1F58",
  greenSoft: "#1A2E1B",
  redSoft: "#3A1414",
  yellowSoft: "#3A2A0F",
  blueSoft: "#2D1F58",

  // Legacy token names used across older screens (verde no light = primary alias)
  green: "#7C5CFF",
  greenDark: "#5F35B8",
  greenLight: "#2D1F58",
  bg: "#1A1035",
  card: "#241848",
  ink: "#F0F0F8",
  sub: "#A0A0B8",
  muted: "#6B6B88",
  stroke: "#3D2875",
  star: "#F5A524",
  brand: "#7C5CFF",
  text: "#F0F0F8",
  surface2: "#2D1F58",
  foreground: "#F0F0F8",
  secondary: "#2D1F58",
  destructive: "#F44336",
  mutedForeground: "#6B6B88",

  // Skeleton / shimmer loading state
  skeletonBg: "#2D1F58",

  // Incident/alert specific colors (used in ReportIncident flow)
  incidentRed: "#E56B6F",
  incidentRedDark: "#B23B41",
  incidentRedBg: "#3A1A1A",
  incidentAmber: "#F08A24",
  incidentCritical: "#7F1D1D",

  // Warning semantic shades
  warningDark: "#C77100",

  // Google brand colors (OAuth buttons — must match brand guidelines)
  googleBlue: "#4285F4",
  googleRed: "#EA4335",
  googleGreen: "#34A853",
  googleYellow: "#FBBC05",

  // Push notification accent
  pushGreen: "#1DB954",

  // Teal accent — Montador profile
  teal: "#4FA38F",
  tealDark: "#3D8A78",
  tealSoft: "#1A2E2A",

  // Info palette (info banners)
  lightBlue: "#1A2A3A",
  infoTextDark: "#A8D5F2",

  // Onboarding/auth brand palette
  navyDeep: "#0A0628",
  navyMid: "#3D3855",
  pinkBright: "#FF3F86",
  primaryDeep2: "#3215A8",
  borderPurple: "#4A3280",

  // Pure black (for shadows)
  black: "#000000",

  // Neutral grays (step indicators, inactive UI) — invertidos para dark
  grayMid: "#888888",
  grayFeat: "#AAAAAA",
  grayText: "#999999",
  grayLight: "#555555",
  grayBorder: "#3D2875",
  grayDisabled: "#3A3A50",

  // Onboarding / auth screens distinct palette
  onboardingBg: "#120C2E",
  onboardingPrimary: "#7C5CFF",
  pinkSoftLight: "#3A1A26",
  pinkBorder: "#5C2A40",
  pinkMid: "#FF5A9B",
  lavenderSoftAlt: "#2D1F58",
  lavenderMid: "#2D1F58",
  lavenderDivider: "#3D2875",
  onboardingBorder: "#3D2875",
  primarySoftAlt: "#2D1F58",
  successGreenAlt: "#4CAF50",
  successSoftGreen: "#1A2E1B",
  purpleStep: "#7C5CFF",

  // Avatar skin and hair tones (preservados — representam pessoas reais)
  avatarSkin1: "#D99A73",
  avatarSkin2: "#B87352",
  avatarSkin3: "#E2B08A",
  avatarSkin4: "#C98962",
  avatarHair1: "#2C1634",
  avatarHair2: "#1B1021",
  avatarHair3: "#4B2E29",
  avatarHair4: "#25116D",

  // Sub-objeto `dark` preservado para manter shape idêntico ao `colors` original
  dark: {
    background: "#15111F",
    surface: "#211A30",
    surfaceAlt: "#2B223D",
    textPrimary: "#FFFFFF",
    textSecondary: "#D7CFE7",
    border: "rgba(255,255,255,0.10)",
  },
} as const;
