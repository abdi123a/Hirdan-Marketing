import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../../constants/theme';
import { useElevation, useTheme } from '../../hooks/useTheme';

export interface ActionBarProps {
  children: React.ReactNode;
  /** Copy shown above the controls — a selection count, a total. */
  caption?: React.ReactNode;
  /**
   * `pinned` sits flush against the bottom edge with a top hairline.
   * `floating` is an inset capsule, for a bar that appears over content.
   */
  variant?: 'pinned' | 'floating';
  /**
   * Extra space below the bar. Set to the tab bar height on a screen inside
   * the tab navigator that renders this over its own content.
   */
  offsetBottom?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bottom bar for a screen's primary actions.
 *
 * Owns the bottom safe-area inset. A pushed screen has no tab bar beneath it,
 * so anything pinned to `bottom: 0` lands underneath Android's navigation
 * buttons or gesture handle — reserving that space is the whole reason this
 * exists, and doing it here means no screen has to remember.
 */
export function ActionBar({
  children,
  caption,
  variant = 'pinned',
  offsetBottom = 0,
  style,
}: ActionBarProps) {
  const t = useTheme();
  const shadows = useElevation();
  const insets = useSafeAreaInsets();

  const floating = variant === 'floating';
  const safeBottom = Math.max(insets.bottom, spacing.md) + offsetBottom;

  return (
    <View
      style={[
        styles.base,
        floating ? styles.floating : styles.pinned,
        {
          backgroundColor: t.card,
          borderColor: floating ? t.borderSubtle : t.borderSubtle,
          paddingBottom: floating ? spacing.md : safeBottom,
          marginBottom: floating ? safeBottom : 0,
        },
        shadows.lg,
        style,
      ]}
    >
      {caption ? <View style={styles.caption}>{caption}</View> : null}
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.gutter,
  },
  pinned: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  floating: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
