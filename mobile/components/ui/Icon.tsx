import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import createIconSet from '@expo/vector-icons/createIconSet';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import glyphMap from '../../assets/fonts/material-symbols.json';
import { duration, ease, spring } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';

/**
 * Google's Material Symbols — the 2021 redesign, not the older Material Icons
 * or the community set, both of which read as mid-2010s.
 *
 * Loaded through `createIconSet`, the same mechanism the built-in sets use: the
 * font travels as a JS asset and expo-font registers it at runtime. An earlier
 * attempt registered it natively through a config plugin, which broke badly
 * whenever the plugin hadn't been applied — Android fell back to a CJK font
 * that also occupies the private-use codepoints, so every icon rendered as a
 * Chinese character. Going through the asset pipeline removes that failure
 * mode: if the font is in the bundle, it is in the app.
 *
 * `material-symbols.json` is generated from the font's own `post` and `cmap`
 * tables, so a name that type-checks is guaranteed to exist in the shipped
 * file.
 */
const MaterialSymbols = createIconSet(
  glyphMap as Record<string, number>,
  'MaterialSymbols',
  require('../../assets/fonts/MaterialSymbols.ttf'),
);

export type IconName = keyof typeof glyphMap;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 22, color, style }: IconProps) {
  const t = useTheme();
  return (
    <MaterialSymbols
      name={name as string}
      size={size}
      color={color ?? t.foreground}
      // Icons must not grow with the OS font scale — a scaled glyph breaks out
      // of the fixed box its layout reserves.
      allowFontScaling={false}
      style={style}
    />
  );
}

export interface AnimatedIconProps {
  name: IconName;
  size?: number;
  color?: string;
  activeColor?: string;
  active: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Icon that emphasises itself when selected.
 *
 * Material Symbols expresses selection through its FILL axis, which React
 * Native cannot drive — it has no variable-font support. So selection is
 * carried by colour and a single scale nudge instead, which is what Google's
 * own apps fall back to when fill isn't animatable.
 */
export function AnimatedIcon({
  name,
  size = 24,
  color,
  activeColor,
  active,
  style,
}: AnimatedIconProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = reduceMotion
      ? active
        ? 1
        : 0
      : withTiming(active ? 1 : 0, { duration: duration.base, easing: ease.out });

    if (!reduceMotion && active) {
      scale.value = withSpring(1.12, spring.press, () => {
        scale.value = withSpring(1, spring.press);
      });
    }
  }, [active, progress, scale, reduceMotion]);

  const restStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const groupStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, groupStyle, style]}>
      <Animated.View style={[styles.layer, restStyle]}>
        <Icon name={name} size={size} color={color ?? t.mutedForeground} />
      </Animated.View>
      <Animated.View style={[styles.layer, activeStyle]}>
        <Icon name={name} size={size} color={activeColor ?? t.primary} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
