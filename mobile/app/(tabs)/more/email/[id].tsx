import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ConversationSkeleton, Select, Sheet } from '../../../../components/ui';
import { CustomerSheet } from '../../../../components/email/CustomerSheet';
import { LabelManagerSheet, LabelPickerSheet } from '../../../../components/email/LabelSheets';
import { LabelChip } from '../../../../components/email/StatusBadge';
import { MessageItem } from '../../../../components/email/MessageItem';
import { NotesPanel } from '../../../../components/email/NotesPanel';
import { ReplyBox } from '../../../../components/email/ReplyBox';
import { useConversation, useConversationActions } from '../../../../lib/email/hooks';
import { useEmailLive } from '../../../../lib/email/useEmailLive';
import { useComposeStore } from '../../../../lib/email/compose-store';
import { afterSheetClose } from '../../../../lib/email/sheet-handoff';
import { CONVERSATION_STATUS_LABELS } from '../../../../lib/email/status';
import type { ConversationStatus, EmailMessage } from '../../../../lib/email/types';
import { fontSize, radius, spacing } from '../../../../constants/theme';
import { useTheme } from '../../../../hooks/useTheme';

const STATUS_OPTIONS = (Object.keys(CONVERSATION_STATUS_LABELS) as ConversationStatus[]).map(
  (status) => ({ value: status, label: CONVERSATION_STATUS_LABELS[status] })
);

/** Quoted body for a forward, matching the web Email Center. */
function forwardHtml(email: EmailMessage): string {
  return `<br/><br/><div style="border-left:3px solid #e2e8f0;padding-left:12px;color:#475569">
    ---------- Forwarded message ----------<br/>
    From: ${email.fromName || ''} &lt;${email.fromEmail}&gt;<br/>
    Subject: ${email.subject || ''}<br/>
    To: ${(email.toEmails ?? []).join(', ')}<br/><br/>
    ${email.html || email.text || ''}
  </div>`;
}

export default function ConversationScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = String(id);
  const setComposeInitial = useComposeStore((s) => s.setInitial);

  const { data: conversation, isLoading, isRefetching, refetch, error } = useConversation(conversationId);
  const { markRead, markUnread, patch, action } = useConversationActions();
  const [moreOpen, setMoreOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  useEmailLive({ conversationId });

  // Opening a thread with unread messages marks it read, as on the web.
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <Stack.Screen options={{ title: 'Conversation' }} />
        <ConversationSkeleton />
      </View>
    );
  }

  if (error || !conversation) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <Stack.Screen options={{ title: 'Conversation' }} />
        <EmptyState
          title="Could not load conversation"
          description={(error as Error | undefined)?.message ?? 'This thread is no longer available.'}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="mail-outline"
        />
      </View>
    );
  }

  const lastEmail = conversation.emails[conversation.emails.length - 1];
  const inTrash = !!conversation.deletedAt;

  const forward = () => {
    if (!lastEmail) return;
    setMoreOpen(false);
    setComposeInitial({
      mailboxId: lastEmail.mailboxId,
      subject: `Fwd: ${lastEmail.subject || ''}`,
      html: forwardHtml(lastEmail),
    });
    router.push('/(tabs)/more/email/compose');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen
        options={{
          title: conversation.subject || '(no subject)',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  patch.mutate({ id: conversation.id, data: { isStarred: !conversation.isStarred } })
                }
                accessibilityLabel={conversation.isStarred ? 'Unstar' : 'Star'}
              >
                <Ionicons
                  name={conversation.isStarred ? 'star' : 'star-outline'}
                  size={22}
                  color={conversation.isStarred ? '#F59E0B' : t.foreground}
                />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setMoreOpen(true)} accessibilityLabel="More actions">
                <Ionicons name="ellipsis-vertical" size={22} color={t.foreground} />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '700' }}>
            {conversation.subject || '(no subject)'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <View
                style={[styles.dot, { backgroundColor: conversation.mailbox.color || '#6366f1' }]}
              />
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {conversation.mailbox.displayName}
              </Text>
            </View>
            {conversation.client ? (
              <Pressable
                style={styles.metaItem}
                onPress={() => router.push(`/client/${conversation.client!.id}`)}
              >
                <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '600' }}>
                  {conversation.client.name}
                </Text>
                <Ionicons name="open-outline" size={12} color={t.primary} />
              </Pressable>
            ) : null}
            {conversation.labels.map((label) => (
              <LabelChip key={label.labelId} name={label.label.name} color={label.label.color} />
            ))}
          </View>

          <Select
            label="Status"
            value={conversation.status}
            options={STATUS_OPTIONS}
            onChange={(value) => patch.mutate({ id: conversation.id, data: { status: value } })}
          />

          <View style={styles.quickActions}>
            <QuickAction icon="pricetag-outline" label="Labels" onPress={() => setLabelsOpen(true)} />
            <QuickAction icon="person-outline" label="Customer" onPress={() => setCustomerOpen(true)} />
            {lastEmail ? (
              <QuickAction icon="arrow-redo-outline" label="Forward" onPress={forward} />
            ) : null}
          </View>
        </View>

        {conversation.emails.map((email, index) => (
          <MessageItem
            key={email.id}
            email={email}
            defaultOpen={index === conversation.emails.length - 1}
          />
        ))}

        <NotesPanel conversationId={conversation.id} notes={conversation.notes} />

        {!inTrash ? (
          <ReplyBox
            conversationId={conversation.id}
            signature={conversation.mailbox.signature}
            onSent={() => refetch()}
          />
        ) : (
          <View style={[styles.trashNote, { borderColor: t.border, backgroundColor: t.muted }]}>
            <Ionicons name="trash-outline" size={15} color={t.mutedForeground} />
            <Text style={{ flex: 1, color: t.mutedForeground, fontSize: fontSize.xs }}>
              This conversation is in the trash. Restore it to reply.
            </Text>
          </View>
        )}
      </ScrollView>

      <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="Conversation">
        <View style={{ gap: 2 }}>
          {conversation.unreadCount > 0 ? (
            <SheetAction
              icon="mail-open-outline"
              label="Mark as read"
              onPress={() => {
                markRead.mutate(conversation.id);
                setMoreOpen(false);
              }}
            />
          ) : (
            <SheetAction
              icon="mail-unread-outline"
              label="Mark as unread"
              onPress={() => {
                markUnread.mutate(conversation.id);
                setMoreOpen(false);
                router.back();
              }}
            />
          )}

          {inTrash ? (
            <SheetAction
              icon="refresh-outline"
              label="Restore"
              onPress={() => {
                action.mutate({ id: conversation.id, action: 'restore' });
                setMoreOpen(false);
              }}
            />
          ) : (
            <>
              <SheetAction
                icon="archive-outline"
                label={conversation.isArchived ? 'Unarchive' : 'Archive'}
                onPress={() => {
                  action.mutate({
                    id: conversation.id,
                    action: conversation.isArchived ? 'unarchive' : 'archive',
                  });
                  setMoreOpen(false);
                }}
              />
              <SheetAction
                icon="shield-outline"
                label={conversation.isSpam ? 'Not spam' : 'Mark as spam'}
                onPress={() => {
                  action.mutate({
                    id: conversation.id,
                    action: conversation.isSpam ? 'not-spam' : 'spam',
                  });
                  setMoreOpen(false);
                }}
              />
              <SheetAction
                icon="trash-outline"
                label="Delete"
                destructive
                onPress={() => {
                  action.mutate({ id: conversation.id, action: 'trash' });
                  setMoreOpen(false);
                  router.back();
                }}
              />
            </>
          )}
        </View>
      </Sheet>

      <LabelPickerSheet
        visible={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        conversationId={conversation.id}
        appliedLabelIds={conversation.labels.map((label) => label.labelId)}
        onManage={() => {
          setLabelsOpen(false);
          afterSheetClose(() => setLabelManagerOpen(true));
        }}
      />
      <LabelManagerSheet visible={labelManagerOpen} onClose={() => setLabelManagerOpen(false)} />
      <CustomerSheet
        visible={customerOpen}
        onClose={() => setCustomerOpen(false)}
        conversationId={conversation.id}
      />
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={16} color={t.primary} />
      <Text style={{ color: t.foreground, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const t = useTheme();
  const color = destructive ? t.destructive : t.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetAction, { backgroundColor: pressed ? t.accent : 'transparent' }]}
    >
      <Ionicons name={icon} size={19} color={color} />
      <Text
        style={{
          color: destructive ? t.destructive : t.foreground,
          fontSize: fontSize.md,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  trashNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
