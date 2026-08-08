import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../constants/theme';
import { duration, ease, spring } from '../../constants/motion';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Secondary line under the title. */
  subtitle?: string;
  /** Pinned to the bottom, outside the scroll area — for confirm actions. */
  footer?: React.ReactNode;
  /** Skip the ScrollView when the child scrolls itself (a list, say). */
  scrollable?: boolean;
  showClose?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Past this much drag, or this fast a flick, the sheet commits to closing. */
const CLOSE_DISTANCE_RATIO = 0.3;
const CLOSE_VELOCITY = 900;

/**
 * Bottom sheet with drag-to-dismiss.
 *
 * `Modal`'s own `animationType="slide"` is a fixed, uninterruptible ramp; this
 * drives the position itself so the sheet tracks the finger, can be caught
 * mid-flight, and settles on a spring. The backdrop fades with the drag, which
 * is what makes the gesture feel connected rather than scripted.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  footer,
  scrollable = true,
  showClose = true,
  children,
  contentStyle,
}: SheetProps) {
  const t = useTheme();
  const shadows = useElevation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Kept mounted for the duration of the exit animation, so the sheet can be
  // seen leaving instead of vanishing the instant `visible` flips.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(screenHeight);
  const [sheetHeight, setSheetHeight] = useState(screenHeight);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = reduceMotion ? 0 : withSpring(0, spring.sheet);
    } else if (mounted) {
      translateY.value = reduceMotion
        ? 0
        : withTiming(sheetHeight, { duration: duration.base, easing: ease.in });
    }
  }, [visible, reduceMotion, translateY, sheetHeight, mounted]);

  const close = useCallback(() => {
    if (reduceMotion) {
      finishClose();
      return;
    }
    translateY.value = withTiming(
      sheetHeight,
      { duration: duration.base, easing: ease.in },
      (done) => {
        if (done) runOnJS(finishClose)();
      },
    );
  }, [translateY, sheetHeight, finishClose, reduceMotion]);

  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Resist upward drag rather than blocking it — the sheet should feel
      // attached to the finger even past its open position.
      const next = startY.value + e.translationY;
      translateY.value = next < 0 ? next / 4 : next;
    })
    .onEnd((e) => {
      const shouldClose =
        translateY.value > sheetHeight * CLOSE_DISTANCE_RATIO ||
        e.velocityY > CLOSE_VELOCITY;

      if (shouldClose) {
        translateY.value = withTiming(
          sheetHeight,
          { duration: duration.base, easing: ease.in },
          (done) => {
            if (done) runOnJS(finishClose)();
          },
        );
      } else {
        translateY.value = withSpring(0, spring.snap);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.max(0, translateY.value / sheetHeight)),
  }));

  if (!mounted) return null;

  const body = (
    <View style={[styles.body, contentStyle]}>{children}</View>
  );

  return (
    <Modal visible transparent statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]}
            onPress={close}
          />
        </Animated.View>

        <Animated.View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              backgroundColor: t.card,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              maxHeight: screenHeight * 0.9,
            },
            shadows.xl,
            sheetStyle,
          ]}
        >
          {/* Only the header takes the drag, so a scrollable body still
              scrolls instead of fighting the dismiss gesture. */}
          <GestureDetector gesture={pan}>
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: t.borderStrong }]} />

              {title ? (
                <View style={styles.titleRow}>
                  <View style={styles.titleText}>
                    <Text variant="h3" numberOfLines={1}>
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text variant="subtext" color="muted" numberOfLines={2}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>

                  {showClose ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      hitSlop={10}
                      onPress={close}
                      style={[styles.closeBtn, { backgroundColor: t.surfaceSunken }]}
                    >
                      <Ionicons name="close" size={17} color={t.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </GestureDetector>

          {scrollable ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              bounces={false}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}

          {footer ? (
            <View style={[styles.footer, { borderTopColor: t.borderSubtle }]}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  header: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
