import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'folder-open-outline',
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color={t.mutedForeground} />
      <Text style={[styles.title, { color: t.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.desc, { color: t.mutedForeground }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center' },
  desc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
});
