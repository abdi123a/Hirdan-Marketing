import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
import { useTheme } from '../../hooks/useTheme';

export interface TabsProps {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

type Slot = { x: number; width: number };

/**
 * Scrollable underline tabs.
 *
 * The indicator is measured from the labels and animates its position *and*
 * width, so it stretches between tabs of different lengths rather than
 * appearing under each in turn. Selecting a tab also scrolls it into view —
 * otherwise a tab chosen programmatically can sit off-screen.
 */
export function Tabs({ tabs, value, onChange, style }: TabsProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const [slots, setSlots] = useState<Record<string, Slot>>({});

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === value));
  const active = slots[tabs[activeIndex]?.key ?? ''];

  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (reduceMotion || !placed.current) {
      x.value = active.x;
      width.value = active.width;
    } else {
      x.value = withSpring(active.x, spring.move);
      width.value = withSpring(active.width, spring.move);
    }
    placed.current = true;
  }, [active, reduceMotion, x, width]);

  useEffect(() => {
    if (!active) return;
    scrollRef.current?.scrollTo({
      x: Math.max(0, active.x - spacing.xl),
      animated: !reduceMotion,
    });
  }, [active, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: width.value,
  }));

  const measure = useCallback((key: string, e: LayoutChangeEvent) => {
    const { x: layoutX, width: layoutWidth } = e.nativeEvent.layout;
    setSlots((prev) => {
      const existing = prev[key];
      if (existing && existing.x === layoutX && existing.width === layoutWidth) {
        return prev;
      }
      return { ...prev, [key]: { x: layoutX, width: layoutWidth } };
    });
  }, []);

  return (
    <View style={[styles.wrap, { borderBottomColor: t.borderSubtle }, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Tabs and indicator share this un-padded parent so their measured
            offsets agree — padding on the scroll container would shift the
            in-flow tabs relative to the absolutely positioned indicator. */}
        <View style={styles.row}>
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              label={tab.label}
              active={tab.key === value}
              onLayout={(e) => measure(tab.key, e)}
              onPress={() => {
                if (tab.key === value) return;
                void Haptics.selectionAsync();
                onChange(tab.key);
              }}
            />
          ))}

          {active ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { backgroundColor: t.primary }, indicatorStyle]}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
  onLayout,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const t = useTheme();
  const focus = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    focus.value = withTiming(active ? 1 : 0, {
      duration: duration.base,
      easing: ease.out,
    });
  }, [active, focus]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.value, [0, 1], [t.mutedForeground, t.primary]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLayout={onLayout}
      style={styles.tab}
    >
      <Animated.Text style={[type.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: {
    paddingHorizontal: spacing.gutter,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xl,
    position: 'relative',
  },
  tab: {
    paddingVertical: spacing.md + 2,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    borderRadius: radius.full,
  },
});
