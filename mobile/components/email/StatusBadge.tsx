import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { radius } from '../../constants/theme';
import { statusStyle } from '../../lib/email/status';
import type { EmailStatus } from '../../lib/email/types';

export function StatusBadge({ status, small }: { status: EmailStatus; small?: boolean }) {
  const style = statusStyle(status);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: style.bg,
          paddingHorizontal: small ? 5 : 7,
          paddingVertical: small ? 1 : 2,
        },
      ]}
    >
      <Text style={{ color: style.fg, fontSize: small ? 9 : 10, fontWeight: '700' }}>
        {style.label}
      </Text>
    </View>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, paddingHorizontal: 6, paddingVertical: 2 }]}>
      <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{name}</Text>
    </View>
  );
}

export function MailboxChip({ name, color }: { name: string; color?: string | null }) {
  const dot = color || '#6366f1';
  return (
    <View
      style={[
        styles.badge,
        styles.mailbox,
        { backgroundColor: `${dot}1F`, paddingHorizontal: 6, paddingVertical: 2 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={{ color: dot, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
  },
  mailbox: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 150 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
