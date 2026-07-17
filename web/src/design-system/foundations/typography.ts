/**
 * Typography Tokens
 */

export const typography = {
  sizes: {
    display: { size: '32px', weight: 700, lineHeight: '40px', letterSpacing: '-0.02em' },
    h1: { size: '24px', weight: 700, lineHeight: '32px', letterSpacing: '-0.01em' },
    h2: { size: '20px', weight: 600, lineHeight: '28px', letterSpacing: '0em' },
    h3: { size: '16px', weight: 600, lineHeight: '24px', letterSpacing: '0em' },
    body: { size: '14px', weight: 400, lineHeight: '20px', letterSpacing: '0em' },
    body_sm: { size: '13px', weight: 400, lineHeight: '18px', letterSpacing: '0em' },
    caption: { size: '12px', weight: 500, lineHeight: '16px', letterSpacing: '0em' },
    label: { size: '11px', weight: 600, lineHeight: '16px', letterSpacing: '0.05em' },
  },

  weights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  families: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
} as const;

export default typography;
