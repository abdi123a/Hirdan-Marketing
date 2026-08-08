import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type TransferSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, relativeTime, unwrapList } from '../../../lib/format';
import {
  fileIconName,
  formatBytes,
  normalizeTransfer,
  statusLabel,
  statusOf,
  statusTone,
  type TransferStatus,
} from '../../../lib/transfers';
import {
  Badge,
  Chip,
  EmptyState,
  ListRow,
  SearchBar,
  ListSkeleton,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { elevation, fontSize, radius, spacing } from '../../../constants/theme';

type StatusFilter = 'all' | TransferStatus;

export default function TransfersScreen() {
  const t = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.transfer.list);
      return unwrapList<Record<string, any>>(res).map(normalizeTransfer);
    },
  });

  const transfers = data ?? [];

  const counts = useMemo(() => {
    const base = { all: transfers.length, active: 0, expired: 0, revoked: 0 };
    for (const item of transfers) base[statusOf(item)]++;
    return base;
  }, [transfers]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transfers.filter((item) => {
      if (statusFilter !== 'all' && statusOf(item) !== statusFilter) return false;
      if (!term) return true;
      return (
        item.fileName.toLowerCase().includes(term) ||
        (item.client?.name ?? '').toLowerCase().includes(term) ||
        (item.emailSentTo ?? '').toLowerCase().includes(term)
      );
    });
  }, [transfers, search, statusFilter]);

  const filters: { label: string; value: StatusFilter }[] = [
    { label: `All ${counts.all}`, value: 'all' },
    { label: `Active ${counts.active}`, value: 'active' },
    { label: `Expired ${counts.expired}`, value: 'expired' },
    { label: `Revoked ${counts.revoked}`, value: 'revoked' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: t.border, backgroundColor: t.card }]}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search files or clients…" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              selected={statusFilter === f.value}
              onPress={() => setStatusFilter(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} avatar={false} padding={0} />
      ) : error ? (
        <EmptyState
          title="Could not load transfers"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="cloud-upload-outline"
        />
      ) : (
        <FlashList
          data={visible}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title={search || statusFilter !== 'all' ? 'No matching transfers' : 'No file transfers'}
              description={
                search || statusFilter !== 'all'
                  ? 'Try a different search or filter'
                  : 'Upload a file to create a secure share link'
              }
              actionLabel={search || statusFilter !== 'all' ? undefined : 'Upload file'}
              onAction={
                search || statusFilter !== 'all'
                  ? undefined
                  : () => router.push('/transfer/add')
              }
              icon="cloud-upload-outline"
            />
          }
          contentContainerStyle={{ paddingBottom: 96 }}
          renderItem={({ item }) => <TransferRow item={item} />}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Upload file"
        onPress={() => router.push('/transfer/add')}
        style={[styles.fab, { backgroundColor: t.primary }]}
      >
        <Ionicons name="add" size={28} color={t.primaryForeground} />
      </Pressable>
    </View>
  );
}

function TransferRow({ item }: { item: TransferSummary }) {
  const t = useTheme();
  const router = useRouter();
  const status = statusOf(item);
  const icon = fileIconName(item.fileName);

  return (
    <ListRow
      title={item.fileName}
      subtitle={`${formatBytes(item.fileSize)} · ${formatDate(item.createdAt)}${
        item.client?.name ? ` · ${item.client.name}` : ''
      }`}
      onPress={() => router.push(`/transfer/${item.id}`)}
      left={
        <View style={[styles.iconWrap, { backgroundColor: t.accent }]}>
          <Ionicons name={icon} size={20} color={t.accentForeground} />
        </View>
      }
      right={
        <View style={styles.right}>
          <Badge label={statusLabel(status)} tone={statusTone(status)} />
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            {status === 'active'
              ? `Exp ${relativeTime(item.expiresAt)}`
              : `${item.downloadCount} dl · ${item.viewCount} views`}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filters: { gap: spacing.sm, paddingRight: spacing.lg },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: { alignItems: 'flex-end', gap: 4, maxWidth: 120 },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.lg,
  },
});
