/**
 * Z-Index Tokens (Depth Hierarchy)
 */

export const zIndex = {
  auto: 'auto',
  base: 0,
  sticky: 10,
  fixed: 10,
  dropdown: 20,
  popover: 30,
  tooltip: 40,
  modal_backdrop: 40,
  modal: 50,
  notification: 60,
  debug: 999,
} as const;

export default zIndex;
