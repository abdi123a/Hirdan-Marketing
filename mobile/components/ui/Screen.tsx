import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { pressScale } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Page canvas: applies the background and the top safe-area inset. */
export function Screen({
  children,
  style,
  edges = 'top',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `none` when a parent already handled the inset (a Stack header, say). */
  edges?: 'top' | 'none';
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: t.background, paddingTop: edges === 'top' ? insets.top : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Shows a back chevron. Defaults on when the router can go back. */
  showBack?: boolean;
  onBack?: () => void;
  /** Trailing controls — icon buttons, a filter chip. */
  actions?: React.ReactNode;
  /**
   * Scroll offset in px. When supplied, the large title shrinks and a hairline
   * appears as content passes beneath it.
   */
  scrollY?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}

/** Distance over which the large title collapses. */
const COLLAPSE = 60;

/**
 * Large page title that collapses into a compact bar on scroll.
 *
 * Driving this from a shared scroll value keeps the whole transition on the UI
 * thread — the same effect written with React state re-renders the header on
 * every frame of the scroll.
 */
export function ScreenHeader({
  title,
  subtitle,
  showBack,
  onBack,
  actions,
  scrollY,
  style,
}: ScreenHeaderProps) {
  const t = useTheme();
  const router = useRouter();

  const canGoBack = showBack ?? (typeof router.canGoBack === 'function' && router.canGoBack());

  const titleStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    return {
      transform: [
        { scale: interpolate(scrollY.value, [0, COLLAPSE], [1, 0.86], 'clamp') },
        { translateY: interpolate(scrollY.value, [0, COLLAPSE], [0, 2], 'clamp') },
      ],
    };
  });

  const ruleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [0, COLLAPSE], [0, 1], 'clamp') };
  });

  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerRow}>
        {canGoBack ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Go back"
            scaleTo={pressScale.icon}
            haptic="none"
            onPress={onBack ?? (() => router.back())}
            style={[styles.iconBtn, { backgroundColor: t.card, borderColor: t.borderSubtle }]}
          >
            <Ionicons name="chevron-back" size={20} color={t.foreground} />
          </PressableScale>
        ) : null}

        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <Text variant="h1" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="subtext" color="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>

        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.rule, { backgroundColor: t.border }, ruleStyle]}
      />
    </View>
  );
}

/**
 * A titled block of content. Keeps the gap between a section heading and its
 * body consistent everywhere instead of being re-picked per screen.
 */
export function Section({
  title,
  action,
  children,
  style,
  /** Apply the page gutter. Off when the child bleeds to the edges. */
  padded = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={[styles.sectionHead, padded ? styles.gutter : null]}>
          {title ? (
            <Text variant="overline" color="muted" uppercase style={styles.sectionTitle}>
              {title}
            </Text>
          ) : (
            <View style={styles.sectionTitle} />
          )}
          {action}
        </View>
      ) : null}
      <View style={padded ? styles.gutter : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
    // Collapse toward the leading edge rather than the centre.
    transformOrigin: 'left center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  section: {
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    flex: 1,
  },
  gutter: {
    paddingHorizontal: spacing.gutter,
  },
});
