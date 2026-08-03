import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints, type ClientSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList } from '../../../lib/format';
import { Badge, EmptyState, ListRow, SearchBar, Skeleton } from '../../../components/ui';
import { SplitView } from '../../../components/SplitView';
import { useTheme, useResponsive } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

export default function ClientsScreen() {
  const t = useTheme();
  const { isTablet } = useResponsive();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiFetch<unknown>(endpoints.clients.list),
  });

  const clients = useMemo(() => {
    const list = unwrapList<ClientSummary>(data);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.company?.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        (c as ClientSummary & { name?: string }).name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [data, query]);

  const selected = clients.find((c) => c.id === selectedId);

  const list = (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search clients…" />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load clients"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="alert-circle-outline"
        />
      ) : (
        <FlashList
          data={clients}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No clients yet"
              description="Add your first client to get started."
              actionLabel="Add client"
              onAction={() => router.push('/(tabs)/clients/add')}
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.company}
              subtitle={
                (item.contactName ||
                  (item as ClientSummary & { name?: string }).name ||
                  item.email) ?? undefined
              }
              right={<Badge label={item.status || 'Active'} tone="default" />}
              onPress={() => {
                if (isTablet) setSelectedId(item.id);
                else router.push(`/(tabs)/clients/${item.id}`);
              }}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/(tabs)/clients/add')}
        style={[styles.fab, { backgroundColor: t.primary }]}
        accessibilityRole="button"
        accessibilityLabel="Add client"
      >
        <Ionicons name="add" size={28} color={t.primaryForeground} />
      </Pressable>
    </View>
  );

  return (
    <SplitView
      list={list}
      showDetail={isTablet}
      detail={
        selected ? (
          <View style={[styles.detail, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
              {selected.company}
            </Text>
            <Text style={{ color: t.mutedForeground, marginTop: spacing.sm }}>
              {selected.email || 'No email'}
            </Text>
            <Badge label={selected.status || 'Active'} tone="gold" />
            <Pressable
              onPress={() => router.push(`/(tabs)/clients/${selected.id}`)}
              style={{ marginTop: spacing.lg }}
            >
              <Text style={{ color: t.primary, fontWeight: '700' }}>Open full profile →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.detailEmpty}>
            <Text style={{ color: t.mutedForeground }}>Select a client</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  detail: {
    flex: 1,
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
