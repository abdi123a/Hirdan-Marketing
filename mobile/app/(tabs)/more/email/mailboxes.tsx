import React, { useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, SkeletonCard } from '../../../../components/ui';
import { MailboxFormSheet } from '../../../../components/email/MailboxFormSheet';
import { MailboxPermissionsSheet } from '../../../../components/email/MailboxPermissionsSheet';
import { useMailboxMutations, useMailboxes } from '../../../../lib/email/hooks';
import { assetUrl } from '../../../../lib/email/attachmentFetch';
import { useAuthStore } from '../../../../lib/auth-store';
import type { Mailbox } from '../../../../lib/email/types';
import { fontSize, radius, spacing } from '../../../../constants/theme';
import { useTheme } from '../../../../hooks/useTheme';

export default function MailboxesScreen() {
  const t = useTheme();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const { data: mailboxes = [], isLoading, isRefetching, refetch } = useMailboxes();
  const { remove } = useMailboxMutations();
  const [formFor, setFormFor] = useState<Mailbox | null | undefined>(undefined);
  const [permissionsFor, setPermissionsFor] = useState<Mailbox | null>(null);

  const confirmDelete = (mailbox: Mailbox) =>
    Alert.alert(
      `Delete ${mailbox.displayName}?`,
      'Conversations in this mailbox will no longer be reachable from Email Center.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(mailbox.id) },
      ]
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen
        options={{
          title: 'Mailboxes',
          headerRight: () =>
            isAdmin ? (
              <Pressable
                hitSlop={8}
                onPress={() => setFormFor(null)}
                accessibilityLabel="New mailbox"
                style={{ paddingHorizontal: spacing.sm }}
              >
                <Ionicons name="add" size={26} color={t.primary} />
              </Pressable>
            ) : null,
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
        }
      >
        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonCard height={92} />
            <SkeletonCard height={92} />
            <SkeletonCard height={92} />
          </View>
        ) : mailboxes.length === 0 ? (
          <EmptyState
            title="No mailboxes"
            description={
              isAdmin
                ? 'Create a mailbox to start sending and receiving email.'
                : 'Ask an admin to grant you access to a mailbox.'
            }
            actionLabel={isAdmin ? 'New mailbox' : undefined}
            onAction={isAdmin ? () => setFormFor(null) : undefined}
            icon="mail-outline"
          />
        ) : (
          mailboxes.map((mailbox) => {
            const avatar = assetUrl(mailbox.avatarUrl);
            const canManage = isAdmin || mailbox.accessLevel === 'MANAGE';
            return (
              <View
                key={mailbox.id}
                style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <View style={styles.cardHeader}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: `${mailbox.color || '#6366f1'}22`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <Text style={{ color: mailbox.color || '#6366f1', fontWeight: '700' }}>
                        {mailbox.displayName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '700' }}
                      >
                        {mailbox.displayName}
                      </Text>
                      {mailbox.isDefault ? <Tag label="Default" tone={t.primary} /> : null}
                      {!mailbox.isActive ? <Tag label="Inactive" tone={t.mutedForeground} /> : null}
                    </View>
                    <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                      {mailbox.email}
                    </Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
                      {mailbox.department ? `${mailbox.department} · ` : ''}
                      {mailbox.unreadCount ?? 0} unread
                      {mailbox.accessLevel ? ` · ${mailbox.accessLevel.toLowerCase()} access` : ''}
                    </Text>
                  </View>
                </View>

                {canManage ? (
                  <View style={styles.actions}>
                    <CardAction
                      icon="create-outline"
                      label="Edit"
                      onPress={() => setFormFor(mailbox)}
                    />
                    {isAdmin ? (
                      <CardAction
                        icon="people-outline"
                        label="Access"
                        onPress={() => setPermissionsFor(mailbox)}
                      />
                    ) : null}
                    {isAdmin ? (
                      <CardAction
                        icon="trash-outline"
                        label="Delete"
                        destructive
                        onPress={() => confirmDelete(mailbox)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <MailboxFormSheet
        visible={formFor !== undefined}
        onClose={() => setFormFor(undefined)}
        mailbox={formFor ?? null}
      />
      {permissionsFor ? (
        <MailboxPermissionsSheet
          visible
          onClose={() => setPermissionsFor(null)}
          mailbox={permissionsFor}
        />
      ) : null}
    </View>
  );
}

function Tag({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${tone}22` }]}>
      <Text style={{ color: tone, fontSize: 10, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function CardAction({
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
      style={({ pressed }) => [
        styles.action,
        { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={{ color, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  tag: { borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
});
