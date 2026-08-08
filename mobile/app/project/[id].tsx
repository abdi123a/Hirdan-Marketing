import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { Text } from '../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { formatDate, formatMajorMoney, unwrapOne } from '../../lib/format';
import {
  projectClientLabel,
  projectFromApi,
  statusTone,
  titleCasePriority,
  titleCaseStatus,
} from '../../lib/projects';
import {
  Avatar,
  Badge,
  Card,
  DetailSkeleton,
  Dialog,
  EmptyState,
  ProgressBar,
  useToast,
} from '../../components/ui';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../constants/theme';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite, canManage } = usePermissions();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const projectQ = useQuery({
    queryKey: ['project', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.projects.byId(id!));
      const project = unwrapOne<any>(res, 'project', 'data') || res;
      if (!project?.id) throw new Error('Project not found');
      return projectFromApi(project);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(endpoints.projects.delete(id!), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
      toast('Project deleted', 'success');
      router.replace('/(tabs)/more/projects');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (projectQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (projectQ.error || !projectQ.data) {
    return (
      <EmptyState
        title="Project not found"
        description={(projectQ.error as Error)?.message}
        actionLabel="Retry"
        onAction={() => projectQ.refetch()}
        icon="briefcase-outline"
      />
    );
  }

  const p = projectQ.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={projectQ.isRefetching}
          onRefresh={() => projectQ.refetch()}
          tintColor={t.primary}
        />
      }
    >
      <Card style={{ gap: spacing.md }}>
        <View style={styles.rowBetween}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800', flex: 1 }}>
            {p.name}
          </Text>
          <Badge label={titleCaseStatus(p.status)} tone={statusTone(p.status)} />
        </View>
        {p.description ? (
          <Text style={{ color: t.mutedForeground, lineHeight: 20 }}>{p.description}</Text>
        ) : null}
        <View style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
              PROGRESS
            </Text>
            <Text style={{ color: t.foreground, fontWeight: '800' }}>{p.progress ?? 0}%</Text>
          </View>
          <ProgressBar progress={p.progress ?? 0} height={8} />
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Field label="Client" value={projectClientLabel(p)} />
        <Field label="Priority" value={titleCasePriority(p.priority)} />
        <Field label="Start" value={p.startDate ? formatDate(p.startDate) : '—'} />
        <Field label="Due" value={p.dueDate ? formatDate(p.dueDate) : '—'} />
        <Field
          label="Budget"
          value={p.budget != null ? formatMajorMoney(Number(p.budget)) : '—'}
        />
        {p.clientId ? (
          <Pressable
            onPress={() => router.push(`/client/${p.clientId}`)}
            style={[styles.linkBtn, { borderColor: t.border }]}
          >
            <Ionicons name="person-outline" size={16} color={t.primary} />
            <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.sm }}>
              Open client profile
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {p.teamMembers && p.teamMembers.length > 0 ? (
        <Card style={{ gap: spacing.md }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>Team</Text>
          {p.teamMembers.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <Avatar name={m.name} size={36} />
              <Text style={{ color: t.foreground, fontWeight: '600', flex: 1 }}>{m.name}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {canWrite('projects') ? (
          <Pressable
            onPress={() => router.push(`/project/edit/${p.id}`)}
            style={[styles.actionBtn, { backgroundColor: t.primary, flex: 1 }]}
          >
            <Ionicons name="create-outline" size={18} color={t.primaryForeground} />
            <Text style={{ color: t.primaryForeground, fontWeight: '700' }}>Edit</Text>
          </Pressable>
        ) : null}
        {canManage('projects') ? (
          <Pressable
            onPress={() => setConfirmDelete(true)}
            style={[styles.actionBtn, { backgroundColor: t.destructive + '18', flex: 1 }]}
          >
            <Ionicons name="trash-outline" size={18} color={t.destructive} />
            <Text style={{ color: t.destructive, fontWeight: '700' }}>Delete</Text>
          </Pressable>
        ) : null}
      </View>

      <Dialog
        visible={confirmDelete}
        title="Delete project?"
        message={`"${p.name}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '600' }}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
});
