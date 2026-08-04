import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { brand, radius, spacing } from '../../constants/theme';
import { duration, ease, spring } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { usePermissions } from '../../hooks/usePermissions';
import { TAB_ITEMS, type TabItem } from './tabs';

const ICON_SIZE = 21;
const PILL_WIDTH = 58;
const PILL_HEIGHT = 34;

/**
 * Bottom navigation for the `(tabs)` group.
 *
 * The selected tab is marked three ways that all resolve to the same place: a
 * capsule that slides between slots, an outline icon that cross-fades to its
 * filled twin, and the label taking on the brand colour. The capsule is the
 * only thing that travels, so switching tabs reads as one object moving rather
 * than two states swapping.
 */
export function BottomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const t = useTheme();
  const { canRead } = usePermissions();
  const reduceMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);

  const activeKey = state.routes[state.index]?.key;

  // Driven by TAB_ITEMS rather than route order so the order on screen is
  // deliberate. Routes missing from the config never get a button.
  const items = TAB_ITEMS.flatMap((item) => {
    const route = state.routes.find((r) => r.name === item.name);
    return route && item.isVisible(canRead) ? [{ item, route }] : [];
  });

  const activeIndex = items.findIndex(({ route }) => route.key === activeKey);
  const slotWidth = items.length > 0 ? rowWidth / items.length : 0;

  const pill = useSharedValue(activeIndex);
  // Permissions hydrate after mount, so the first tab set can arrive late. The
  // capsule only travels once it already has a slot to travel from.
  const placed = useRef(false);

  useEffect(() => {
    if (activeIndex < 0) {
      placed.current = false;
      return;
    }
    pill.value = reduceMotion || !placed.current ? activeIndex : withSpring(activeIndex, spring.move);
    placed.current = true;
  }, [activeIndex, reduceMotion, pill]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pill.value * slotWidth + (slotWidth - PILL_WIDTH) / 2 }],
  }));

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.card,
          borderTopColor: t.border,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={styles.row}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
      >
        {slotWidth > 0 && activeIndex >= 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { backgroundColor: t.accent }, pillStyle]}
          />
        ) : null}

        {items.map(({ item, route }) => (
          <TabButton
            key={route.key}
            item={item}
            focused={route.key === activeKey}
            badge={descriptors[route.key]?.options.tabBarBadge}
            testID={descriptors[route.key]?.options.tabBarButtonTestID}
            accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (route.key === activeKey || event.defaultPrevented) return;
              void Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({
  item,
  focused,
  badge,
  testID,
  accessibilityLabel,
  onPress,
  onLongPress,
}: {
  item: TabItem;
  focused: boolean;
  badge?: number | string;
  testID?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const focus = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: duration.base, easing: ease.out });
  }, [focused, focus]);

  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : interpolate(press.value, [0, 1], [1, 0.92]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : interpolate(focus.value, [0, 1], [1, 1.06]) }],
  }));

  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.value, [0, 1], [t.mutedForeground, t.primary]),
  }));

  return (
    <Pressable
      accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? item.label}
      testID={testID}
      onPressIn={() => {
        press.value = withSpring(1, spring.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, spring.press);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.button}
    >
      <Animated.View style={[styles.group, groupStyle]}>
        <View style={styles.iconSlot}>
          <Animated.View style={[styles.iconBox, iconStyle]}>
            <Animated.View style={[styles.iconLayer, outlineStyle]}>
              <Ionicons name={item.icon} size={ICON_SIZE} color={t.mutedForeground} />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, filledStyle]}>
              <Ionicons name={item.iconActive} size={ICON_SIZE} color={t.primary} />
            </Animated.View>

            {badge !== undefined && badge !== null ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </View>

        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {item.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    shadowColor: '#4A2F8A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: radius.full,
  },
  button: {
    flex: 1,
    alignItems: 'center',
  },
  group: {
    alignItems: 'center',
  },
  iconSlot: {
    height: PILL_HEIGHT,
    justifyContent: 'center',
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    left: ICON_SIZE - 6,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.gold,
  },
  badgeText: {
    color: brand.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    // Small type reads better with a touch of extra tracking.
    letterSpacing: 0.2,
    fontWeight: '600',
  },
});
