import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type TransferSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, unwrapList } from '../../../lib/format';
import { EmptyState, ListRow, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize } from '../../../constants/theme';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function TransfersScreen() {
  const t = useTheme();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => apiFetch<unknown>(endpoints.transfer.list),
  });

  const transfers = unwrapList<TransferSummary>(data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
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
          data={transfers}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={<EmptyState title="No file transfers" icon="cloud-upload-outline" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.filename}
              subtitle={`${formatBytes(item.size)} · ${formatDate(item.createdAt)}`}
              right={
                item.expiresAt ? (
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    Exp {formatDate(item.expiresAt)}
                  </Text>
                ) : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
