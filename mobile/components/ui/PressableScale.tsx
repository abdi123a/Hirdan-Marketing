import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { pressScale, spring } from '../../constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'none';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** How far the surface dips. Defaults to the `card` amount. */
  scaleTo?: number;
  /**
   * Physical feedback fired on press-in. Off by default, and deliberately so:
   * haptics are a signal, and a device that buzzes on every tap teaches the
   * user to ignore it. Reserve it for a state change the user should feel —
   * a toggle flipping, a destructive confirm — never for plain navigation.
   */
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function fireHaptic(kind: HapticStyle) {
  switch (kind) {
    case 'none':
      return;
    case 'selection':
      void Haptics.selectionAsync();
      return;
    case 'medium':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    case 'heavy':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    default:
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * A pressable that dips under the finger instead of just dimming.
 *
 * Opacity-on-press is the stock RN feel and reads as flat; a small spring
 * scale reads as the surface physically giving way. The spring is symmetric so
 * a quick tap still completes the dip rather than being cut off, and the whole
 * effect is skipped under reduce-motion.
 */
export function PressableScale({
  scaleTo = pressScale.card,
  haptic = 'none',
  disabled,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const active = useSharedValue(0);

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      active.value = withSpring(1, spring.press);
      if (haptic !== 'none') fireHaptic(haptic);
      onPressIn?.(e);
    },
    [active, haptic, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      active.value = withSpring(0, spring.press);
      onPressOut?.(e);
    },
    [active, onPressOut],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: reduceMotion ? 1 : 1 - active.value * (1 - scaleTo) },
    ],
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle, disabled ? { opacity: 0.45 } : null]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
