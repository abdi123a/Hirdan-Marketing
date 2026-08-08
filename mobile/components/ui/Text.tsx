import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import {
  font,
  toFontWeight,
  type TypeVariant,
  type,
  typeWeight,
} from '../../constants/typography';
import { useTheme } from '../../hooks/useTheme';

type ColorRole =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'primary'
  | 'onPrimary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'inherit';

export interface TextProps extends RNTextProps {
  /**
   * A step on the type scale. Omit to keep whatever size the passed style
   * sets and only take the typeface — which is what lets existing screens
   * adopt Inter without their layout shifting.
   */
  variant?: TypeVariant;
  color?: ColorRole;
  /** Convenience for eyebrows; pairs with `variant="overline"`. */
  uppercase?: boolean;
  /** Centre without reaching for a style object. */
  center?: boolean;
}

/**
 * Every string in the app should render through here.
 *
 * The important part is weight resolution. Android is registered as one `Inter`
 * family with a face per weight, so `fontWeight` resolves natively. iOS instead
 * selects a face by name, and Google's static Inter files keep only Regular and
 * Bold under the `Inter` family — Medium, SemiBold and ExtraBold each declare
 * their own. So a plain `fontWeight: '600'` silently renders as Regular there.
 *
 * This flattens the incoming style, works out the weight actually being asked
 * for, and names the matching face. That means a style written as
 * `{ fontWeight: '700' }` renders as true Inter Bold on both platforms.
 */
export function Text({
  variant,
  color = 'default',
  uppercase,
  center,
  style,
  ...rest
}: TextProps) {
  const t = useTheme();

  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const override = toFontWeight(flat?.fontWeight);
  const weight = override ?? (variant ? typeWeight[variant] : 400);

  const tone =
    color === 'inherit'
      ? undefined
      : color === 'muted'
        ? t.mutedForeground
        : color === 'subtle'
          ? t.subtleForeground
          : color === 'primary'
            ? t.primary
            : color === 'onPrimary'
              ? t.primaryForeground
              : color === 'success'
                ? t.success
                : color === 'warning'
                  ? t.warning
                  : color === 'destructive'
                    ? t.destructive
                    : t.foreground;

  return (
    <RNText
      style={[
        variant ? type[variant] : null,
        // After the variant so an explicit weight in `style` wins, but before
        // `style` itself so everything else the caller set still applies.
        font(weight),
        tone ? { color: tone } : null,
        uppercase ? { textTransform: 'uppercase' } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
