import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
import { brand, fontSize } from '../../constants/theme';
import { duration, ease, spring } from '../../constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'ghost';
  style?: StyleProp<ViewStyle>;
};

const palette = {
  primary: { rest: brand.purple, pressed: brand.purpleDeep, content: '#FFFFFF' },
  ghost: { rest: '#FFFFFF', pressed: '#F1EEF8', content: brand.purple },
};

/**
 * Primary action button. Reacts on press-down rather than release, and swaps
 * its label for a spinner without changing size so nothing shifts around it.
 */
export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'primary',
  style,
}: AuthButtonProps) {
  const tone = palette[variant];
  const press = useSharedValue(0);
  const busy = useSharedValue(loading ? 1 : 0);
  const inactive = useSharedValue(disabled ? 1 : 0);

  useEffect(() => {
    busy.value = withTiming(loading ? 1 : 0, { duration: duration.base, easing: ease.out });
  }, [loading, busy]);

  useEffect(() => {
    inactive.value = withTiming(disabled ? 1 : 0, { duration: duration.fast, easing: ease.out });
  }, [disabled, inactive]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.value, [0, 1], [tone.rest, tone.pressed]),
    opacity: interpolate(inactive.value, [0, 1], [1, 0.55]),
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.975]) }],
  }));

  const labelLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - busy.value,
    transform: [{ scale: interpolate(busy.value, [0, 1], [1, 0.94]) }],
  }));

  const spinnerLayerStyle = useAnimatedStyle(() => ({
    opacity: busy.value,
    transform: [{ scale: interpolate(busy.value, [0, 1], [0.94, 1]) }],
  }));

  const blocked = loading || disabled;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPressIn={() => {
        press.value = withSpring(1, spring.press);
        void Haptics.selectionAsync();
      }}
      onPressOut={() => {
        press.value = withSpring(0, spring.press);
      }}
      onPress={onPress}
      style={[styles.base, variant === 'ghost' && styles.ghost, containerStyle, style]}
    >
      <Animated.View style={[styles.layer, labelLayerStyle]}>
        <Text style={[styles.label, { color: tone.content }]}>{label}</Text>
        {icon ? <Ionicons name={icon} size={18} color={tone.content} /> : null}
      </Animated.View>

      <Animated.View style={[styles.layer, spinnerLayerStyle]}>
        <ActivityIndicator color={tone.content} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ghost: {
    borderWidth: 1.5,
    borderColor: '#E3DFEC',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
