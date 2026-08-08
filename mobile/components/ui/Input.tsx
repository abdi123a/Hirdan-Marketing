import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing } from '../../constants/theme';
import { duration, ease } from '../../constants/motion';
import { type } from '../../constants/typography';
import { useTheme } from '../../hooks/useTheme';
import { Text } from './Text';

/**
 * Derived from the props rather than written out: RN 0.86 narrowed these from
 * `NativeSyntheticEvent<TextInputFocusEventData>` to dedicated `FocusEvent` /
 * `BlurEvent` types, so naming them directly breaks on upgrade.
 */
type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Helper copy under the field. Hidden while an error is showing. */
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing affordance — a unit, a clear button, a visibility toggle. */
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Text field with an animated focus ring.
 *
 * The border and background cross-fade on focus rather than snapping, which is
 * what makes a form feel responsive. The field sits on the sunken surface so
 * it reads as carved into the card rather than stacked on top of it.
 */
export function Input({
  label,
  error,
  hint,
  icon,
  right,
  style,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: InputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const inputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, {
      duration: duration.base,
      easing: ease.out,
    });
  }, [focused, focus]);

  const handleFocus = useCallback<FocusHandler>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback<BlurHandler>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  // An error outranks focus: a red field that turns purple when tapped would
  // hide the thing the user still has to fix.
  const restingBorder = error ? t.destructive : t.border;
  const activeBorder = error ? t.destructive : t.ring;

  const fieldStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [restingBorder, activeBorder]),
    backgroundColor: interpolateColor(focus.value, [0, 1], [t.surfaceSunken, t.card]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: focus.value * (error ? 0 : 1),
  }));

  const iconColor = useDerivedValue(() => focus.value);
  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + iconColor.value * 0.45,
  }));

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text variant="label" color={error ? 'destructive' : 'muted'}>
          {label}
        </Text>
      ) : null}

      <Pressable onPress={() => inputRef.current?.focus()} disabled={!editable}>
        <View>
          {/* Soft ring outside the border — reads as a glow rather than a
              second, heavier outline. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: t.ring }, glowStyle]}
          />
          <Animated.View
            style={[
              styles.field,
              fieldStyle,
              !editable ? { opacity: 0.6 } : null,
            ]}
          >
            {icon ? (
              <Animated.View style={iconStyle}>
                <Ionicons
                  name={icon}
                  size={18}
                  color={error ? t.destructive : focused ? t.ring : t.mutedForeground}
                />
              </Animated.View>
            ) : null}

            <TextInput
              ref={inputRef}
              placeholderTextColor={t.subtleForeground}
              selectionColor={t.ring}
              editable={editable}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={[styles.input, type.body, { color: t.foreground }, style]}
              {...rest}
            />

            {right}
          </Animated.View>
        </View>
      </Pressable>

      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: radius.md + 3,
    borderWidth: 3,
    opacity: 0,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    // Android adds its own inner padding that misaligns the text vertically.
    paddingHorizontal: 0,
  },
});
