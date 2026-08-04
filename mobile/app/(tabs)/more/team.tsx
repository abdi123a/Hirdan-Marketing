import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type TeamMemberSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList } from '../../../lib/format';
import { Avatar, Badge, EmptyState, ListRow, ListSkeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';

export default function TeamScreen() {
  const t = useTheme();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['team'],
    queryFn: () => apiFetch<unknown>(endpoints.team.list),
  });

  const members = unwrapList<TeamMemberSummary>(data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <ListSkeleton rows={6} padding={0} />
      ) : error ? (
        <EmptyState
          title="Could not load team"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="people-outline"
        />
      ) : (
        <FlashList
          data={members}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={<EmptyState title="No team members" icon="people-outline" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.email || item.department || undefined}
              left={<Avatar name={item.name} size={44} />}
              right={item.role ? <Badge label={item.role} tone="gold" /> : undefined}
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
