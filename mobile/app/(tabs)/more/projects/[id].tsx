import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { formatDate, formatMoney, unwrapOne } from '../../../../lib/format';
import { Badge, Card, EmptyState, ProgressBar, DetailSkeleton } from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../../constants/theme';

function titleCase(raw?: string) {
  return String(raw || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();

  const projectQ = useQuery({
    queryKey: ['project', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.projects.byId(id!));
      const project = unwrapOne<any>(res, 'project', 'data') || res;
      if (!project?.id) throw new Error('Project not found');
      return project;
    },
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
  const clientLabel = p.client?.company || p.client?.name || p.clientId;

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
          <Badge label={titleCase(p.status)} />
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
        <Field label="Client" value={clientLabel} />
        <Field label="Priority" value={titleCase(p.priority)} />
        <Field label="Start" value={p.startDate ? formatDate(p.startDate) : '—'} />
        <Field label="Due" value={p.dueDate ? formatDate(p.dueDate) : '—'} />
        <Field
          label="Budget"
          value={p.budget != null ? formatMoney(typeof p.budget === 'number' ? p.budget : 0) : '—'}
        />
        {p.clientId ? (
          <Pressable
            onPress={() => router.push(`/(tabs)/clients/${p.clientId}`)}
            style={[styles.linkBtn, { borderColor: t.border }]}
          >
            <Ionicons name="person-outline" size={16} color={t.primary} />
            <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.sm }}>
              Open client profile
            </Text>
          </Pressable>
        ) : null}
      </Card>
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
});
