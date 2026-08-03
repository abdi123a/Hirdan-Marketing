import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints, type SocialAccountSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList } from '../../../lib/format';
import { Avatar, Button, EmptyState, ListRow, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function SocialScreen() {
  const t = useTheme();
  const router = useRouter();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => apiFetch<unknown>(endpoints.social.accounts),
  });

  const accounts = unwrapList<SocialAccountSummary>(data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.actions}>
        <Button title="Planner" variant="outline" onPress={() => router.push('/(tabs)/social/planner')} />
        <Button title="Compose" onPress={() => router.push('/(tabs)/social/compose')} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load accounts"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="alert-circle-outline"
        />
      ) : (
        <FlashList
          data={accounts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No connected accounts"
              description="Connect social accounts from the web dashboard."
              icon="share-social-outline"
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.accountName}
              subtitle={`${item.platform}${item.username ? ` · @${item.username}` : ''}`}
              left={<Avatar name={item.accountName} size={40} />}
              right={
                item.status ? (
                  <Ionicons
                    name={item.status === 'ACTIVE' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.status === 'ACTIVE' ? t.success : t.mutedForeground}
                  />
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
  actions: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm },
});
