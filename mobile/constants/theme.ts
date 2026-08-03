/**
 * Brand tokens ported from src/index.css
 */
export const colors = {
  background: '#F4F4F7',
  foreground: '#1F1633',
  card: '#FFFFFF',
  cardForeground: '#1F1633',
  primary: '#4A2F8A',
  primaryForeground: '#FFFFFF',
  secondary: '#F5B824',
  secondaryForeground: '#1F1633',
  muted: '#EAEAED',
  mutedForeground: '#6B6578',
  accent: '#EDE8F5',
  accentForeground: '#4A2F8A',
  destructive: '#E53E3E',
  destructiveForeground: '#FFFFFF',
  border: '#E0DCE8',
  input: '#E0DCE8',
  ring: '#4A2F8A',
  success: '#16A34A',
  warning: '#D97706',
  sidebar: '#24183D',
  sidebarForeground: '#E5E0F0',
  sidebarPrimary: '#F5B824',
} as const;

export const darkColors = {
  background: '#0F0A1A',
  foreground: '#F2EFF8',
  card: '#1A1329',
  cardForeground: '#F2EFF8',
  primary: '#F5B824',
  primaryForeground: '#1F1633',
  secondary: '#2A2040',
  secondaryForeground: '#F2EFF8',
  muted: '#24183D',
  mutedForeground: '#9B94AB',
  accent: '#24183D',
  accentForeground: '#F2EFF8',
  destructive: '#7F1D1D',
  destructiveForeground: '#FFFFFF',
  border: '#2E2445',
  input: '#2E2445',
  ring: '#F5B824',
  success: '#22C55E',
  warning: '#F59E0B',
  sidebar: '#0A0612',
  sidebarForeground: '#E5E0F0',
  sidebarPrimary: '#F5B824',
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
