/**
 * Motion/Transition Tokens
 */

export const motion = {
  durations: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },

  timings: {
    linear: 'linear',
    ease_in: 'cubic-bezier(0.4, 0, 1, 1)',
    ease_out: 'cubic-bezier(0, 0, 0.2, 1)',
    ease_in_out: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export default motion;
