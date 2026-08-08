import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { duration, ease, spring } from '../../constants/motion';
import { type } from '../../constants/typography';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { Text } from './Text';

export interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tab switcher with a thumb that travels between slots.
 *
 * One moving object reads as a selection being carried across, where swapping
 * two background colours reads as two separate things blinking. The thumb only
 * springs once it has a position to spring from, so the first paint doesn't
 * animate in from the left edge.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const t = useTheme();
  const shadows = useElevation();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const slot = options.length > 0 ? (trackWidth - PAD * 2) / options.length : 0;

  const pos = useSharedValue(activeIndex);
  const placed = useRef(false);

  useEffect(() => {
    if (slot <= 0) return;
    pos.value =
      reduceMotion || !placed.current ? activeIndex : withSpring(activeIndex, spring.move);
    placed.current = true;
  }, [activeIndex, reduceMotion, pos, slot]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: slot,
    transform: [{ translateX: pos.value * slot }],
  }));

  return (
    <View
      style={[styles.wrap, { backgroundColor: t.surfaceSunken }, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { backgroundColor: t.card },
            shadows.sm,
            thumbStyle,
          ]}
        />
      ) : null}

      {options.map((opt, i) => (
        <Segment
          key={opt.value}
          label={opt.label}
          active={i === activeIndex}
          onPress={() => {
            if (opt.value === value) return;
            void Haptics.selectionAsync();
            onChange(opt.value);
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const focus = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    focus.value = withTiming(active ? 1 : 0, {
      duration: duration.base,
      easing: ease.out,
    });
  }, [active, focus]);

  // Cross-fading the colour keeps the label legible mid-travel; snapping it
  // makes the text flicker as the thumb passes underneath.
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.value, [0, 1], [t.mutedForeground, t.foreground]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.item}
    >
      <Animated.Text
        numberOfLines={1}
        style={[type.label, styles.label, labelStyle]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const PAD = 4;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: PAD,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    bottom: PAD,
    borderRadius: radius.md - PAD,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    minHeight: 38,
  },
  label: {
    textAlign: 'center',
  },
});
