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
  /** Sheets and drawers: fast out of the gate, no wobble at the end. */
  sheet: { duration: 420, dampingRatio: 0.92 },
  /** Snapping back after a drag that did not cross its threshold. */
  snap: { duration: 300, dampingRatio: 0.88 },
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
  /** For things leaving the screen — accelerate away. */
  in: Easing.bezier(0.55, 0, 1, 0.45),
};

/** Delay ladder for staggered entrances. Short enough to never feel slow. */
export const stagger = {
  logo: 40,
  headline: 110,
  subhead: 165,
  card: 160,
  step: 45,
  /** Per-item delay when a list animates in. */
  list: 38,
} as const;

/**
 * Items past this index enter with no delay. Without a cap, a long list makes
 * the last rows arrive seconds late — the stagger should decorate the first
 * screenful, not gate the content behind it.
 */
export const STAGGER_CAP = 8;

/** Delay for the nth item in a staggered list, capped. */
export function stepDelay(index: number, step: number = stagger.list) {
  return Math.min(index, STAGGER_CAP) * step;
}

/** How far content travels on entrance. Small — this should read as a settle. */
export const travel = {
  sm: 8,
  md: 16,
  lg: 28,
} as const;

/** Scale a surface drops to while pressed. */
export const pressScale = {
  /** Large targets: cards, list rows. */
  card: 0.977,
  /** Buttons and chips. */
  control: 0.955,
  /** Small icon buttons, where a big drop would read as a glitch. */
  icon: 0.9,
} as const;
