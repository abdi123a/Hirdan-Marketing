import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ROOT_DOCK, featureForPath, type DockItem } from '../../constants/features';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { AnimatedIcon } from '../ui/Icon';

const PILL_HEIGHT = 34;

/**
 * Bottom navigation belonging to the feature you're currently inside.
 *
 * There is no app-wide dock: the launcher has none, and each feature brings
 * its own set of destinations. That keeps the bar relevant — a Money dock is
 * useless while you're writing a post — and lets a feature with a single
 * screen show no dock at all rather than a bar with one entry in it.
 *
 * Rendered as an overlay rather than a navigator, so it needs no change to the
 * route tree and can appear on any screen the feature owns.
 */
export function FeatureDock() {
  const t = useTheme();
  const shadows = useElevation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);

  const feature = featureForPath(pathname);
  /*
   * A feature with only one screen has no dock of its own, but the bar should
   * never just disappear — losing it mid-journey strands you with only the
   * back gesture. Those screens fall back to the root dock, which is how the
   * super-app pattern keeps the primary destinations always reachable.
   */
  const items = feature?.dock ?? ROOT_DOCK;

  const activeIndex = useMemo(() => {
    if (!items) return -1;
    let best = -1;
    let bestLen = -1;
    items.forEach((item, i) => {
      for (const candidate of [item.href, ...(item.match ?? [])]) {
        const hit = pathname === candidate || pathname.startsWith(`${candidate}/`);
        if (hit && candidate.length > bestLen) {
          best = i;
          bestLen = candidate.length;
        }
      }
    });
    return best;
  }, [items, pathname]);

  const count = items?.length ?? 0;
  const slot = count > 0 ? rowWidth / count : 0;
  const pill = useSharedValue(Math.max(activeIndex, 0));
  const placed = useRef(false);

  useEffect(() => {
    if (activeIndex < 0 || slot <= 0) {
      placed.current = false;
      return;
    }
    pill.value =
      reduceMotion || !placed.current ? activeIndex : withSpring(activeIndex, spring.move);
    placed.current = true;
  }, [activeIndex, reduceMotion, pill, slot]);

  const pillStyle = useAnimatedStyle(() => ({
    width: Math.max(slot - spacing.sm, 0),
    transform: [{ translateX: pill.value * slot + spacing.sm / 2 }],
  }));

  if (!items || items.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
    >
      <View
        style={[
          styles.dock,
          { backgroundColor: t.card, borderColor: t.borderSubtle },
          shadows.lg,
        ]}
      >
        <View
          accessibilityRole="tablist"
          style={styles.row}
          onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        >
          {slot > 0 && activeIndex >= 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { backgroundColor: t.accent }, pillStyle]}
            />
          ) : null}

          {items.map((item, i) => (
            <DockButton
              key={item.href}
              item={item}
              active={i === activeIndex}
              onPress={() => {
                if (i === activeIndex) return;
                void Haptics.selectionAsync();
                // replace, not push: dock entries are siblings, so pushing
                // would build a back stack of peer screens.
                router.replace(item.href as never);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function DockButton({
  item,
  active,
  onPress,
}: {
  item: DockItem;
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

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.value, [0, 1], [t.mutedForeground, t.primary]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      onPress={onPress}
      style={styles.button}
    >
      <View style={styles.iconSlot}>
        <AnimatedIcon name={item.icon} size={22} active={active} />
      </View>
      <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
        {item.label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
  },
  dock: {
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: PILL_HEIGHT,
    borderRadius: radius.full,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  iconSlot: {
    height: PILL_HEIGHT,
    justifyContent: 'center',
  },
  label: {
    ...type.caption,
    fontSize: 11,
    letterSpacing: 0.1,
    marginTop: 1,
  },
});
