import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand, fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export type MetricTone = 'purple' | 'gold' | 'success' | 'danger' | 'warning' | 'neutral';

const GAP = 12;

export function toneColors(tone: MetricTone) {
  switch (tone) {
    case 'gold':
      return { fg: brand.gold, bg: 'rgba(245, 184, 36, 0.16)' };
    case 'success':
      return { fg: '#16A34A', bg: 'rgba(22, 163, 74, 0.12)' };
    case 'danger':
      return { fg: '#E53E3E', bg: 'rgba(229, 62, 62, 0.12)' };
    case 'warning':
      return { fg: '#D97706', bg: 'rgba(217, 119, 6, 0.14)' };
    case 'neutral':
      return { fg: brand.ink, bg: 'rgba(26, 20, 40, 0.06)' };
    case 'purple':
    default:
      return { fg: brand.purple, bg: 'rgba(90, 66, 138, 0.12)' };
  }
}

export type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'success' | 'destructive' | 'warning';
  icon: keyof typeof Ionicons.glyphMap;
  tone?: MetricTone;
  onPress?: () => void;
  /** Stretch to full row width (e.g. third card under a pair). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function KpiCard({
  label,
  value,
  hint,
  hintTone,
  icon,
  tone = 'purple',
  onPress,
  style,
}: KpiCardProps) {
  const t = useTheme();
  const colors =
    tone === 'neutral'
      ? { fg: t.mutedForeground, bg: t.muted }
      : toneColors(tone);
  const hintColor =
    hintTone === 'success'
      ? t.success
      : hintTone === 'destructive'
        ? t.destructive
        : hintTone === 'warning'
          ? t.warning
          : t.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.press,
        pressed && onPress ? { opacity: 0.92 } : null,
        style,
      ]}
    >
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.bg }]}>
          <Ionicons name={icon} size={16} color={colors.fg} />
        </View>
        <Text style={[styles.value, { color: t.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[styles.label, { color: t.mutedForeground }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: hintColor }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Measured 2-column grid. Avoids percentage + flexGrow wrap bugs that leave
 * cards overlapping / stuck on the same row.
 */
export function KpiGrid({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 0.5) setWidth(next);
  };

  const items = React.Children.toArray(children).filter(Boolean);
  const half = width > 0 ? (width - GAP) / 2 : undefined;

  return (
    <View style={[styles.grid, style]} onLayout={onLayout}>
      {items.map((child, index) => {
        const full =
          React.isValidElement(child) &&
          Boolean((child.props as KpiCardProps).fullWidth);
        const cellWidth = width > 0 ? (full ? width : half) : undefined;
        return (
          <View key={index} style={cellWidth != null ? { width: cellWidth } : styles.cellFallback}>
            {child}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  /** Before first layout pass — approximate half width so nothing collapses. */
  cellFallback: {
    width: '47%',
    flexGrow: 1,
  },
  press: {
    width: '100%',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 6,
    minHeight: 118,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    fontWeight: '600',
  },
});
