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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { formatDate, unwrapList } from '../../../../lib/format';
import {
  projectClientLabel,
  projectFromApi,
  statusTone,
  titleCasePriority,
  titleCaseStatus,
  type ProjectRow,
} from '../../../../lib/projects';
import {
  Badge,
  Dialog,
  EmptyState,
  KpiCard,
  KpiGrid,
  ListSkeleton,
  ProgressBar,
  SearchBar,
  Sheet,
  useToast,
} from '../../../../components/ui';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../../constants/theme';

export default function ProjectsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canWrite, canManage } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [actionProject, setActionProject] = useState<ProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.projects.list}?take=200`);
      return unwrapList(res).map((p) => projectFromApi(p));
    },
  });

  const projects = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        projectClientLabel(p).toLowerCase().includes(q) ||
        titleCaseStatus(p.status).toLowerCase().includes(q)
    );
  }, [projects, query]);

  const stats = useMemo(() => {
    const norm = (s?: string | null) =>
      String(s || '')
        .toUpperCase()
        .replace(/\s+/g, '_');
    return {
      total: projects.length,
      inProgress: projects.filter((p) => norm(p.status) === 'IN_PROGRESS').length,
      completed: projects.filter((p) => norm(p.status) === 'COMPLETED').length,
      onHold: projects.filter((p) => norm(p.status) === 'ON_HOLD').length,
    };
  }, [projects]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(endpoints.projects.delete(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
      toast('Project deleted', 'success');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            Projects
          </Text>
          <Text style={{ color: t.mutedForeground, marginTop: 2, fontSize: fontSize.sm }}>
            Track campaigns and deliverables
          </Text>
        </View>
        {canWrite('projects') ? (
          <Pressable
            onPress={() => router.push('/project/add')}
            style={[styles.addBtn, { backgroundColor: t.primary }]}
          >
            <Ionicons name="add" size={18} color={t.primaryForeground} />
            <Text style={{ color: t.primaryForeground, fontWeight: '700', fontSize: fontSize.sm }}>
              New
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View style={{ flex: 1 }}>
          <View style={styles.statsRow}>
            <KpiGrid>
              <KpiCard label="Total" value="—" icon="briefcase-outline" tone="purple" />
              <KpiCard label="In progress" value="—" icon="play-outline" tone="gold" />
              <KpiCard label="Completed" value="—" icon="checkmark-circle-outline" tone="success" />
              <KpiCard label="On hold" value="—" icon="pause-circle-outline" tone="warning" />
            </KpiGrid>
          </View>
          <ListSkeleton rows={6} padding={0} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load projects"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="briefcase-outline"
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
                    icon="briefcase-outline"
                    tone="purple"
                  />
                  <KpiCard
                    label="In progress"
                    value={String(stats.inProgress)}
                    icon="play-outline"
                    tone="gold"
                  />
                  <KpiCard
                    label="Completed"
                    value={String(stats.completed)}
                    icon="checkmark-circle-outline"
                    tone="success"
                  />
                  <KpiCard
                    label="On hold"
                    value={String(stats.onHold)}
                    icon="pause-circle-outline"
                    tone="warning"
                  />
                </KpiGrid>
              </View>
              <View style={styles.searchWrap}>
                <SearchBar value={query} onChangeText={setQuery} placeholder="Search projects…" />
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No projects"
              description={
                canWrite('projects')
                  ? 'Create your first project to start tracking work.'
                  : 'No projects match your search.'
              }
              actionLabel={canWrite('projects') ? 'New project' : undefined}
              onAction={
                canWrite('projects')
                  ? () => router.push('/project/add')
                  : undefined
              }
              icon="briefcase-outline"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/project/${item.id}`)}
              onLongPress={() => setActionProject(item)}
              style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <View style={styles.cardTop}>
                <Text
                  style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '700', flex: 1 }}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => setActionProject(item)}
                  style={styles.moreBtn}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={t.mutedForeground} />
                </Pressable>
              </View>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }} numberOfLines={1}>
                {projectClientLabel(item)}
              </Text>
              <View style={styles.badges}>
                <Badge label={titleCaseStatus(item.status)} tone={statusTone(item.status)} />
                <Badge label={titleCasePriority(item.priority)} />
              </View>
              <View style={{ gap: 6, marginTop: spacing.sm }}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
                    PROGRESS
                  </Text>
                  <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs }}>
                    {item.progress ?? 0}%
                  </Text>
                </View>
                <ProgressBar progress={item.progress ?? 0} height={6} />
              </View>
              {item.dueDate ? (
                <Text
                  style={{ color: t.mutedForeground, fontSize: fontSize.xs, marginTop: spacing.sm }}
                >
                  Due {formatDate(item.dueDate)}
                </Text>
              ) : null}
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}

      <Sheet
        visible={!!actionProject}
        onClose={() => setActionProject(null)}
        title={actionProject?.name}
      >
        <View style={{ gap: spacing.sm }}>
          <ActionRow
            icon="eye-outline"
            label="View"
            onPress={() => {
              const id = actionProject?.id;
              setActionProject(null);
              if (id) router.push(`/project/${id}`);
            }}
          />
          {canWrite('projects') ? (
            <ActionRow
              icon="create-outline"
              label="Edit"
              onPress={() => {
                const id = actionProject?.id;
                setActionProject(null);
                if (id) router.push(`/project/edit/${id}`);
              }}
            />
          ) : null}
          {canManage('projects') ? (
            <ActionRow
              icon="trash-outline"
              label="Delete"
              destructive
              onPress={() => {
                setDeleteTarget(actionProject);
                setActionProject(null);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Dialog
        visible={!!deleteTarget}
        title="Delete project?"
        message={`"${deleteTarget?.name}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
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
    <Pressable
      onPress={onPress}
      style={[styles.actionRow, { borderColor: t.border, backgroundColor: t.background }]}
    >
      <Ionicons name={icon} size={20} color={destructive ? t.destructive : t.primary} />
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
      <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
    </Pressable>
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
  statsRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  moreBtn: { padding: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
