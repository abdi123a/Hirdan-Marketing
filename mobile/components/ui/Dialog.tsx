import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useReducedMotion,
} from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { duration } from '../../constants/motion';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { withAlpha } from './Badge';
import { Button } from './Button';
import { Text } from './Text';

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Confirmation dialog.
 *
 * Scales up from slightly small rather than cutting in, so it reads as coming
 * forward out of the backdrop. Destructive confirms lead with a red halo — the
 * warning should land before the button is read.
 */
export function Dialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive,
  loading,
  icon,
}: DialogProps) {
  const t = useTheme();
  const shadows = useElevation();
  const reduceMotion = useReducedMotion();

  if (!visible) return null;

  const accent = destructive ? t.destructive : t.primary;
  const glyph = icon ?? (destructive ? 'alert-circle' : undefined);

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(duration.fast)}
        exiting={reduceMotion ? undefined : FadeOut.duration(duration.fast)}
        style={[styles.backdrop, { backgroundColor: t.scrim }]}
      >
        <Pressable style={styles.fill} onPress={loading ? undefined : onCancel}>
          <View style={styles.center}>
            <Animated.View
              entering={reduceMotion ? undefined : ZoomIn.springify().damping(18).mass(0.7)}
              exiting={reduceMotion ? undefined : ZoomOut.duration(duration.fast)}
              style={styles.boxWrap}
            >
              {/* Stops a tap inside the dialog from reaching the backdrop. */}
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={[
                  styles.box,
                  { backgroundColor: t.card, borderColor: t.borderSubtle },
                  shadows.xl,
                ]}
              >
                {glyph ? (
                  <View style={[styles.halo, { backgroundColor: withAlpha(accent, 0.12) }]}>
                    <Ionicons name={glyph} size={24} color={accent} />
                  </View>
                ) : null}

                <View style={styles.copy}>
                  <Text variant="h3" center>
                    {title}
                  </Text>
                  {message ? (
                    <Text variant="body" color="muted" center>
                      {message}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  <Button
                    title={cancelLabel}
                    variant="tonal"
                    onPress={onCancel}
                    disabled={loading}
                    style={styles.action}
                  />
                  <Button
                    title={confirmLabel}
                    variant={destructive ? 'destructive' : 'primary'}
                    onPress={onConfirm}
                    loading={loading}
                    haptic={destructive ? 'medium' : 'light'}
                    style={styles.action}
                  />
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  boxWrap: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  box: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  halo: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  action: {
    flex: 1,
  },
});
