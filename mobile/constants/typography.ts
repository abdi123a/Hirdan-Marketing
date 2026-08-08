import { Platform, type TextStyle } from 'react-native';

/**
 * Inter, resolved correctly on both platforms.
 *
 * The static Inter TTFs Google ships only keep Regular and Bold under the
 * `Inter` family name — Medium, SemiBold and ExtraBold each declare their own
 * family ("Inter SemiBold", …). So on iOS a plain `fontWeight: '600'` silently
 * falls back to Regular, which is the usual reason custom type looks wrong
 * there. iOS therefore has to name the face outright.
 *
 * Android is registered through the `expo-font` config plugin with an explicit
 * weight per file, so the platform resolves `fontWeight` natively and we keep
 * one family name.
 *
 * Always go through `font()` rather than writing `fontWeight` by hand.
 */
export type FontWeight = 400 | 500 | 600 | 700 | 800;

const IOS_FACE: Record<FontWeight, string> = {
  400: 'Inter-Regular',
  500: 'Inter-Medium',
  600: 'Inter-SemiBold',
  700: 'Inter-Bold',
  800: 'Inter-ExtraBold',
};

/** Font family + weight for a given face. Spread into a style. */
export function font(weight: FontWeight = 400): TextStyle {
  return Platform.OS === 'ios'
    ? { fontFamily: IOS_FACE[weight] }
    : { fontFamily: 'Inter', fontWeight: String(weight) as TextStyle['fontWeight'] };
}

/**
 * Lining tabular figures. Use anywhere numbers change in place — money,
 * counters, timers — so digits keep their column instead of jittering.
 */
export const tabular: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * Type scale.
 *
 * Tracking tightens as size grows (Inter is drawn for this) and line height
 * loosens as size drops, so headings stay dense and body copy stays readable.
 */
export const type = {
  /** Big money figures, onboarding statements. */
  display: {
    ...font(800),
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.1,
  },
  /** Screen titles. */
  h1: {
    ...font(700),
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  h2: {
    ...font(700),
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.45,
  },
  /** Card titles, sheet titles. */
  h3: {
    ...font(600),
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  /** Row titles, emphasised body. */
  title: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  body: {
    ...font(400),
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.05,
  },
  bodyStrong: {
    ...font(600),
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.05,
  },
  /** Secondary copy, row subtitles. */
  subtext: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  /** Form labels, chips, buttons. */
  label: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.05,
  },
  caption: {
    ...font(500),
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  /** Section eyebrows. Pair with `textTransform: 'uppercase'`. */
  overline: {
    ...font(700),
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  /** Metric values on KPI cards. */
  metric: {
    ...font(700),
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    ...tabular,
  },
  metricSm: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.5,
    ...tabular,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** The face each variant is drawn with, for resolving overrides. */
export const typeWeight: Record<TypeVariant, FontWeight> = {
  display: 800,
  h1: 700,
  h2: 700,
  h3: 600,
  title: 600,
  body: 400,
  bodyStrong: 600,
  subtext: 400,
  label: 600,
  caption: 500,
  overline: 700,
  metric: 700,
  metricSm: 700,
};

/**
 * Coerces any `fontWeight` React Native accepts onto the five faces actually
 * shipped, rounding to the nearest available one.
 *
 * Needed because iOS picks a face by *name*, so a style saying
 * `fontWeight: '700'` has to be translated into `Inter-Bold` — left alone it
 * renders as synthetically-emboldened Regular.
 */
export function toFontWeight(weight: TextStyle['fontWeight']): FontWeight | null {
  if (weight == null) return null;
  if (weight === 'normal') return 400;
  if (weight === 'bold') return 700;

  const n = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(n)) return null;

  // 300 and below read as Regular; there is no Light in the bundle.
  if (n <= 449) return 400;
  if (n <= 549) return 500;
  if (n <= 649) return 600;
  if (n <= 749) return 700;
  return 800;
}
