import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, spacing, type ElevationLevel } from '../../constants/theme';
import { pressScale } from '../../constants/motion';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { PressableScale, type HapticStyle } from './PressableScale';

export interface CardProps extends ViewProps {
  /** Depth against the canvas. `sm` is the resting default. */
  elevation?: ElevationLevel;
  /** Sunken wells and inline panels sit flat, with no shadow. */
  variant?: 'raised' | 'flat' | 'sunken' | 'outlined';
  /** Makes the whole card a target, with a spring dip and optional haptic. */
  onPress?: () => void;
  onLongPress?: () => void;
  haptic?: HapticStyle;
  /** Drop the built-in padding when the card lays out its own content. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's base surface.
 *
 * Depth comes from a soft layered shadow plus the surface ladder, not from a
 * heavy border — the hairline only holds the edge where a shadow cannot, which
 * is mainly dark mode.
 */
export function Card({
  elevation: level = 'sm',
  variant = 'raised',
  onPress,
  onLongPress,
  haptic = 'none',
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  const t = useTheme();
  const shadows = useElevation();

  const background =
    variant === 'sunken'
      ? t.surfaceSunken
      : variant === 'outlined'
        ? 'transparent'
        : t.card;

  const surface: StyleProp<ViewStyle> = [
    styles.card,
    padded ? styles.padded : null,
    {
      backgroundColor: background,
      borderColor: variant === 'outlined' ? t.borderStrong : t.borderSubtle,
    },
    variant === 'raised' ? shadows[level] : null,
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <PressableScale
        scaleTo={pressScale.card}
        haptic={haptic}
        onPress={onPress}
        onLongPress={onLongPress}
        style={surface}
        {...rest}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={surface} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: {
    padding: spacing.lg,
  },
});
