import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { brand, colors, fontSize } from '../../constants/theme';
import { duration, ease, spring } from '../../constants/motion';

type AuthCheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
};

export function AuthCheckbox({ checked, onChange, label }: AuthCheckboxProps) {
  const on = useSharedValue(checked ? 1 : 0);
  const pop = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(checked ? 1 : 0, { duration: duration.fast, easing: ease.out });
    pop.value = withSpring(checked ? 1 : 0, checked ? spring.bouncy : spring.press);
  }, [checked, on, pop]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], ['#FFFFFF', brand.purple]),
    borderColor: interpolateColor(on.value, [0, 1], ['#CFC9DC', brand.purple]),
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    // Starts small rather than from nothing, so the mark reads as growing in.
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.4, 1]) }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={styles.row}
    >
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={markStyle}>
          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
