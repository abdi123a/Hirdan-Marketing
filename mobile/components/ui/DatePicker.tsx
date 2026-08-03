import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, fontSize, radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

/** Simple date field — taps open native date prompt via text entry fallback */
export function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
      <Pressable
        style={[styles.field, { borderColor: t.border, backgroundColor: t.card }]}
        onPress={() => {
          // Keep ISO YYYY-MM-DD; screens can pair with a modal later
          const next = value || new Date().toISOString().slice(0, 10);
          onChange(next);
        }}
      >
        <Text style={{ color: value ? t.foreground : t.mutedForeground, fontSize: fontSize.md }}>
          {value || 'Select date'}
        </Text>
      </Pressable>
      {Platform.OS === 'web' ? null : (
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
          Format: YYYY-MM-DD (edit on detail forms)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
});
