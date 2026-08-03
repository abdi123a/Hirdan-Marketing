import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function Badge({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'gold';
}) {
  const t = useTheme();
  const bg =
    tone === 'success'
      ? t.success + '22'
      : tone === 'warning'
        ? t.warning + '22'
        : tone === 'destructive'
          ? t.destructive + '22'
          : tone === 'gold'
            ? t.secondary + '33'
            : t.accent;
  const fg =
    tone === 'success'
      ? t.success
      : tone === 'warning'
        ? t.warning
        : tone === 'destructive'
          ? t.destructive
          : tone === 'gold'
            ? t.secondaryForeground
            : t.accentForeground;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: fontSize.xs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
