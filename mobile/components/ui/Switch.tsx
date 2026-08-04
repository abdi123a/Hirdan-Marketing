import React from 'react';
import { Switch as RNSwitch, StyleSheet, Text, View } from 'react-native';
import { fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
  description,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
        {description ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{description}</Text>
        ) : null}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: t.border, true: t.primary + '88' }}
        thumbColor={value ? t.primary : t.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
});
