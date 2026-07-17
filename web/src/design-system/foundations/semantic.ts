/**
 * Semantic Tokens
 * 
 * Esta é a VERDADEIRA interface entre tokens raw e componentes.
 * 
 * Se o Dular mudar de Lavanda para Azul amanhã,
 * você altera apenas este arquivo. Nenhum componente muda.
 * 
 * Regra: SEMPRE use semantic tokens em componentes, NUNCA colors direto.
 */

import { colors } from './colors';

export const semantic = {
  // Superfícies
  surface: colors.white,
  surfaceSecondary: colors.gray[50],
  surfaceSubtle: colors.gray[100],

  // Texto
  textPrimary: colors.gray[900],
  textSecondary: colors.gray[600],
  textTertiary: colors.gray[500],
  textDisabled: colors.gray[400],

  // Bordas
  border: colors.gray[200],
  borderSubtle: colors.gray[100],

  // Accent (Primary)
  accent: colors.primary[500],
  accentHover: colors.primary[600],
  accentActive: colors.primary[700],
  accentDisabled: colors.gray[300],
  accentBg: colors.primary[50],

  // Status - Success
  success: colors.success,
  successLight: colors.success_light,
  successDark: colors.success_dark,

  // Status - Warning
  warning: colors.warning,
  warningLight: colors.warning_light,
  warningDark: colors.warning_dark,

  // Status - Error
  error: colors.error,
  errorLight: colors.error_light,
  errorDark: colors.error_dark,

  // Status - Info
  info: colors.info,
  infoLight: colors.info_light,
  infoDark: colors.info_dark,

  // Backgrounds (para states)
  bgHover: colors.gray[50],
  bgActive: colors.gray[100],
  bgDisabled: colors.gray[50],

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.25)',

  // Focus ring
  focusRing: colors.primary[500],
  focusRingOffset: colors.white,
} as const;

export default semantic;
