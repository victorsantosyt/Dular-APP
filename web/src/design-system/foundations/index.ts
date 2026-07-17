/**
 * Foundations — Design Tokens
 *
 * Camada 1 de 4 do Design System.
 * Tokens brutos + camada semântica.
 *
 * Regra de ouro:
 * - Componentes NUNCA importam tokens brutos (colors.primary[500]).
 * - Componentes SEMPRE usam a camada semântica (semantic.accent) ou classes Tailwind semânticas.
 * - Se a marca mudar de lavanda para azul, altera-se apenas foundations/colors.ts.
 */

export { colors } from "./colors";
export { typography } from "./typography";
export { spacing } from "./spacing";
export { radius } from "./radius";
export { shadows } from "./shadows";
export { zIndex } from "./z-index";
export { motion } from "./motion";
export { breakpoints } from "./breakpoints";

// Camada semântica — interface oficial entre tokens e componentes
export { semantic } from "./semantic";
