import type { ViewStyle } from 'react-native';

/**
 * Brand tokens aligned to the Hirdan Marketing logo:
 * purple wordmark / H mark + gold circle accent on black.
 */
export const brand = {
  purple: '#5A428A',
  purpleDeep: '#3F2E60',
  purpleSoft: '#8B72C4',
  gold: '#F5B824',
  goldDeep: '#C99312',
  black: '#000000',
  ink: '#1A1428',
} as const;

/**
 * Surfaces are a ladder, not a single colour: `background` is the canvas,
 * `card` sits on it, `surfaceElevated` sits on a card, and `surfaceSunken` is
 * carved into one (inputs, wells, track backgrounds). Depth comes from that
 * ladder plus `elevation`, never from heavy borders.
 */
export const colors = {
  background: '#F6F5F9',
  foreground: brand.ink,
  card: '#FFFFFF',
  cardForeground: brand.ink,
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#F1EFF6',
  primary: brand.purple,
  primaryForeground: '#FFFFFF',
  primaryMuteBg: 'rgba(90, 66, 138, 0.10)',
  secondary: brand.gold,
  secondaryForeground: brand.ink,
  muted: '#EEECF3',
  mutedForeground: '#6E6880',
  /** Third-tier text: timestamps, helper copy. */
  subtleForeground: '#948EA6',
  accent: '#EDEAF5',
  accentForeground: brand.purple,
  destructive: '#DC2F3E',
  destructiveForeground: '#FFFFFF',
  border: '#E5E2EE',
  /** Hairlines inside a card, where the full border would be too loud. */
  borderSubtle: '#EFEDF4',
  borderStrong: '#D6D1E2',
  input: '#E5E2EE',
  ring: brand.purple,
  success: '#12A150',
  warning: '#D97706',
  info: '#2563EB',
  /** Backdrop behind sheets and dialogs. */
  scrim: 'rgba(20, 16, 32, 0.45)',
  sidebar: brand.black,
  sidebarForeground: '#F2EFF8',
  sidebarPrimary: brand.gold,
} as const;

export const darkColors = {
  background: '#000000',
  foreground: '#F4F2F8',
  card: '#14111C',
  cardForeground: '#F4F2F8',
  surfaceElevated: '#1C1826',
  surfaceSunken: '#0C0A12',
  primary: brand.gold,
  primaryForeground: brand.ink,
  primaryMuteBg: 'rgba(245, 184, 36, 0.14)',
  secondary: brand.purple,
  secondaryForeground: '#FFFFFF',
  muted: '#1A1624',
  mutedForeground: '#9992AA',
  subtleForeground: '#6F6881',
  accent: '#221D30',
  accentForeground: brand.gold,
  destructive: '#E4515E',
  destructiveForeground: '#FFFFFF',
  border: '#2A2438',
  borderSubtle: '#201B2C',
  borderStrong: '#3A3350',
  input: '#2A2438',
  ring: brand.gold,
  success: '#2CC46B',
  warning: '#F59E0B',
  info: '#5B8DEF',
  scrim: 'rgba(0, 0, 0, 0.62)',
  sidebar: '#000000',
  sidebarForeground: '#F2EFF8',
  sidebarPrimary: brand.gold,
} as const;

/**
 * Radii run larger than stock so surfaces read as soft slabs. `lg` is the
 * default for cards; `md` for controls that sit inside them.
 */
export const radius = {
  xs: 8,
  sm: 12,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  full: 9999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 44,
  /** Vertical rhythm between top-level sections on a screen. */
  section: 28,
  /** Standard horizontal page gutter. */
  gutter: 20,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  hero: 32,
} as const;

/**
 * Layered soft shadows via `boxShadow`, which the New Architecture renders on
 * Android too. Two stacked shadows — a tight contact shadow plus a wide
 * ambient one — read as diffuse light; Android's `elevation` alone renders a
 * hard grey box, which is a large part of why stock RN looks cheap.
 *
 * Purple-tinted rather than black so shadows sit in the brand's colour family.
 */
type Elevation = Pick<ViewStyle, 'boxShadow'>;

export const elevation = {
  none: { boxShadow: undefined } satisfies Elevation,
  /** Resting cards and list rows. */
  sm: {
    boxShadow:
      '0px 1px 2px rgba(41, 27, 71, 0.05), 0px 2px 8px rgba(41, 27, 71, 0.04)',
  } satisfies Elevation,
  /** Cards that need to separate from a busy background. */
  md: {
    boxShadow:
      '0px 2px 4px rgba(41, 27, 71, 0.05), 0px 8px 20px rgba(41, 27, 71, 0.07)',
  } satisfies Elevation,
  /** Floating action buttons, popovers. */
  lg: {
    boxShadow:
      '0px 4px 8px rgba(41, 27, 71, 0.07), 0px 16px 32px rgba(41, 27, 71, 0.10)',
  } satisfies Elevation,
  /** Sheets and dialogs. */
  xl: {
    boxShadow:
      '0px 8px 16px rgba(41, 27, 71, 0.10), 0px 24px 56px rgba(41, 27, 71, 0.16)',
  } satisfies Elevation,
} as const;

/**
 * On dark surfaces a dark shadow is invisible, so depth has to come from the
 * surface ladder instead. These keep a faint shadow for edge definition only.
 */
export const elevationDark = {
  none: { boxShadow: undefined } satisfies Elevation,
  sm: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.30)' } satisfies Elevation,
  md: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.38)' } satisfies Elevation,
  lg: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.45)' } satisfies Elevation,
  xl: { boxShadow: '0px 16px 48px rgba(0, 0, 0, 0.58)' } satisfies Elevation,
} as const;

export type ElevationLevel = keyof typeof elevation;

/** Minimum hit target. Anything pressable should clear this. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export type ThemeColors = { [K in keyof typeof colors]: string };
