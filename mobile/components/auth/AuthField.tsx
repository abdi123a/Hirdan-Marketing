import React, { forwardRef, useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { brand, colors } from '../../constants/theme';
import { duration, ease } from '../../constants/motion';

const FIELD_HEIGHT = 62;
const INPUT_ROW_HEIGHT = 26;
const INPUT_BOTTOM = 9;
const INPUT_TOP = FIELD_HEIGHT - INPUT_BOTTOM - INPUT_ROW_HEIGHT;
const LABEL_FLOAT_Y = -18;
const LABEL_FLOAT_SCALE = 0.75;

const idle = {
  border: '#E6E2EF',
  background: '#FAFAFC',
  label: '#8F889E',
  icon: '#9B94AB',
};

type AuthFieldProps = Omit<TextInputProps, 'placeholder'> & {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  invalid?: boolean;
  right?: React.ReactNode;
};

/**
 * Text field with a label that doubles as the placeholder and floats out of the
 * way on focus, so the field stays readable without a separate label row.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, icon, invalid = false, right, value, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const float = useSharedValue(value ? 1 : 0);
  const error = useSharedValue(invalid ? 1 : 0);
  const labelWidth = useSharedValue(0);

  const filled = Boolean(value);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: duration.base, easing: ease.out });
  }, [focused, focus]);

  useEffect(() => {
    float.value = withTiming(focused || filled ? 1 : 0, {
      duration: duration.base,
      easing: ease.out,
    });
  }, [focused, filled, float]);

  useEffect(() => {
    error.value = withTiming(invalid ? 1 : 0, { duration: duration.fast, easing: ease.out });
  }, [invalid, error]);

  const boxStyle = useAnimatedStyle(() => {
    const focusBorder = interpolateColor(focus.value, [0, 1], [idle.border, brand.purple]);
    return {
      borderColor: interpolateColor(error.value, [0, 1], [focusBorder, colors.destructive]),
      backgroundColor: interpolateColor(focus.value, [0, 1], [idle.background, '#FFFFFF']),
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: interpolate(focus.value, [0, 1], [0.96, 1]) }],
    borderColor: interpolateColor(
      error.value,
      [0, 1],
      ['rgba(90, 66, 138, 0.16)', 'rgba(229, 62, 62, 0.16)'],
    ),
  }));

  const labelStyle = useAnimatedStyle(() => {
    const scale = interpolate(float.value, [0, 1], [1, LABEL_FLOAT_SCALE]);
    const focusColor = interpolateColor(focus.value, [0, 1], [idle.label, brand.purple]);
    return {
      color: interpolateColor(error.value, [0, 1], [focusColor, colors.destructive]),
      transform: [
        { translateY: interpolate(float.value, [0, 1], [0, LABEL_FLOAT_Y]) },
        // Keeps the left edge pinned while scaling from the centre.
        { translateX: (-labelWidth.value * (1 - scale)) / 2 },
        { scale },
      ],
    };
  });

  const iconIdleStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));
  const iconActiveStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

      <Animated.View style={[styles.box, boxStyle]}>
        {icon ? (
          <View style={styles.icon}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, iconIdleStyle]}>
              <Ionicons name={icon} size={20} color={idle.icon} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, iconActiveStyle]}>
              <Ionicons
                name={icon}
                size={20}
                color={invalid ? colors.destructive : brand.purple}
              />
            </Animated.View>
          </View>
        ) : null}

        <View style={styles.inputWrap}>
          <View pointerEvents="none" style={styles.labelWrap}>
            <Animated.Text
              numberOfLines={1}
              onLayout={(e) => {
                labelWidth.value = e.nativeEvent.layout.width;
              }}
              style={[styles.label, labelStyle]}
            >
              {label}
            </Animated.Text>
          </View>

          <TextInput
            ref={ref}
            value={value}
            style={[styles.input, style]}
            selectionColor={brand.purple}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 18,
    borderWidth: 3.5,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: FIELD_HEIGHT,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  inputWrap: {
    flex: 1,
    height: FIELD_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: INPUT_BOTTOM,
  },
  labelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: INPUT_TOP,
    height: INPUT_ROW_HEIGHT,
    justifyContent: 'center',
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    height: INPUT_ROW_HEIGHT,
    padding: 0,
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  },
  right: {
    marginLeft: 8,
  },
});
