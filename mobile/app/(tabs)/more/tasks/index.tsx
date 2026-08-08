import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@hirdan/shared';
import { apiFetch, apiUpload } from '../../../../lib/api-client';
import { formatDate, unwrapList } from '../../../../lib/format';
import {
  TASK_STATUSES,
  taskClientLabel,
  taskFromApi,
  taskPlatformsLabel,
  taskStatusLabel,
  taskStatusTone,
  type DeliverableTaskRow,
} from '../../../../lib/tasks';
import {
  Badge,
  EmptyState,
  ListSkeleton,
  SearchBar,
  Sheet,
  useToast,
} from '../../../../components/ui';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../../constants/theme';

const STATUS_FILTERS = ['ALL', ...TASK_STATUSES] as const;

export default function DeliverableTasksScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { canWrite } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [actionTask, setActionTask] = useState<DeliverableTaskRow | null>(null);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['deliverable-tasks', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ take: '200' });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await apiFetch<unknown>(`${endpoints.tasks.list}?${params.toString()}`);
      return unwrapList(res).map((row) => taskFromApi(row as Record<string, unknown>));
    },
  });

  const tasks = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        taskClientLabel(task).toLowerCase().includes(q) ||
        taskStatusLabel(task.status).toLowerCase().includes(q) ||
        taskPlatformsLabel(task).toLowerCase().includes(q)
    );
  }, [tasks, query]);

  const stats = useMemo(() => {
    const norm = (s: string) => s.toUpperCase();
    return {
      total: tasks.length,
      pending: tasks.filter((task) => norm(task.status) === 'PENDING').length,
      inProgress: tasks.filter((task) =>
        ['IN_PROGRESS', 'PLANNED', 'WAITING_APPROVAL'].includes(norm(task.status))
      ).length,
      completed: tasks.filter((task) => norm(task.status) === 'COMPLETED').length,
    };
  }, [tasks]);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(endpoints.tasks.update(id), {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverable-tasks'] });
      toast('Task updated', 'success');
      setActionTask(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const form = new FormData();
      form.append('postedAt', new Date().toISOString());
      form.append('clientVisible', 'true');
      return apiUpload(endpoints.tasks.complete(id), form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverable-tasks'] });
      toast('Task completed', 'success');
      setActionTask(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const canMutate = canWrite('social_media');

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            Deliverables
          </Text>
          <Text style={{ color: t.mutedForeground, marginTop: 2, fontSize: fontSize.sm }}>
            Social content tasks by client and status
          </Text>
        </View>
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} padding={0} />
      ) : error ? (
        <EmptyState
          title="Could not load tasks"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="checkbox-outline"
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
                <StatPill label="Total" value={stats.total} />
                <StatPill label="Pending" value={stats.pending} />
                <StatPill label="Active" value={stats.inProgress} />
                <StatPill label="Done" value={stats.completed} />
              </View>
              <View style={styles.searchWrap}>
                <SearchBar value={query} onChangeText={setQuery} placeholder="Search tasks…" />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {STATUS_FILTERS.map((status) => {
                  const active = statusFilter === status;
                  return (
                    <Pressable
                      key={status}
                      onPress={() => setStatusFilter(status)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? t.primary : t.card,
                          borderColor: active ? t.primary : t.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? t.primaryForeground : t.foreground,
                          fontWeight: '700',
                          fontSize: fontSize.xs,
                        }}
                      >
                        {status === 'ALL' ? 'All' : taskStatusLabel(status)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No deliverable tasks"
              description="Tasks appear when generated from subscription cycles."
              icon="checkbox-outline"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => canMutate && setActionTask(item)}
              onLongPress={() => canMutate && setActionTask(item)}
              style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <View style={styles.cardTop}>
                <Text
                  style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '700', flex: 1 }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {canMutate ? (
                  <Ionicons name="ellipsis-horizontal" size={18} color={t.mutedForeground} />
                ) : null}
              </View>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }} numberOfLines={1}>
                {taskClientLabel(item)}
              </Text>
              <View style={styles.badges}>
                <Badge label={taskStatusLabel(item.status)} tone={taskStatusTone(item.status)} />
                {item.type ? <Badge label={item.type} /> : null}
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="share-social-outline" size={14} color={t.mutedForeground} />
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, flex: 1 }} numberOfLines={1}>
                  {taskPlatformsLabel(item)}
                </Text>
              </View>
              {item.dueDate ? (
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  Due {formatDate(item.dueDate)}
                </Text>
              ) : null}
              {item.cycle?.label ? (
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  Cycle {item.cycle.label}
                </Text>
              ) : null}
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}

      <Sheet
        visible={!!actionTask}
        onClose={() => setActionTask(null)}
        title={actionTask?.title}
      >
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, marginBottom: spacing.xs }}>
            Change status
          </Text>
          {TASK_STATUSES.map((status) => (
            <ActionRow
              key={status}
              icon="radio-button-on-outline"
              label={taskStatusLabel(status)}
              active={actionTask?.status === status}
              onPress={() =>
                actionTask &&
                updateMutation.mutate({ id: actionTask.id, status })
              }
            />
          ))}
          {actionTask && actionTask.status !== 'COMPLETED' ? (
            <ActionRow
              icon="checkmark-circle-outline"
              label="Mark complete"
              onPress={() => actionTask && completeMutation.mutate(actionTask.id)}
            />
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={[styles.statPill, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.lg }}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionRow,
        {
          borderColor: active ? t.primary : t.border,
          backgroundColor: active ? t.primary + '12' : t.background,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={active ? t.primary : t.mutedForeground} />
      <Text
        style={{
          color: t.foreground,
          fontWeight: '600',
          fontSize: fontSize.md,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {active ? <Ionicons name="checkmark" size={16} color={t.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statPill: {
    flex: 1,
    minWidth: '45%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  chips: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
