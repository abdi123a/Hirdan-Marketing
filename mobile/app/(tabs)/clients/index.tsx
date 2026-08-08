import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints, type ClientSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatMoney, unwrapList } from '../../../lib/format';
import {
  clientDisplayName,
  clientFromApi,
  clientLocation,
  clientStatusLabel,
  clientStatusTone,
  isIndividual,
} from '../../../lib/clients';
import {
  Avatar,
  Badge,
  Dialog,
  EmptyState,
  KpiCard,
  KpiGrid,
  SearchBar,
  Sheet,
  ListSkeleton,
  useToast,
} from '../../../components/ui';
import { SplitView } from '../../../components/SplitView';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme, useResponsive } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

export default function ClientsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const router = useRouter();
  const { canWrite, canManage } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionClient, setActionClient] = useState<ClientSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientSummary | null>(null);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList(res).map((c) => clientFromApi(c as any));
    },
  });

  const clients = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [clients, query]);

  const stats = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((c) => String(c.status).toUpperCase() === 'ACTIVE').length,
      paused: clients.filter((c) => String(c.status).toUpperCase() === 'PAUSED').length,
      churned: clients.filter((c) => String(c.status).toUpperCase() === 'CHURNED').length,
    }),
    [clients]
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(endpoints.clients.delete(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Client deleted', 'success');
      setDeleteTarget(null);
      if (selectedId === deleteTarget?.id) setSelectedId(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const openClient = (id: string) => {
    if (isTablet) setSelectedId(id);
    else router.push(`/client/${id}`);
  };

  const selected = clients.find((c) => c.id === selectedId);

  const list = (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>Clients</Text>
          <Text style={{ color: t.mutedForeground, marginTop: 2, fontSize: fontSize.sm }}>
            Manage your client relationships
          </Text>
        </View>
        {canWrite('clients') ? (
          <Pressable
            onPress={() => router.push('/client/add')}
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
        <View style={{ flex: 1 }}>
          <View style={styles.statsRow}>
            <KpiGrid>
              <KpiCard label="Total" value="—" icon="people-outline" tone="purple" />
              <KpiCard label="Active" value="—" icon="checkmark-circle-outline" tone="success" />
              <KpiCard label="Paused" value="—" icon="pause-circle-outline" tone="warning" />
              <KpiCard label="Churned" value="—" icon="close-circle-outline" tone="danger" />
            </KpiGrid>
          </View>
          <View style={styles.searchWrap}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search clients…" />
          </View>
          <ListSkeleton rows={6} padding={0} />
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
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.statsRow}>
                <KpiGrid>
                  <KpiCard
                    label="Total"
                    value={String(stats.total)}
                    hint="In your book"
                    icon="people-outline"
                    tone="purple"
                  />
                  <KpiCard
                    label="Active"
                    value={String(stats.active)}
                    hint={
                      stats.total
                        ? `${Math.round((stats.active / stats.total) * 100)}% of book`
                        : 'None yet'
                    }
                    hintTone="success"
                    icon="checkmark-circle-outline"
                    tone="success"
                  />
                  <KpiCard
                    label="Paused"
                    value={String(stats.paused)}
                    hint="On hold"
                    hintTone="warning"
                    icon="pause-circle-outline"
                    tone="warning"
                  />
                  <KpiCard
                    label="Churned"
                    value={String(stats.churned)}
                    hint="Left the book"
                    hintTone="destructive"
                    icon="close-circle-outline"
                    tone="danger"
                  />
                </KpiGrid>
              </View>
              <View style={styles.searchWrap}>
                <View style={styles.listTitleRow}>
                  <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
                    All Clients ({filtered.length})
                  </Text>
                </View>
                <SearchBar value={query} onChangeText={setQuery} placeholder="Search clients…" />
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No clients found"
              description={query ? 'Try a different search.' : 'Add your first client to get started.'}
              actionLabel={canWrite('clients') && !query ? 'Add client' : undefined}
              onAction={
                canWrite('clients') && !query
                  ? () => router.push('/client/add')
                  : undefined
              }
              icon="people-outline"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openClient(item.id)}
              style={[styles.row, { backgroundColor: t.card, borderBottomColor: t.border }]}
            >
              <Avatar name={clientDisplayName(item)} initials={item.initials} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {clientDisplayName(item)}
                  </Text>
                  {isIndividual(item) ? (
                    <Badge label="Individual" tone="default" />
                  ) : null}
                </View>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={1}>
                  {item.name}
                  {item.email ? ` · ${item.email}` : ''}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={1}>
                  {clientLocation(item)} · {item._count?.projects ?? 0} projects
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge label={clientStatusLabel(item.status)} tone={clientStatusTone(item.status)} />
                <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.sm }}>
                  {formatMoney(item.revenue || 0)}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setActionClient(item);
                  }}
                  hitSlop={10}
                  style={styles.moreBtn}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={t.mutedForeground} />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );

  return (
    <>
      <SplitView
        list={list}
        showDetail={isTablet}
        detail={
          selected ? (
            <View style={[styles.detail, { backgroundColor: t.card, borderColor: t.border }]}>
              <Avatar name={clientDisplayName(selected)} initials={selected.initials} size={56} />
              <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
                {clientDisplayName(selected)}
              </Text>
              <Text style={{ color: t.mutedForeground }}>{selected.name}</Text>
              <Badge label={clientStatusLabel(selected.status)} tone={clientStatusTone(selected.status)} />
              <Text style={{ color: t.mutedForeground, marginTop: spacing.sm }}>
                {selected.email || 'No email'} · {clientLocation(selected)}
              </Text>
              <Text style={{ color: t.foreground, fontWeight: '800', marginTop: spacing.md }}>
                {formatMoney(selected.revenue || 0)} revenue
              </Text>
              <Pressable
                onPress={() => router.push(`/client/${selected.id}`)}
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

      <Sheet
        visible={!!actionClient}
        onClose={() => setActionClient(null)}
        title={actionClient ? clientDisplayName(actionClient) : 'Actions'}
      >
        <ActionRow
          icon="eye-outline"
          label="View client"
          onPress={() => {
            const id = actionClient!.id;
            setActionClient(null);
            openClient(id);
          }}
        />
        {canWrite('clients') ? (
          <ActionRow
            icon="create-outline"
            label="Edit client"
            onPress={() => {
              const id = actionClient!.id;
              setActionClient(null);
              router.push(`/client/edit/${id}`);
            }}
          />
        ) : null}
        <ActionRow
          icon="globe-outline"
          label="View portal / website"
          onPress={() => {
            const c = actionClient!;
            setActionClient(null);
            if (c.website) {
              const url = c.website.startsWith('http') ? c.website : `https://${c.website}`;
              Linking.openURL(url);
            } else {
              toast(`Portal: portal.hirdanmarketing.com/${c.id}`, 'default');
            }
          }}
        />
        <ActionRow
          icon="briefcase-outline"
          label="View projects"
          onPress={() => {
            const id = actionClient!.id;
            setActionClient(null);
            router.push(`/client/${id}?tab=projects`);
          }}
        />
        {canManage('clients') ? (
          <ActionRow
            icon="trash-outline"
            label="Delete"
            destructive
            onPress={() => {
              setDeleteTarget(actionClient);
              setActionClient(null);
            }}
          />
        ) : null}
      </Sheet>

      <Dialog
        visible={!!deleteTarget}
        title="Delete client?"
        message={`Remove ${deleteTarget ? clientDisplayName(deleteTarget) : 'this client'} permanently? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.actionRow}>
      <Ionicons name={icon} size={20} color={destructive ? t.destructive : t.foreground} />
      <Text
        style={{
          color: destructive ? t.destructive : t.foreground,
          fontWeight: '600',
          fontSize: fontSize.md,
          flex: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  statsRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moreBtn: { padding: 4 },
  detail: {
    flex: 1,
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
});
