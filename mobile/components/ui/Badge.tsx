import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Text } from './Text';

export type BadgeTone =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'gold'
  | 'info'
  | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** `soft` is the tinted default; `solid` is for the one badge that must win. */
  variant?: 'soft' | 'solid' | 'outline';
  /** Leading status dot, for state that reads better as a colour than a word. */
  dot?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/**
 * Status pill.
 *
 * Tints are built with explicit alpha rather than appending hex to a token —
 * `t.success + '22'` breaks the moment a token is an `rgba()` or a 4-digit
 * hex, and silently renders a transparent chip.
 */
export function Badge({
  label,
  tone = 'default',
  icon,
  variant = 'soft',
  dot,
  size = 'md',
  style,
}: BadgeProps) {
  const t = useTheme();

  const base =
    tone === 'success'
      ? t.success
      : tone === 'warning'
        ? t.warning
        : tone === 'destructive'
          ? t.destructive
          : tone === 'gold'
            ? t.secondary
            : tone === 'info'
              ? t.info
              : tone === 'neutral'
                ? t.mutedForeground
                : t.primary;

  const bg =
    variant === 'solid'
      ? base
      : variant === 'outline'
        ? 'transparent'
        : withAlpha(base, 0.13);

  const fg = variant === 'solid' ? contrastOn(tone, t.primaryForeground, t.secondaryForeground) : base;

  const small = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: variant === 'outline' ? withAlpha(base, 0.4) : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingHorizontal: small ? spacing.sm : 10,
          paddingVertical: small ? 3 : 5,
          gap: small ? 4 : 5,
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      {icon ? <Ionicons name={icon} size={small ? 11 : 13} color={fg} /> : null}
      <Text
        variant={small ? 'overline' : 'caption'}
        style={{ color: fg, fontSize: small ? 10.5 : 12 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Gold is light enough that white text on it fails contrast. */
function contrastOn(tone: BadgeTone, onDark: string, onLight: string) {
  return tone === 'gold' ? onLight : onDark;
}

/**
 * Accepts `#RGB`, `#RRGGBB`, `#RRGGBBAA` and `rgb()/rgba()` and returns an
 * `rgba()` at the given alpha.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const int = parseInt(hex.slice(0, 6), 16);
    if (Number.isNaN(int)) return color;
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const nums = color.match(/[\d.]+/g);
  if (nums && nums.length >= 3) {
    return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${a})`;
  }
  return color;
}

/**
 * Shifts a colour toward black (negative) or white (positive) by `amount`
 * (0–1). Used to build a two-stop gradient from one brand colour, so a tile
 * only has to declare its hue once.
 */
export function shade(color: string, amount: number): string {
  const rgba = withAlpha(color, 1);
  const nums = rgba.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return color;

  const mix = (channel: number) =>
    amount >= 0
      ? Math.round(channel + (255 - channel) * amount)
      : Math.round(channel * (1 + amount));

  const [r, g, b] = nums.slice(0, 3).map((n) => mix(Number(n)));
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
