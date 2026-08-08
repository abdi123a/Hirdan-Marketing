import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { duration, ease } from '../../constants/motion';
import { type } from '../../constants/typography';
import { useTheme } from '../../hooks/useTheme';

export interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Fired by the keyboard's search key. */
  onSubmit?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Search field.
 *
 * Uses its own clear button rather than `clearButtonMode`, which is iOS-only —
 * on Android that prop is silently ignored, leaving no way to empty the field
 * one-handed.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onSubmit,
  autoFocus,
  style,
}: SearchBarProps) {
  const t = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, {
      duration: duration.base,
      easing: ease.out,
    });
  }, [focused, focus]);

  const wrapStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [t.borderSubtle, t.ring]),
    backgroundColor: interpolateColor(focus.value, [0, 1], [t.surfaceSunken, t.card]),
  }));

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <Animated.View style={[styles.wrap, wrapStyle, style]}>
        <Ionicons
          name="search"
          size={18}
          color={focused ? t.ring : t.subtleForeground}
        />

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor={t.subtleForeground}
          style={[styles.input, type.body, { color: t.foreground }]}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {value.length > 0 ? (
          <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              onPress={() => {
                onChangeText('');
                inputRef.current?.focus();
              }}
            >
              <Ionicons name="close-circle" size={18} color={t.subtleForeground} />
            </Pressable>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
});
