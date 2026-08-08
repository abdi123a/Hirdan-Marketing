import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Sheet } from '../ui';
import { useLabels } from '../../lib/email/hooks';
import type { EmailFolder, Mailbox } from '../../lib/email/types';

export const FOLDERS: { id: EmailFolder; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'mail-outline' },
  { id: 'starred', label: 'Starred', icon: 'star-outline' },
  { id: 'sent', label: 'Sent', icon: 'paper-plane-outline' },
  { id: 'drafts', label: 'Drafts', icon: 'document-outline' },
  { id: 'scheduled', label: 'Scheduled', icon: 'time-outline' },
  { id: 'outbox', label: 'Outbox', icon: 'arrow-up-circle-outline' },
  { id: 'spam', label: 'Spam', icon: 'shield-outline' },
  { id: 'trash', label: 'Trash', icon: 'trash-outline' },
  { id: 'archived', label: 'Archived', icon: 'archive-outline' },
];

export function folderLabel(folder: EmailFolder): string {
  return FOLDERS.find((f) => f.id === folder)?.label ?? folder;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  folder: EmailFolder;
  onFolder: (folder: EmailFolder) => void;
  mailboxId?: string;
  onMailbox: (mailboxId?: string) => void;
  mailboxes: Mailbox[];
  labelId?: string;
  onLabel: (labelId?: string) => void;
  onManageMailboxes: () => void;
  onManageLabels: () => void;
  onTemplates: () => void;
  onAnalytics: () => void;
}

export function EmailNavSheet({
  visible,
  onClose,
  folder,
  onFolder,
  mailboxId,
  onMailbox,
  mailboxes,
  labelId,
  onLabel,
  onManageMailboxes,
  onManageLabels,
  onTemplates,
  onAnalytics,
}: Props) {
  const t = useTheme();
  const { data: labels = [] } = useLabels();
  const [mailboxesOpen, setMailboxesOpen] = useState(true);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const totalUnread = mailboxes.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);

  return (
    <Sheet visible={visible} onClose={onClose} title="Email">
      <View style={{ gap: spacing.sm }}>
        <View style={{ gap: 2 }}>
          {FOLDERS.map((item) => {
            const active = folder === item.id;
            const badge = item.id === 'inbox' ? totalUnread : 0;
            return (
              <Pressable
                key={item.id}
                onPress={() => onFolder(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? t.accent : pressed ? t.muted : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={19}
                  color={active ? t.primary : t.mutedForeground}
                />
                <Text
                  style={{
                    flex: 1,
                    color: active ? t.primary : t.foreground,
                    fontSize: fontSize.md,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {item.label}
                </Text>
                {badge > 0 ? (
                  <View style={[styles.badge, { backgroundColor: t.primary }]}>
                    <Text style={{ color: t.primaryForeground, fontSize: 10, fontWeight: '700' }}>
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <SectionHeader
          title="Mailboxes"
          open={mailboxesOpen}
          onToggle={() => setMailboxesOpen((v) => !v)}
          onManage={onManageMailboxes}
        />
        {mailboxesOpen ? (
          <View style={{ gap: 2 }}>
            <Pressable
              onPress={() => onMailbox(undefined)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: !mailboxId ? t.accent : pressed ? t.muted : 'transparent' },
              ]}
            >
              <Ionicons name="albums-outline" size={18} color={t.mutedForeground} />
              <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>All mailboxes</Text>
            </Pressable>

            {mailboxes.map((mailbox) => {
              const active = mailboxId === mailbox.id;
              return (
                <Pressable
                  key={mailbox.id}
                  onPress={() => onMailbox(mailbox.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: active ? t.accent : pressed ? t.muted : 'transparent' },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: mailbox.color || '#6366f1' }]} />
                  <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>
                    {mailbox.displayName}
                    {!mailbox.isActive ? ' (off)' : ''}
                  </Text>
                  {(mailbox.unreadCount ?? 0) > 0 ? (
                    <Text style={{ color: t.mutedForeground, fontSize: 11, fontWeight: '700' }}>
                      {mailbox.unreadCount}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {mailboxes.length === 0 ? (
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, paddingHorizontal: spacing.sm }}>
                No mailboxes yet. An admin can add one in Mailboxes.
              </Text>
            ) : null}
          </View>
        ) : null}

        <SectionHeader
          title="Labels"
          open={labelsOpen}
          onToggle={() => setLabelsOpen((v) => !v)}
          onManage={onManageLabels}
        />
        {labelsOpen ? (
          <View style={{ gap: 2 }}>
            {labels.map((label) => {
              const active = labelId === label.id;
              return (
                <Pressable
                  key={label.id}
                  onPress={() => onLabel(active ? undefined : label.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: active ? t.accent : pressed ? t.muted : 'transparent' },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: label.color }]} />
                  <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>
                    {label.name}
                  </Text>
                  {typeof label.count === 'number' && label.count > 0 ? (
                    <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{label.count}</Text>
                  ) : null}
                </Pressable>
              );
            })}
            {labels.length === 0 ? (
              <Pressable onPress={onManageLabels} style={styles.row}>
                <Ionicons name="pricetag-outline" size={16} color={t.mutedForeground} />
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Create a label</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.divider, { borderTopColor: t.border }]}>
          <Pressable
            onPress={onTemplates}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.muted : 'transparent' }]}
          >
            <Ionicons name="albums-outline" size={18} color={t.mutedForeground} />
            <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>Templates</Text>
            <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={onAnalytics}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.muted : 'transparent' }]}
          >
            <Ionicons name="bar-chart-outline" size={18} color={t.mutedForeground} />
            <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>Analytics</Text>
            <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function SectionHeader({
  title,
  open,
  onToggle,
  onManage,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onManage: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.sectionHeader, { borderTopColor: t.border }]}>
      <Pressable onPress={onToggle} style={styles.sectionToggle}>
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={13}
          color={t.mutedForeground}
        />
        <Text style={[styles.sectionTitle, { color: t.mutedForeground }]}>{title}</Text>
      </Pressable>
      <Pressable hitSlop={8} onPress={onManage} accessibilityLabel={`Manage ${title}`}>
        <Ionicons name="settings-outline" size={15} color={t.mutedForeground} />
      </Pressable>
    </View>
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
  badge: { borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 },
  dot: { width: 11, height: 11, borderRadius: 6, marginHorizontal: 3 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  sectionToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
});
