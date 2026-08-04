import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { EmptyState, SearchBar, ListSkeleton, SkeletonListRow } from '../../../../components/ui';
import { ConversationRow } from '../../../../components/email/ConversationRow';
import { EmailNavSheet, folderLabel } from '../../../../components/email/EmailNavSheet';
import { FiltersSheet, countFilters } from '../../../../components/email/FiltersSheet';
import { LabelManagerSheet } from '../../../../components/email/LabelSheets';
import { StatusBadge } from '../../../../components/email/StatusBadge';
import { emailApi } from '../../../../lib/email/api';
import {
  useConversationActions,
  useDrafts,
  useLabels,
  useMailConfigIssue,
  useMailboxes,
  useOutbox,
  useOutboxActions,
  useScheduled,
} from '../../../../lib/email/hooks';
import { useEmailLive } from '../../../../lib/email/useEmailLive';
import { useComposeStore } from '../../../../lib/email/compose-store';
import { afterSheetClose } from '../../../../lib/email/sheet-handoff';
import { displayName, listTime } from '../../../../lib/email/format';
import type {
  Draft,
  EmailFolder,
  EmailMessage,
  SearchFilters,
} from '../../../../lib/email/types';
import { fontSize, radius, spacing } from '../../../../constants/theme';
import { useTheme } from '../../../../hooks/useTheme';

const CONVERSATION_FOLDERS: EmailFolder[] = [
  'inbox',
  'sent',
  'spam',
  'trash',
  'starred',
  'archived',
];

const PAGE_SIZE = 30;

export default function EmailInboxScreen() {
  const t = useTheme();
  const router = useRouter();
  const setComposeInitial = useComposeStore((s) => s.setInitial);

  const [folder, setFolder] = useState<EmailFolder>('inbox');
  const [mailboxId, setMailboxId] = useState<string | undefined>();
  const [labelId, setLabelId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);

  const { data: mailboxes = [] } = useMailboxes();
  const { data: labels = [] } = useLabels();
  const { bulk } = useConversationActions();
  const mailConfigIssue = useMailConfigIssue();
  useEmailLive();

  const activeLabel = labels.find((l) => l.id === labelId);
  const filtersKey = JSON.stringify(filters);
  const activeFilterCount = countFilters(filters);
  const isConversationFolder = CONVERSATION_FOLDERS.includes(folder);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    setChecked(new Set());
  }, [folder, mailboxId, search, labelId, filtersKey]);

  const infinite = useInfiniteQuery({
    queryKey: [
      'email',
      'conversations',
      'infinite',
      folder,
      mailboxId ?? 'all',
      search,
      labelId ?? '',
      filtersKey,
    ],
    enabled: isConversationFolder,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      emailApi.listConversations({
        folder,
        mailboxId,
        q: search,
        labelId,
        filters,
        limit: PAGE_SIZE,
        offset: pageParam as number,
      }),
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((count, page) => count + page.conversations.length, 0) : undefined,
  });

  const conversations = useMemo(
    () => infinite.data?.pages.flatMap((page) => page.conversations) ?? [],
    [infinite.data]
  );

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked =
    conversations.length > 0 && conversations.every((conversation) => checked.has(conversation.id));

  const runBulk = async (action: string) => {
    await bulk.mutateAsync({ ids: [...checked], action });
    setChecked(new Set());
    infinite.refetch();
  };

  const openCompose = (initial?: Parameters<typeof setComposeInitial>[0]) => {
    setComposeInitial(initial ?? null);
    router.push('/(tabs)/more/email/compose');
  };

  const openDraft = (draft: Draft) =>
    openCompose({
      mailboxId: draft.mailboxId ?? undefined,
      to: draft.toEmails ?? [],
      cc: draft.ccEmails ?? [],
      subject: draft.subject ?? '',
      html: draft.html ?? '',
      draftId: draft.id,
    });

  const selectionMode = checked.size > 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen
        options={{
          title: folderLabel(folder),
          headerLeft: () => (
            <Pressable
              hitSlop={8}
              onPress={() => setNavOpen(true)}
              accessibilityLabel="Email folders"
              style={{ paddingHorizontal: spacing.sm }}
            >
              <Ionicons name="menu" size={24} color={t.foreground} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              hitSlop={8}
              onPress={() => openCompose()}
              accessibilityLabel="Compose email"
              style={{ paddingHorizontal: spacing.sm }}
            >
              <Ionicons name="create-outline" size={23} color={t.primary} />
            </Pressable>
          ),
        }}
      />

      {mailConfigIssue ? (
        <View style={[styles.banner, { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={{ flex: 1, color: '#92400E', fontSize: fontSize.xs, lineHeight: 17 }}>
            {mailConfigIssue}
          </Text>
        </View>
      ) : null}

      {selectionMode ? (
        <View style={[styles.bulkBar, { backgroundColor: t.card, borderBottomColor: t.border }]}>
          <Pressable hitSlop={8} onPress={() => setChecked(new Set())} accessibilityLabel="Clear selection">
            <Ionicons name="close" size={22} color={t.foreground} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() =>
              setChecked(
                allChecked ? new Set() : new Set(conversations.map((conversation) => conversation.id))
              )
            }
            accessibilityLabel={allChecked ? 'Deselect all' : 'Select all'}
          >
            <Ionicons
              name={allChecked ? 'checkbox' : 'square-outline'}
              size={21}
              color={allChecked ? t.primary : t.mutedForeground}
            />
          </Pressable>
          <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
            {checked.size} selected
          </Text>
          <BulkAction icon="mail-open-outline" label="Mark read" onPress={() => runBulk('read')} />
          <BulkAction icon="star-outline" label="Star" onPress={() => runBulk('star')} />
          <BulkAction icon="archive-outline" label="Archive" onPress={() => runBulk('archive')} />
          <BulkAction icon="shield-outline" label="Spam" onPress={() => runBulk('spam')} />
          <BulkAction icon="trash-outline" label="Trash" onPress={() => runBulk('trash')} />
        </View>
      ) : (
        <View style={[styles.toolbar, { backgroundColor: t.card, borderBottomColor: t.border }]}>
          <View style={{ flex: 1 }}>
            <SearchBar value={input} onChangeText={setInput} placeholder="Search mail" />
          </View>
          {isConversationFolder ? (
            <Pressable
              hitSlop={8}
              onPress={() => setFiltersOpen(true)}
              accessibilityLabel="Filters"
              style={styles.filterButton}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color={activeFilterCount > 0 ? t.primary : t.mutedForeground}
              />
              {activeFilterCount > 0 ? (
                <View style={[styles.filterCount, { backgroundColor: t.primary }]}>
                  <Text style={{ color: t.primaryForeground, fontSize: 9, fontWeight: '700' }}>
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      )}

      {activeLabel || mailboxId ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.contextRow, { backgroundColor: t.card, borderBottomColor: t.border }]}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' }}
        >
          {mailboxId ? (
            <ContextChip
              label={mailboxes.find((m) => m.id === mailboxId)?.displayName ?? 'Mailbox'}
              color={mailboxes.find((m) => m.id === mailboxId)?.color ?? undefined}
              onClear={() => setMailboxId(undefined)}
            />
          ) : null}
          {activeLabel ? (
            <ContextChip
              label={activeLabel.name}
              color={activeLabel.color}
              onClear={() => setLabelId(undefined)}
            />
          ) : null}
        </ScrollView>
      ) : null}

      {isConversationFolder ? (
        infinite.isLoading ? (
          <LoadingList />
        ) : infinite.error ? (
          <EmptyState
            title="Could not load mail"
            description={(infinite.error as Error).message}
            actionLabel="Retry"
            onAction={() => infinite.refetch()}
            icon="mail-outline"
          />
        ) : (
          <FlashList
            data={conversations}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={infinite.isRefetching && !infinite.isFetchingNextPage}
                onRefresh={() => infinite.refetch()}
                tintColor={t.primary}
              />
            }
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (infinite.hasNextPage && !infinite.isFetchingNextPage) infinite.fetchNextPage();
            }}
            ListEmptyComponent={
              <EmptyState
                title={search || activeFilterCount ? 'No matching mail' : 'Nothing here'}
                description={
                  search || activeFilterCount
                    ? 'Try a different search or clear the filters'
                    : `${folderLabel(folder)} is empty`
                }
                icon="mail-open-outline"
              />
            }
            ListFooterComponent={
              infinite.isFetchingNextPage ? (
                <SkeletonListRow />
              ) : !infinite.hasNextPage && conversations.length > 8 ? (
                <Text style={[styles.endOfList, { color: t.mutedForeground }]}>End of list</Text>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 96 }}
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                checked={checked.has(item.id)}
                selectionMode={selectionMode}
                onPress={() =>
                  selectionMode
                    ? toggleCheck(item.id)
                    : router.push(`/(tabs)/more/email/${item.id}`)
                }
                onLongPress={() => toggleCheck(item.id)}
                onToggleStar={async () => {
                  await emailApi.patchConversation(item.id, { isStarred: !item.isStarred });
                  infinite.refetch();
                }}
              />
            )}
          />
        )
      ) : folder === 'drafts' ? (
        <DraftList onOpenDraft={openDraft} />
      ) : (
        <QueuedList kind={folder === 'scheduled' ? 'scheduled' : 'outbox'} />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compose email"
        onPress={() => openCompose()}
        style={[styles.fab, { backgroundColor: t.primary }]}
      >
        <Ionicons name="create-outline" size={26} color={t.primaryForeground} />
      </Pressable>

      <EmailNavSheet
        visible={navOpen}
        onClose={() => setNavOpen(false)}
        folder={folder}
        onFolder={(next) => {
          setFolder(next);
          setLabelId(undefined);
          setNavOpen(false);
        }}
        mailboxId={mailboxId}
        onMailbox={(next) => {
          setMailboxId(next);
          setNavOpen(false);
        }}
        mailboxes={mailboxes}
        labelId={labelId}
        onLabel={(next) => {
          setLabelId(next);
          setNavOpen(false);
        }}
        onManageMailboxes={() => {
          setNavOpen(false);
          router.push('/(tabs)/more/email/mailboxes');
        }}
        onManageLabels={() => {
          setNavOpen(false);
          afterSheetClose(() => setLabelManagerOpen(true));
        }}
        onTemplates={() => {
          setNavOpen(false);
          router.push('/(tabs)/more/email/templates');
        }}
        onAnalytics={() => {
          setNavOpen(false);
          router.push('/(tabs)/more/email/analytics');
        }}
      />

      <FiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
      />

      <LabelManagerSheet visible={labelManagerOpen} onClose={() => setLabelManagerOpen(false)} />
    </View>
  );
}

function LoadingList() {
  return <ListSkeleton rows={6} padding={0} />;
}

function BulkAction({
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
    <Pressable hitSlop={6} onPress={onPress} accessibilityLabel={label} style={{ padding: 4 }}>
      <Ionicons name={icon} size={21} color={t.foreground} />
    </Pressable>
  );
}

function ContextChip({
  label,
  color,
  onClear,
}: {
  label: string;
  color?: string | null;
  onClear: () => void;
}) {
  const t = useTheme();
  const tint = color || t.primary;
  return (
    <View style={[styles.contextChip, { backgroundColor: `${tint}22` }]}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint }} />
      <Text style={{ color: tint, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
      <Pressable hitSlop={8} onPress={onClear} accessibilityLabel={`Clear ${label}`}>
        <Ionicons name="close" size={13} color={tint} />
      </Pressable>
    </View>
  );
}

function DraftList({ onOpenDraft }: { onOpenDraft: (draft: Draft) => void }) {
  const t = useTheme();
  const { data = [], isLoading, isRefetching, refetch } = useDrafts(true);

  if (isLoading) return <LoadingList />;

  return (
    <FlashList
      data={data}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
      }
      ListEmptyComponent={<EmptyState title="No drafts" description="Saved drafts appear here" icon="document-outline" />}
      contentContainerStyle={{ paddingBottom: 96 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpenDraft(item)}
          style={({ pressed }) => [
            styles.queuedRow,
            { borderBottomColor: t.border, backgroundColor: pressed ? t.muted : t.card },
          ]}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ color: t.destructive, fontSize: fontSize.sm, fontWeight: '700' }}>Draft</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>
                {item.subject || '(no subject)'}
              </Text>
              <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{listTime(item.updatedAt)}</Text>
            </View>
            <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              To: {(item.toEmails ?? []).join(', ') || '—'}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

function QueuedList({ kind }: { kind: 'scheduled' | 'outbox' }) {
  const t = useTheme();
  const router = useRouter();
  const scheduled = useScheduled(kind === 'scheduled');
  const outbox = useOutbox(kind === 'outbox');
  const query = kind === 'scheduled' ? scheduled : outbox;
  const emails: EmailMessage[] = query.data ?? [];
  const { cancel, retry } = useOutboxActions();

  if (query.isLoading) return <LoadingList />;

  return (
    <FlashList
      data={emails}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={t.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          title={kind === 'scheduled' ? 'No scheduled emails' : 'Outbox is empty'}
          description={
            kind === 'scheduled'
              ? 'Messages you schedule will wait here until their send time'
              : 'Messages currently sending or failed will appear here'
          }
          icon={kind === 'scheduled' ? 'time-outline' : 'arrow-up-circle-outline'}
        />
      }
      contentContainerStyle={{ paddingBottom: 96 }}
      renderItem={({ item }) => (
        <View style={[styles.queuedRow, { borderBottomColor: t.border, backgroundColor: t.card }]}>
          <Pressable
            style={{ flex: 1, gap: 3 }}
            onPress={() =>
              item.conversation && router.push(`/(tabs)/more/email/${item.conversation.id}`)
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
                {displayName(null, (item.toEmails ?? [])[0])}
              </Text>
              <StatusBadge status={item.status} small />
            </View>
            <Text numberOfLines={1} style={{ color: t.foreground, fontSize: 13 }}>
              {item.subject || '(no subject)'}
            </Text>
            <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: 11 }}>
              {kind === 'scheduled'
                ? `Scheduled for ${listTime(item.scheduledAt)}`
                : item.errorMessage || 'Sending…'}
            </Text>
          </Pressable>

          {kind === 'scheduled' ? (
            <Pressable
              onPress={() => cancel.mutate(item.id)}
              disabled={cancel.isPending}
              style={[styles.rowAction, { borderColor: t.border }]}
            >
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          ) : null}
          {kind === 'outbox' && item.status === 'FAILED' ? (
            <Pressable
              onPress={() => retry.mutate(item.id)}
              disabled={retry.isPending}
              style={[styles.rowAction, { borderColor: t.primary }]}
            >
              <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    margin: spacing.md,
    padding: spacing.md,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterButton: { padding: 4 },
  filterCount: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextRow: {
    flexGrow: 0,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  queuedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowAction: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  endOfList: { textAlign: 'center', fontSize: fontSize.xs, paddingVertical: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
