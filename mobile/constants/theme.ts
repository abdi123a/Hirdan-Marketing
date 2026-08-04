/**
 * Brand tokens aligned to the Hirdan Marketing logo:
 * purple wordmark / H mark + gold circle accent on black.
 */
export const brand = {
  purple: '#584B90',
  purpleDeep: '#3F3568',
  gold: '#F5B824',
  black: '#000000',
  ink: '#1A1428',
} as const;

export const colors = {
  background: '#F5F4F8',
  foreground: brand.ink,
  card: '#FFFFFF',
  cardForeground: brand.ink,
  primary: brand.purple,
  primaryForeground: '#FFFFFF',
  secondary: brand.gold,
  secondaryForeground: brand.ink,
  muted: '#ECEAF1',
  mutedForeground: '#6B6578',
  accent: '#EDEAF5',
  accentForeground: brand.purple,
  destructive: '#E53E3E',
  destructiveForeground: '#FFFFFF',
  border: '#E2DFEA',
  input: '#E2DFEA',
  ring: brand.purple,
  success: '#16A34A',
  warning: '#D97706',
  sidebar: brand.black,
  sidebarForeground: '#F2EFF8',
  sidebarPrimary: brand.gold,
} as const;

export const darkColors = {
  background: '#000000',
  foreground: '#F2EFF8',
  card: '#121018',
  cardForeground: '#F2EFF8',
  // Dark surfaces keep gold as the active accent (matches logo circle / “Marketing”)
  primary: brand.gold,
  primaryForeground: brand.ink,
  secondary: brand.purple,
  secondaryForeground: '#FFFFFF',
  muted: '#1A1624',
  mutedForeground: '#9B94AB',
  accent: '#1A1624',
  accentForeground: brand.gold,
  destructive: '#B91C1C',
  destructiveForeground: '#FFFFFF',
  border: '#2A2438',
  input: '#2A2438',
  ring: brand.gold,
  success: '#22C55E',
  warning: '#F59E0B',
  sidebar: '#000000',
  sidebarForeground: '#F2EFF8',
  sidebarPrimary: brand.gold,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
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

export type ThemeColors = { [K in keyof typeof colors]: string };
