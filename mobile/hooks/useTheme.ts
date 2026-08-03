import { useColorScheme, useWindowDimensions } from 'react-native';
import { colors, darkColors, type ThemeColors } from '../constants/theme';

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : colors;
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 768;
  const isLandscape = width > height;
  const isLargePhone = width >= 414 && !isTablet;
  return { width, height, isTablet, isLandscape, isLargePhone, isPhone: !isTablet };
}
