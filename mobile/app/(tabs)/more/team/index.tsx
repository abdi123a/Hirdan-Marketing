import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { unwrapList } from '../../../../lib/format';
import {
  teamFromApi,
  teamStatusTone,
  titleCase,
  type TeamMemberRow,
} from '../../../../lib/team';
import {
  Avatar,
  Badge,
  EmptyState,
  ListSkeleton,
  SearchBar,
} from '../../../../components/ui';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../../constants/theme';

export default function TeamScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canWrite } = usePermissions();
  const [query, setQuery] = useState('');

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.team.list}?take=200`);
      return unwrapList(res).map((m) => teamFromApi(m as Record<string, unknown>));
    },
  });

  const members = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q)
    );
  }, [members, query]);

  const renderItem = ({ item }: { item: TeamMemberRow }) => (
    <Pressable
      onPress={() => router.push(`/(tabs)/more/team/${item.id}`)}
      style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
    >
      <Avatar name={item.name} size={44} />
      <View style={styles.cardBody}>
        <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }} numberOfLines={1}>
          {item.email || item.department || '—'}
        </Text>
        <View style={styles.badges}>
          {item.role ? <Badge label={item.role} tone="gold" /> : null}
          {item.status ? (
            <Badge label={titleCase(item.status)} tone={teamStatusTone(item.status)} />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.mutedForeground} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            Team
          </Text>
          <Text style={{ color: t.mutedForeground, marginTop: 2, fontSize: fontSize.sm }}>
            Employees and org chart
          </Text>
        </View>
        {canWrite('team') ? (
          <Pressable
            onPress={() => router.push('/(tabs)/more/team/add')}
            style={[styles.addBtn, { backgroundColor: t.primary }]}
          >
            <Ionicons name="add" size={18} color={t.primaryForeground} />
            <Text style={{ color: t.primaryForeground, fontWeight: '700', fontSize: fontSize.sm }}>
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>

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
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListHeaderComponent={
            <View style={styles.searchWrap}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search team…" />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No team members"
              description={
                canWrite('team')
                  ? 'Add your first employee to get started.'
                  : 'No members match your search.'
              }
              actionLabel={canWrite('team') && !query ? 'Add employee' : undefined}
              onAction={
                canWrite('team') && !query
                  ? () => router.push('/(tabs)/more/team/add')
                  : undefined
              }
              icon="people-outline"
            />
          }
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardBody: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
