import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { radius } from '../../constants/theme';
import { spring } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';

export interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped. */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Determinate progress.
 *
 * The fill springs to each new value rather than jumping, so a bar that
 * updates as data loads reads as one continuous advance. Width is animated via
 * `scaleX` on a full-width bar — animating `width` re-runs layout every frame
 * and cannot be driven off the JS thread.
 */
export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 8,
  style,
}: ProgressBarProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(pct / 100);

  useEffect(() => {
    value.value = reduceMotion ? pct / 100 : withSpring(pct / 100, spring.gentle);
  }, [pct, value, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(value.value, 0.0001) }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[
        styles.track,
        { backgroundColor: trackColor || t.surfaceSunken, height },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color || t.primary, height },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.full,
    width: '100%',
    // Grow from the leading edge rather than the centre.
    transformOrigin: 'left center',
  },
});
