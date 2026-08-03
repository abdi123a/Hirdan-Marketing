import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, unwrapList } from '../../../lib/format';
import { EmptyState, ListRow, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

type EmailMessage = {
  id: string;
  subject?: string | null;
  from?: string | null;
  fromAddress?: string | null;
  preview?: string | null;
  snippet?: string | null;
  receivedAt?: string | null;
  date?: string | null;
  read?: boolean;
};

export default function EmailScreen() {
  const t = useTheme();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['email-messages'],
    queryFn: () => apiFetch<unknown>(endpoints.email.messages),
    refetchInterval: 15_000,
  });

  const messages = unwrapList<EmailMessage>(data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load email"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="mail-outline"
        />
      ) : (
        <FlashList
          data={messages}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No messages"
              description="Inbox refreshes every 15 seconds. Live SSE is not available in React Native."
              icon="mail-open-outline"
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.subject || '(No subject)'}
              subtitle={`${item.from || item.fromAddress || 'Unknown'} · ${formatDate(item.receivedAt || item.date)}`}
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
