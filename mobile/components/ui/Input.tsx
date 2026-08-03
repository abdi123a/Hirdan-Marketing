import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, spacing, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: t.foreground }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.mutedForeground}
        style={[
          styles.input,
          {
            color: t.foreground,
            backgroundColor: t.card,
            borderColor: error ? t.destructive : t.border,
          },
          style,
        ]}
        {...rest}
      />
      {error ? <Text style={{ color: t.destructive, fontSize: fontSize.xs }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    minHeight: 48,
  },
});
