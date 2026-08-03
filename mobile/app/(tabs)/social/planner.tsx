import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, unwrapList } from '../../../lib/format';
import { Badge, EmptyState, ListRow, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize } from '../../../constants/theme';

type SocialPost = {
  id: string;
  caption?: string | null;
  content?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  status?: string;
  platform?: string;
};

export default function SocialPlannerScreen() {
  const t = useTheme();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['social-posts'],
    queryFn: () => apiFetch<unknown>(endpoints.social.posts),
  });

  const posts = unwrapList<SocialPost>(data).sort((a, b) => {
    const da = new Date(a.scheduledAt || a.publishedAt || 0).getTime();
    const db = new Date(b.scheduledAt || b.publishedAt || 0).getTime();
    return db - da;
  });

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load posts"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="alert-circle-outline"
        />
      ) : (
        <FlashList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No scheduled posts"
              description="Compose a post to add it to your calendar."
              icon="calendar-outline"
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.caption || item.content || 'Untitled post'}
              subtitle={formatDate(item.scheduledAt || item.publishedAt)}
              right={item.status ? <Badge label={item.status} /> : undefined}
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
