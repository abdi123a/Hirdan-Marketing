import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { withAlpha } from './Badge';
import { Button } from './Button';
import { FadeIn } from './FadeIn';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Quiet alternative next to the primary action. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Set when the state is a failure rather than "nothing here yet". */
  tone?: 'neutral' | 'destructive';
  style?: StyleProp<ViewStyle>;
}

/**
 * Shown in place of a list that has nothing in it.
 *
 * The icon sits in a tinted halo instead of floating loose on the background —
 * a bare grey glyph reads as a missing image rather than a designed state.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  icon = 'folder-open-outline',
  tone = 'neutral',
  style,
}: EmptyStateProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const accent = tone === 'destructive' ? t.destructive : t.primary;

  const content = (
    <View style={[styles.wrap, style]}>
      <View style={[styles.halo, { backgroundColor: withAlpha(accent, 0.1) }]}>
        <Ionicons name={icon} size={30} color={accent} />
      </View>

      <View style={styles.copy}>
        <Text variant="h3" center>
          {title}
        </Text>
        {description ? (
          <Text variant="body" color="muted" center style={styles.desc}>
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}

      {secondaryLabel && onSecondary ? (
        <Button
          title={secondaryLabel}
          variant="ghost"
          size="sm"
          onPress={onSecondary}
        />
      ) : null}
    </View>
  );

  if (reduceMotion) return content;

  return <FadeIn>{content}</FadeIn>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  halo: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  desc: {
    maxWidth: 300,
  },
  action: {
    marginTop: spacing.xs,
    minWidth: 180,
  },
});
