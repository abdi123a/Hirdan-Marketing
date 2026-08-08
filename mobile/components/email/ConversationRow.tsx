import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { displayName, listTime } from '../../lib/email/format';
import type { ConversationSummary } from '../../lib/email/types';
import { EmailAvatar } from './EmailAvatar';
import { LabelChip, MailboxChip } from './StatusBadge';

/** The other side of the thread — never the mailbox itself. */
function counterparty(convo: ConversationSummary): { name: string | null; email: string } {
  const mailboxEmail = convo.mailbox?.email?.toLowerCase();
  const from = convo.participants.find(
    (p) => p.role === 'FROM' && p.email.toLowerCase() !== mailboxEmail
  );
  if (from) return { name: from.name, email: from.email };
  const to = convo.participants.find(
    (p) => p.role === 'TO' && p.email.toLowerCase() !== mailboxEmail
  );
  if (to) return { name: to.name, email: to.email };
  const any =
    convo.participants.find((p) => p.email.toLowerCase() !== mailboxEmail) ?? convo.participants[0];
  return any ? { name: any.name, email: any.email } : { name: null, email: '' };
}

interface Props {
  conversation: ConversationSummary;
  checked: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggleStar: () => void;
}

export function ConversationRow({
  conversation: c,
  checked,
  selectionMode,
  onPress,
  onLongPress,
  onToggleStar,
}: Props) {
  const t = useTheme();
  const party = counterparty(c);
  const unread = c.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: t.border,
          backgroundColor: checked ? t.accent : pressed ? t.muted : t.card,
        },
      ]}
    >
      {unread ? <View style={[styles.unreadBar, { backgroundColor: t.primary }]} /> : null}

      {selectionMode ? (
        <View style={[styles.check, { borderColor: checked ? t.primary : t.border, backgroundColor: checked ? t.primary : 'transparent' }]}>
          {checked ? <Ionicons name="checkmark" size={14} color={t.primaryForeground} /> : null}
        </View>
      ) : (
        <EmailAvatar name={party.name} email={party.email} size={38} />
      )}

      <View style={styles.body}>
        <View style={styles.line}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: t.foreground,
              fontSize: fontSize.sm,
              fontWeight: unread ? '700' : '500',
            }}
          >
            {displayName(party.name, party.email)}
          </Text>
          {c.messageCount > 1 ? (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{c.messageCount}</Text>
          ) : null}
          <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{listTime(c.lastMessageAt)}</Text>
          <Pressable
            hitSlop={8}
            onPress={onToggleStar}
            accessibilityRole="button"
            accessibilityLabel={c.isStarred ? 'Unstar conversation' : 'Star conversation'}
          >
            <Ionicons
              name={c.isStarred ? 'star' : 'star-outline'}
              size={15}
              color={c.isStarred ? '#F59E0B' : t.mutedForeground}
            />
          </Pressable>
        </View>

        <View style={styles.line}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: t.foreground,
              fontSize: 13,
              fontWeight: unread ? '600' : '400',
            }}
          >
            {c.subject || '(no subject)'}
          </Text>
          {c.hasAttachment ? (
            <Ionicons name="attach" size={13} color={t.mutedForeground} />
          ) : null}
        </View>

        {c.snippet ? (
          <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            {c.snippet}
          </Text>
        ) : null}

        <View style={styles.chips}>
          {c.mailbox ? <MailboxChip name={c.mailbox.displayName} color={c.mailbox.color} /> : null}
          {c.labels.map((l) => (
            <LabelChip key={l.labelId} name={l.label.name} color={l.label.color} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  check: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
