import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { endpoints, type NotificationDto } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { EmptyState, ListRow, ListSkeleton, Button } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function NotificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await apiFetch<NotificationDto[] | { data: NotificationDto[] }>(
        endpoints.notifications.list
      );
      return Array.isArray(data) ? data : data.data || [];
    },
  });

  const markAll = useMutation({
    mutationFn: () => apiFetch(endpoints.notifications.markAllRead, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-counts'] });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) =>
      apiFetch(endpoints.notifications.markRead(id), { method: 'PUT' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-counts'] });
    },
  });

  if (query.isLoading) {
    return <ListSkeleton rows={6} />;
  }

  const items = query.data || [];

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ padding: spacing.md }}>
        <Button
          title="Mark all read"
          variant="outline"
          size="sm"
          loading={markAll.isPending}
          onPress={() => markAll.mutate()}
        />
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
        }
        ListEmptyComponent={
          <EmptyState title="No notifications" description="You're all caught up." icon="notifications-outline" />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.title}
            subtitle={item.message}
            onPress={() => {
              if (!item.read) markOne.mutate(item.id);
            }}
            right={
              !item.read ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: t.primary,
                  }}
                />
              ) : undefined
            }
          />
        )}
      />
    </View>
  );
}
