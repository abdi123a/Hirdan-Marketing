import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

interface ButtonProps extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function Button({
  title,
  loading,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const t = useTheme();
  const bg =
    variant === 'primary'
      ? t.primary
      : variant === 'secondary'
        ? t.secondary
        : variant === 'destructive'
          ? t.destructive
          : variant === 'outline' || variant === 'ghost'
            ? 'transparent'
            : t.primary;
  const fg =
    variant === 'secondary'
      ? t.secondaryForeground
      : variant === 'outline' || variant === 'ghost'
        ? t.primary
        : variant === 'destructive'
          ? t.destructiveForeground
          : t.primaryForeground;

  const padV = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const padH = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;
  const fs = size === 'sm' ? fontSize.sm : size === 'lg' ? fontSize.lg : fontSize.md;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: t.primary,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: fs, fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
