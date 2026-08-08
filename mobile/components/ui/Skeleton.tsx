import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { useIsDark, useTheme } from '../../hooks/useTheme';
import { withAlpha } from './Badge';

type SkeletonProps = {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: ViewStyle;
  /** Override the base color (e.g. dark media stages). */
  color?: string;
};

const SHIMMER_DURATION = 1150;

/**
 * Loading placeholder with a highlight that sweeps across it.
 *
 * A sweep reads as "content is on its way" where a pulsing block reads as an
 * element that failed to load — the direction of travel is what carries the
 * sense of progress. The whole placeholder is hidden from screen readers, which
 * announce the real content once it arrives.
 */
export function Skeleton({
  height = 16,
  width = '100%',
  radius: cornerRadius = radius.sm,
  style,
  color,
}: SkeletonProps) {
  const t = useTheme();
  const isDark = useIsDark();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress, reduceMotion]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      // Travels a full width past each edge so the highlight enters and
      // leaves cleanly instead of appearing mid-block.
      { translateX: -boxWidth + progress.value * (boxWidth * 2) },
    ],
  }));

  const base = color ?? t.muted;
  const highlight = withAlpha(isDark ? '#FFFFFF' : '#FFFFFF', isDark ? 0.05 : 0.55);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      style={[
        styles.box,
        {
          height,
          width,
          borderRadius: cornerRadius,
          backgroundColor: base,
        },
        style,
      ]}
    >
      {!reduceMotion && boxWidth > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
          <LinearGradient
            colors={['transparent', highlight, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function SkeletonCircle({ size = 40, style, color }: { size?: number; style?: ViewStyle; color?: string }) {
  return <Skeleton height={size} width={size} radius={size / 2} style={style} color={color} />;
}

export function SkeletonText({
  lines = 2,
  lastWidth = '62%',
  gap = spacing.sm,
  lineHeight = 12,
}: {
  lines?: number;
  lastWidth?: number | `${number}%`;
  gap?: number;
  lineHeight?: number;
}) {
  return (
    <View style={{ gap, flex: 1 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 && lines > 1 ? lastWidth : '100%'}
        />
      ))}
    </View>
  );
}

/** List row: optional avatar + two text lines + trailing chip. */
export function SkeletonListRow({
  avatar = true,
  trailing = true,
  style,
}: {
  avatar?: boolean;
  trailing?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.listRow,
        { backgroundColor: t.card, borderBottomColor: t.border },
        style,
      ]}
    >
      {avatar ? <SkeletonCircle size={40} /> : null}
      <SkeletonText lines={2} lineHeight={11} lastWidth="55%" />
      {trailing ? <Skeleton height={22} width={56} radius={radius.full} /> : null}
    </View>
  );
}

export function SkeletonCard({ height = 120, style }: { height?: number; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      <Skeleton height={14} width="38%" />
      <Skeleton height={height - 48} style={{ marginTop: spacing.md }} />
    </View>
  );
}

type ScreenPad = {
  padding?: number;
  gap?: number;
  style?: ViewStyle;
};

/** Full-screen list of row skeletons. */
export function ListSkeleton({
  rows = 6,
  avatar = true,
  trailing = true,
  padding = spacing.lg,
  gap = 0,
  style,
}: ScreenPad & { rows?: number; avatar?: boolean; trailing?: boolean }) {
  return (
    <View style={[{ padding, gap: gap || undefined, flex: 1 }, style]}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListRow key={i} avatar={avatar} trailing={trailing} />
      ))}
    </View>
  );
}

/** Detail / document page: header block + stacked body sections. */
export function DetailSkeleton({
  padding = spacing.lg,
  gap = spacing.md,
  style,
}: ScreenPad) {
  return (
    <View style={[{ padding, gap, flex: 1 }, style]}>
      <View style={{ gap: spacing.sm }}>
        <Skeleton height={22} width="55%" />
        <Skeleton height={12} width="32%" />
      </View>
      <Skeleton height={140} radius={radius.lg} />
      <Skeleton height={88} radius={radius.lg} />
      <Skeleton height={160} radius={radius.lg} />
      <View style={{ gap: spacing.sm }}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={48} radius={radius.md} />
        <Skeleton height={48} radius={radius.md} />
      </View>
    </View>
  );
}

/** Form screens: stacked field-shaped blocks. */
export function FormSkeleton({
  fields = 5,
  padding = spacing.lg,
  gap = spacing.md,
  style,
}: ScreenPad & { fields?: number }) {
  return (
    <View style={[{ padding, gap, flex: 1 }, style]}>
      {Array.from({ length: fields }).map((_, i) => (
        <View key={i} style={{ gap: spacing.xs }}>
          <Skeleton height={11} width={`${28 + (i % 3) * 8}%` as `${number}%`} />
          <Skeleton height={48} radius={radius.md} />
        </View>
      ))}
      <Skeleton height={48} radius={radius.md} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

/** Home / analytics: hero + metric tiles + chart. */
export function DashboardSkeleton({
  padding = spacing.lg,
  gap = spacing.md,
  style,
}: ScreenPad) {
  return (
    <View style={[{ padding, gap, flex: 1 }, style]}>
      <Skeleton height={148} radius={radius.xl} />
      <View style={styles.row}>
        <Skeleton height={88} style={{ flex: 1 }} radius={radius.lg} />
        <Skeleton height={88} style={{ flex: 1 }} radius={radius.lg} />
      </View>
      <View style={styles.row}>
        <Skeleton height={88} style={{ flex: 1 }} radius={radius.lg} />
        <Skeleton height={88} style={{ flex: 1 }} radius={radius.lg} />
      </View>
      <Skeleton height={200} radius={radius.lg} />
      <SkeletonListRow />
      <SkeletonListRow />
    </View>
  );
}

/** KPI / analytics grid. */
export function GridSkeleton({
  cells = 8,
  padding = spacing.md,
  gap = spacing.md,
  style,
}: ScreenPad & { cells?: number }) {
  const items = Array.from({ length: cells });
  return (
    <View style={[{ padding, gap, flex: 1 }, style]}>
      <View style={styles.grid}>
        {items.map((_, i) => (
          <View key={i} style={styles.gridCell}>
            <Skeleton height={88} radius={radius.lg} />
          </View>
        ))}
      </View>
      <Skeleton height={180} radius={radius.lg} />
      <Skeleton height={160} radius={radius.lg} />
    </View>
  );
}

/** Email conversation thread. */
export function ConversationSkeleton({
  padding = spacing.md,
  gap = spacing.md,
  style,
}: ScreenPad) {
  return (
    <View style={[{ padding, gap, flex: 1 }, style]}>
      <View style={{ gap: spacing.sm }}>
        <Skeleton height={18} width="70%" />
        <Skeleton height={12} width="40%" />
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Skeleton height={24} width={72} radius={radius.full} />
          <Skeleton height={24} width={64} radius={radius.full} />
        </View>
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <View style={[styles.row, { alignItems: 'center' }]}>
            <SkeletonCircle size={36} />
            <SkeletonText lines={2} lineHeight={10} lastWidth="45%" />
          </View>
          <Skeleton height={i === 1 ? 140 : 72} radius={radius.md} />
        </View>
      ))}
      <Skeleton height={96} radius={radius.lg} />
    </View>
  );
}

/** Social post cards. */
export function PostFeedSkeleton({
  cards = 3,
  padding = spacing.lg,
  gap = spacing.md,
  style,
}: ScreenPad & { cards?: number }) {
  return (
    <View style={[{ padding, gap, flex: 1 }, style]}>
      {Array.from({ length: cards }).map((_, i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <View style={[styles.row, { alignItems: 'center' }]}>
            <SkeletonCircle size={36} />
            <SkeletonText lines={2} lineHeight={10} lastWidth="40%" />
          </View>
          <Skeleton height={140} radius={radius.lg} />
          <Skeleton height={12} width="88%" />
          <Skeleton height={12} width="55%" />
        </View>
      ))}
    </View>
  );
}

/** Dark media stage (transfer preview). */
export function MediaSkeleton({ labelWidth = '48%' }: { labelWidth?: number | `${number}%` }) {
  return (
    <View style={styles.mediaStage}>
      <Skeleton height={220} width="78%" radius={radius.lg} color="#2A2A2A" />
      <Skeleton height={12} width={labelWidth} color="#2A2A2A" style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Keeps the sweeping highlight inside the rounded corners.
  box: { overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridCell: {
    width: '47%',
    flexGrow: 1,
  },
  mediaStage: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
