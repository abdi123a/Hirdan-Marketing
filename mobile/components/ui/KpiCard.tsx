import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand, radius, spacing } from '../../constants/theme';
import { pressScale } from '../../constants/motion';
import { type } from '../../constants/typography';
import { useElevation, useIsDark, useTheme } from '../../hooks/useTheme';
import { withAlpha } from './Badge';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type MetricTone = 'purple' | 'gold' | 'success' | 'danger' | 'warning' | 'neutral';

const GAP = 12;

export function toneColors(tone: MetricTone) {
  switch (tone) {
    case 'gold':
      return { fg: brand.gold, bg: withAlpha(brand.gold, 0.16) };
    case 'success':
      return { fg: '#12A150', bg: withAlpha('#12A150', 0.12) };
    case 'danger':
      return { fg: '#DC2F3E', bg: withAlpha('#DC2F3E', 0.12) };
    case 'warning':
      return { fg: '#D97706', bg: withAlpha('#D97706', 0.14) };
    case 'neutral':
      return { fg: brand.ink, bg: withAlpha(brand.ink, 0.06) };
    case 'purple':
    default:
      return { fg: brand.purple, bg: withAlpha(brand.purple, 0.12) };
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

/**
 * A single metric.
 *
 * The number is the point, so it gets the display face and tabular figures —
 * without them a refreshing value visibly jitters as digit widths change. The
 * tinted icon carries the tone; the card itself stays neutral so a grid of
 * these reads as one system rather than a row of coloured boxes.
 */
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
  const shadows = useElevation();
  const isDark = useIsDark();

  // Brand purple is too dark to read on a dark card, so dark mode lifts the
  // tone to its accent instead of using the raw brand value.
  const palette =
    tone === 'neutral'
      ? { fg: t.mutedForeground, bg: t.muted }
      : isDark && tone === 'purple'
        ? { fg: brand.purpleSoft, bg: withAlpha(brand.purpleSoft, 0.16) }
        : toneColors(tone);

  const hintColor =
    hintTone === 'success'
      ? t.success
      : hintTone === 'destructive'
        ? t.destructive
        : hintTone === 'warning'
          ? t.warning
          : t.subtleForeground;

  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: palette.bg }]}>
        <Ionicons name={icon} size={17} color={palette.fg} />
      </View>

      <Text
        style={[type.metricSm, { color: t.foreground }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>

      <Text variant="label" color="muted" numberOfLines={1}>
        {label}
      </Text>

      {hint ? (
        <Text variant="caption" style={{ color: hintColor }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );

  const surface: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: t.card, borderColor: t.borderSubtle },
    shadows.sm,
    style,
  ];

  if (!onPress) {
    return <View style={surface}>{body}</View>;
  }

  return (
    <PressableScale
      scaleTo={pressScale.card}
      haptic="none"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={surface}
    >
      {body}
    </PressableScale>
  );
}

function isFullWidth(child: React.ReactNode) {
  return React.isValidElement(child) && Boolean((child.props as KpiCardProps).fullWidth);
}

/**
 * Reliable 2-column grid using flex rows — no percentage widths or
 * onLayout measurement (both break inside FlashList headers / padded parents).
 */
export function KpiGrid({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];

  for (let i = 0; i < items.length; ) {
    const cur = items[i];
    if (isFullWidth(cur)) {
      rows.push([cur]);
      i += 1;
      continue;
    }
    const next = items[i + 1];
    if (next != null && !isFullWidth(next)) {
      rows.push([cur, next]);
      i += 2;
    } else {
      rows.push([cur]);
      i += 1;
    }
  }

  return (
    <View style={[styles.grid, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((child, colIndex) => (
            <View key={colIndex} style={styles.cell}>
              {child}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 5,
    minHeight: 126,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
