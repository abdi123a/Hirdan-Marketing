import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type CalendarEventSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, unwrapList } from '../../../lib/format';
import { EmptyState, ListRow, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function CalendarScreen() {
  const t = useTheme();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['calendar-meetings'],
    queryFn: async () => {
      try {
        return await apiFetch<unknown>('/clients/meetings');
      } catch {
        return await apiFetch<unknown>('/calendar/events');
      }
    },
  });

  const events = unwrapList<CalendarEventSummary>(data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error || events.length === 0 ? (
        <EmptyState
          title="No upcoming meetings"
          description={
            error
              ? (error as Error).message
              : 'Client meetings appear here when scheduled from the dashboard. Pull to refresh.'
          }
          actionLabel="Refresh"
          onAction={() => refetch()}
          icon="calendar-outline"
        />
      ) : (
        <FlashList
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={`${formatDate(item.start)}${item.type ? ` · ${item.type}` : ''}`}
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
