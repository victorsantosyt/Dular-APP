/**
 * Color Tokens
 * 
 * Definição bruta das cores.
 * NÃO use estas cores diretamente em componentes.
 * Use a camada semântica (semantic.ts) em vez disso.
 */

export const colors = {
  primary: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    300: '#D8B4FE',
    400: '#C084FC',
    500: '#A78BFA',
    600: '#9370DB',
    700: '#7E22CE',
    800: '#6B21A8',
    900: '#581C87',
  },

  white: '#FFFFFF',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  success: '#10B981',
  success_light: '#D1FAE5',
  success_dark: '#047857',

  warning: '#F59E0B',
  warning_light: '#FEF3C7',
  warning_dark: '#D97706',

  error: '#EF4444',
  error_light: '#FEE2E2',
  error_dark: '#DC2626',

  info: '#3B82F6',
  info_light: '#DBEAFE',
  info_dark: '#1D4ED8',
} as const;

export default colors;
