import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { formatDate, formatMoney, unwrapList } from '../../../../lib/format';
import {
  billingCycleLabel,
  displayStatus,
  statusTone,
  subscriptionClientLabel,
  subscriptionFromApi,
  subscriptionPlanLabel,
  type SubscriptionRow,
} from '../../../../lib/subscriptions';
import {
  Badge,
  Card,
  Dialog,
  EmptyState,
  FadeIn,
  KpiCard,
  KpiGrid,
  ListSkeleton,
  SearchBar,
  Sheet,
  Text,
  useToast,
} from '../../../../components/ui';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useElevation, useTheme } from '../../../../hooks/useTheme';
import { radius, spacing } from '../../../../constants/theme';

const STATUS_FILTERS = ['All', 'Active', 'Trial', 'Paused', 'Cancelled', 'Ended'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function SubscriptionsScreen() {
  const t = useTheme();
  const shadows = useElevation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubscriptionRow | null>(null);

  const canEdit = canWrite('subscriptions');

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.subscriptions.list);
      return unwrapList<Record<string, unknown>>(res).map(subscriptionFromApi);
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(endpoints.subscriptions.delete(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-subscriptions'] });
      toast('Subscription deleted', 'success');
      setPendingDelete(null);
    },
    onError: () => {
      toast('Could not delete subscription', 'error');
      setPendingDelete(null);
    },
  });

  const metrics = useMemo(() => {
    let active = 0;
    let trial = 0;
    let monthly = 0;

    for (const row of rows) {
      const label = displayStatus(row.status, row.endDate);
      if (label === 'Active') {
        active += 1;
        // Normalise each cycle to a monthly figure so the total is comparable.
        const cycle = billingCycleLabel(row.billingCycle);
        const divisor = cycle === 'Annual' ? 12 : cycle === 'Quarterly' ? 3 : 1;
        monthly += row.amount / divisor;
      } else if (label === 'Trial') {
        trial += 1;
      }
    }

    return { active, trial, monthly, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (status !== 'All' && displayStatus(row.status, row.endDate) !== status) {
        return false;
      }
      if (!needle) return true;
      return (
        subscriptionPlanLabel(row).toLowerCase().includes(needle) ||
        subscriptionClientLabel(row).toLowerCase().includes(needle)
      );
    });
  }, [rows, query, status]);

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: t.background }]}>
        <ListSkeleton rows={6} padding={spacing.gutter} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: t.background }]}>
        <EmptyState
          icon="cloud-offline-outline"
          tone="destructive"
          title="Couldn't load subscriptions"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <KpiGrid style={styles.gutter}>
              <KpiCard
                label="Active"
                value={String(metrics.active)}
                hint={`${metrics.total} total`}
                icon="repeat-outline"
                tone="success"
              />
              <KpiCard
                label="Monthly value"
                value={formatMoney(metrics.monthly)}
                hint="Normalised"
                icon="trending-up-outline"
                tone="purple"
              />
              {metrics.trial > 0 ? (
                <KpiCard
                  label="On trial"
                  value={String(metrics.trial)}
                  hint="Converting soon"
                  icon="hourglass-outline"
                  tone="gold"
                  fullWidth
                />
              ) : null}
            </KpiGrid>

            <View style={[styles.gutter, styles.searchRow]}>
              <View style={styles.searchField}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search subscriptions…"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter by status"
                onPress={() => setFiltersOpen(true)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: status === 'All' ? t.surfaceSunken : t.primary,
                    borderColor: status === 'All' ? t.borderSubtle : t.primary,
                  },
                ]}
              >
                <Ionicons
                  name="options-outline"
                  size={19}
                  color={status === 'All' ? t.mutedForeground : t.primaryForeground}
                />
              </Pressable>
            </View>

            {status !== 'All' ? (
              <View style={styles.gutter}>
                <Text variant="caption" color="muted">
                  Showing {filtered.length} {status.toLowerCase()}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="repeat-outline"
            title={query || status !== 'All' ? 'No matches' : 'No subscriptions yet'}
            description={
              query || status !== 'All'
                ? 'Try a different search or clear the filter.'
                : 'Recurring plans you set up will appear here.'
            }
            actionLabel={canEdit && !query && status === 'All' ? 'New subscription' : undefined}
            onAction={canEdit ? () => router.push('/subscription/add') : undefined}
            secondaryLabel={status !== 'All' ? 'Clear filter' : undefined}
            onSecondary={() => setStatus('All')}
          />
        }
        renderItem={({ item, index }) => (
          <FadeIn index={index} style={styles.gutter}>
            <SubscriptionCard
              row={item}
              onPress={() => router.push(`/subscription/${item.id}`)}
              onLongPress={canEdit ? () => setPendingDelete(item) : undefined}
            />
          </FadeIn>
        )}
      />

      {canEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New subscription"
          onPress={() => router.push('/subscription/add')}
          style={[
            styles.fab,
            { backgroundColor: t.primary, bottom: insets.bottom + spacing.xl },
            shadows.lg,
          ]}
        >
          <Ionicons name="add" size={26} color={t.primaryForeground} />
        </Pressable>
      ) : null}

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter by status"
      >
        <View style={styles.filterList}>
          {STATUS_FILTERS.map((option) => {
            const active = option === status;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setStatus(option);
                  setFiltersOpen(false);
                }}
                style={[
                  styles.filterRow,
                  {
                    backgroundColor: active ? t.accent : 'transparent',
                    borderColor: active ? t.primary : t.borderSubtle,
                  },
                ]}
              >
                <Text variant="title" color={active ? 'primary' : 'default'}>
                  {option}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={t.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Dialog
        visible={pendingDelete !== null}
        title="Delete subscription?"
        message={
          pendingDelete
            ? `${subscriptionPlanLabel(pendingDelete)} for ${subscriptionClientLabel(pendingDelete)} will be removed permanently.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

function SubscriptionCard({
  row,
  onPress,
  onLongPress,
}: {
  row: SubscriptionRow;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const label = displayStatus(row.status, row.endDate);
  const cycle = billingCycleLabel(row.billingCycle);

  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text variant="title" numberOfLines={1}>
            {subscriptionPlanLabel(row)}
          </Text>
          <Text variant="subtext" color="muted" numberOfLines={1}>
            {subscriptionClientLabel(row)}
          </Text>
        </View>
        <Badge label={label} tone={statusTone(row.status, row.endDate)} />
      </View>

      <View style={styles.cardMeta}>
        <Text variant="metricSm">{formatMoney(row.amount)}</Text>
        <Text variant="caption" color="subtle">
          {cycle}
          {row.startDate ? ` · from ${formatDate(row.startDate)}` : ''}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gutter: { paddingHorizontal: spacing.gutter },
  header: {
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchField: { flex: 1 },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardTitle: { flex: 1, gap: 2 },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  filterList: { gap: spacing.sm },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 52,
  },
  fab: {
    position: 'absolute',
    right: spacing.gutter,
    width: 58,
    height: 58,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
