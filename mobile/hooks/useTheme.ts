import { useColorScheme, useWindowDimensions } from 'react-native';
import {
  colors,
  darkColors,
  elevation,
  elevationDark,
  type ThemeColors,
} from '../constants/theme';

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : colors;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/**
 * Shadow scale for the active scheme. Dark mode leans on the surface ladder
 * rather than shadows, so the two sets are not interchangeable.
 */
export function useElevation(): typeof elevation {
  return useColorScheme() === 'dark' ? elevationDark : elevation;
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 768;
  const isLandscape = width > height;
  const isLargePhone = width >= 414 && !isTablet;
  return { width, height, isTablet, isLandscape, isLargePhone, isPhone: !isTablet };
}
