import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Third line for secondary metadata. */
  meta?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Hide the divider on the last row of a group. */
  divider?: boolean;
  /** Suppress the trailing chevron on a row that navigates. */
  hideChevron?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A row in a grouped list.
 *
 * The divider is inset past the leading slot so it lines up under the text
 * rather than cutting across the avatar — the detail that separates a
 * considered list from a default one.
 */
export function ListRow({
  title,
  subtitle,
  meta,
  right,
  left,
  onPress,
  onLongPress,
  divider = true,
  hideChevron,
  destructive,
  style,
}: ListRowProps) {
  const t = useTheme();
  const interactive = Boolean(onPress || onLongPress);
  const showChevron = interactive && !right && !hideChevron;

  const content = (
    <>
      {left ? <View style={styles.leading}>{left}</View> : null}

      <View style={styles.body}>
        <Text
          variant="title"
          color={destructive ? 'destructive' : 'default'}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subtext" color="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" color="subtle" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      {right}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={17} color={t.subtleForeground} />
      ) : null}
    </>
  );

  const rowStyle: StyleProp<ViewStyle> = [
    styles.row,
    { backgroundColor: t.card },
    style,
  ];

  return (
    <View>
      {interactive ? (
        <PressableScale
          scaleTo={0.99}
          haptic="none"
          onPress={onPress}
          onLongPress={onLongPress}
          style={rowStyle}
        >
          {content}
        </PressableScale>
      ) : (
        <View style={rowStyle}>{content}</View>
      )}

      {divider ? (
        <View
          style={[
            styles.divider,
            {
              backgroundColor: t.borderSubtle,
              marginLeft: left ? 64 : spacing.lg,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/**
 * Wraps rows in a rounded card so a list reads as one object. Pass
 * `divider={false}` on the final row.
 */
export function ListGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: t.card, borderColor: t.borderSubtle },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  leading: {
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
