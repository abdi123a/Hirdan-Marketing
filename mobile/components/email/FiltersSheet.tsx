import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button, Sheet } from '../ui';
import type { SearchFilters } from '../../lib/email/types';

export function countFilters(filters: SearchFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

export function FiltersSheet({
  visible,
  onClose,
  filters,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}) {
  const t = useTheme();
  const active = countFilters(filters);

  return (
    <Sheet visible={visible} onClose={onClose} title="Filters">
      <View style={{ gap: 2 }}>
        <Toggle
          label="Unread only"
          icon="mail-unread-outline"
          active={!!filters.unread}
          onPress={() => onChange({ ...filters, unread: filters.unread ? undefined : true })}
        />
        <Toggle
          label="Has attachment"
          icon="attach-outline"
          active={!!filters.hasAttachment}
          onPress={() =>
            onChange({ ...filters, hasAttachment: filters.hasAttachment ? undefined : true })
          }
        />
        <Toggle
          label="Received"
          icon="download-outline"
          active={filters.direction === 'INBOUND'}
          onPress={() =>
            onChange({
              ...filters,
              direction: filters.direction === 'INBOUND' ? undefined : 'INBOUND',
            })
          }
        />
        <Toggle
          label="Sent by us"
          icon="paper-plane-outline"
          active={filters.direction === 'OUTBOUND'}
          onPress={() =>
            onChange({
              ...filters,
              direction: filters.direction === 'OUTBOUND' ? undefined : 'OUTBOUND',
            })
          }
        />

        {active > 0 ? (
          <Button
            title="Clear filters"
            variant="ghost"
            size="sm"
            onPress={() => onChange({})}
            style={{ marginTop: spacing.sm }}
          />
        ) : (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, marginTop: spacing.sm }}>
            Filters narrow the current folder and search.
          </Text>
        )}
      </View>
    </Sheet>
  );
}

function Toggle({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: active ? t.accent : pressed ? t.muted : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? t.primary : t.mutedForeground} />
      <Text
        style={{
          flex: 1,
          color: active ? t.primary : t.foreground,
          fontSize: fontSize.md,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
      {active ? <Ionicons name="checkmark" size={18} color={t.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
});
