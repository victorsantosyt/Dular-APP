export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,

  // Compatibility aliases for older components.
  full: 999,
  btn: 18,
  tabbar: 28,
} as const;

// Alias for spec conformance — same values, alternative name.
export const borderRadius = radius;
