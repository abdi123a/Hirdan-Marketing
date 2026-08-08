import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../constants/theme';
import { pressScale } from '../../constants/motion';
import { font } from '../../constants/typography';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { PressableScale, type HapticStyle, type PressableScaleProps } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'tonal';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableScaleProps, 'style' | 'children'> {
  title: string;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Put the icon after the label — for "Next"-style forward actions. */
  iconTrailing?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
}

const METRICS: Record<Size, { padV: number; padH: number; min: number; icon: number; gap: number }> = {
  sm: { padV: 8, padH: 14, min: 38, icon: 15, gap: 6 },
  md: { padV: 13, padH: 20, min: 50, icon: 18, gap: 8 },
  lg: { padV: 17, padH: 26, min: 58, icon: 20, gap: 10 },
};

/**
 * Primary actions carry a shadow so they read as the raised thing on the
 * screen; quiet variants stay flat. All of them dip on press and fire a haptic
 * — a button that only changes opacity is the clearest tell of an unpolished
 * app.
 */
export function Button({
  title,
  loading,
  variant = 'primary',
  size = 'md',
  icon,
  iconTrailing,
  block,
  disabled,
  haptic = 'none',
  style,
  ...rest
}: ButtonProps) {
  const t = useTheme();
  const shadows = useElevation();
  const m = METRICS[size];

  const bg =
    variant === 'primary'
      ? t.primary
      : variant === 'secondary'
        ? t.secondary
        : variant === 'destructive'
          ? t.destructive
          : variant === 'tonal'
            ? t.accent
            : 'transparent';

  const fg =
    variant === 'secondary'
      ? t.secondaryForeground
      : variant === 'destructive'
        ? t.destructiveForeground
        : variant === 'outline' || variant === 'ghost'
          ? t.primary
          : variant === 'tonal'
            ? t.accentForeground
            : t.primaryForeground;

  const raised = variant === 'primary' || variant === 'secondary' || variant === 'destructive';
  const label = size === 'sm' ? 14 : size === 'lg' ? 17 : 15.5;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      scaleTo={pressScale.control}
      haptic={haptic}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          paddingVertical: m.padV,
          paddingHorizontal: m.padH,
          minHeight: m.min,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: t.primary,
          alignSelf: block ? 'stretch' : 'auto',
        },
        raised && !disabled ? shadows.sm : null,
        style,
      ]}
      {...rest}
    >
      {/* Holding the row in place while the spinner shows stops the button
          from resizing mid-action. */}
      <View style={[styles.row, { gap: m.gap, opacity: loading ? 0 : 1 }]}>
        {icon && !iconTrailing ? <Ionicons name={icon} size={m.icon} color={fg} /> : null}
        <Text
          numberOfLines={1}
          style={[styles.label, font(600), { color: fg, fontSize: label }]}
        >
          {title}
        </Text>
        {icon && iconTrailing ? <Ionicons name={icon} size={m.icon} color={fg} /> : null}
      </View>

      {loading ? (
        <View style={StyleSheet.absoluteFill}>
          <ActivityIndicator style={styles.spinner} color={fg} />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  spinner: {
    flex: 1,
  },
});
