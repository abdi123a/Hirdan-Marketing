import { Easing } from 'react-native-reanimated';

/**
 * Springs use Reanimated's perceptual form: `duration` is how long the motion
 * reads as taking, `dampingRatio` of 1 settles without any overshoot.
 */
export const spring = {
  /** Entrances and state changes. Settles clean, no bounce. */
  gentle: { duration: 500, dampingRatio: 1 },
  /** Press and release feedback. */
  press: { duration: 260, dampingRatio: 1 },
  /** Repositioning something already on screen, e.g. a selection indicator. */
  move: { duration: 380, dampingRatio: 1 },
  /** Reserved for motion that should read as physical (a mark popping in). */
  bouncy: { duration: 520, dampingRatio: 0.62 },
} as const;

export const duration = {
  instant: 120,
  fast: 170,
  base: 220,
  slow: 320,
  reveal: 460,
} as const;

export const ease = {
  /** Strong ease-out: immediate response, soft landing. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Delay ladder for staggered entrances. Short enough to never feel slow. */
export const stagger = {
  logo: 40,
  headline: 110,
  subhead: 165,
  card: 160,
  step: 45,
} as const;
