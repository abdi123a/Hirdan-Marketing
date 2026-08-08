import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { duration, ease, stepDelay, travel } from '../../constants/motion';

export interface FadeInProps {
  /** Position in a list. Drives the stagger delay. */
  index?: number;
  /** Extra delay before this item's own stagger offset. */
  delay?: number;
  /** How far it rises. Defaults to a short settle. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Entrance for content that has just arrived — a loaded list, a section of a
 * dashboard.
 *
 * Driven by shared values rather than Reanimated's `entering` prop: layout
 * animations are unreliable inside virtualised lists on Android, where
 * recycled rows can re-fire or drop the animation entirely. Delays are capped
 * in `stepDelay`, so a long list never leaves its last rows waiting.
 */
export function FadeIn({
  index = 0,
  delay = 0,
  distance = travel.md,
  style,
  children,
}: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay + stepDelay(index),
      withTiming(1, { duration: duration.reveal, easing: ease.out }),
    );
  }, [progress, delay, index, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
