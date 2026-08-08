import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, unwrapList } from '../../../lib/format';
import {
  Badge,
  Card,
  Dialog,
  EmptyState,
  KpiCard,
  KpiGrid,
  ListSkeleton,
  SearchBar,
  Sheet,
  useToast,
} from '../../../components/ui';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../constants/theme';

type LeadRow = {
  id: string;
  email: string;
  status?: string | null;
  createdAt: string;
};

const LEAD_STATUSES = [
  { value: 'PENDING', label: 'Pending', tone: 'warning' as const },
  { value: 'CONTACTED', label: 'Contacted', tone: 'default' as const },
  { value: 'QUALIFIED', label: 'Qualified', tone: 'success' as const },
  { value: 'ARCHIVED', label: 'Archived', tone: 'default' as const },
];

function leadStatusMeta(status?: string | null) {
  const key = String(status || 'PENDING').toUpperCase();
  return LEAD_STATUSES.find((s) => s.value === key) || LEAD_STATUSES[0];
}

export default function LeadsScreen() {
  const t = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canRead, canWrite, canManage } = usePermissions();
  const [query, setQuery] = useState('');
  const [statusLead, setStatusLead] = useState<LeadRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadRow | null>(null);

  const allowed = canRead('leads');

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['leads'],
    enabled: allowed,
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.leads.list}?take=200`);
      return unwrapList<LeadRow>(res);
    },
  });

  const leads = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => l.email.toLowerCase().includes(q));
  }, [leads, query]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: leads.length,
      pending: leads.filter((l) => !l.status || l.status === 'PENDING').length,
      today: leads.filter((l) => new Date(l.createdAt).toDateString() === today).length,
    };
  }, [leads]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(endpoints.leads.update(id), {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
      toast('Lead status updated', 'success');
      setStatusLead(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(endpoints.leads.delete(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
      toast('Lead deleted', 'success');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (!allowed) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="Leads unavailable"
          description="You do not have permission to view the email list."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <View style={{ flex: 1 }}>
          <View style={styles.statsRow}>
            <KpiGrid>
              <KpiCard label="Total" value="—" icon="mail-open-outline" tone="purple" />
              <KpiCard label="Pending" value="—" icon="time-outline" tone="warning" />
              <KpiCard label="Today" value="—" icon="today-outline" tone="success" />
            </KpiGrid>
          </View>
          <ListSkeleton rows={6} />
        </View>
      ) : error ? (
        <EmptyState
          icon="mail-open-outline"
          title="Could not load leads"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <KpiGrid>
                <KpiCard label="Total" value={String(stats.total)} icon="mail-open-outline" tone="purple" />
                <KpiCard label="Pending" value={String(stats.pending)} icon="time-outline" tone="warning" />
                <KpiCard label="Today" value={String(stats.today)} icon="today-outline" tone="success" />
              </KpiGrid>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search emails…" />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No leads found"
              description={
                query.trim() ? 'Try a different search term.' : 'Leads from your coming soon page appear here.'
              }
            />
          }
          renderItem={({ item }) => {
            const meta = leadStatusMeta(item.status);
            return (
              <Card style={styles.leadCard}>
                <View style={styles.leadRow}>
                  <View style={[styles.mailIcon, { backgroundColor: t.primary + '12' }]}>
                    <Ionicons name="mail-outline" size={18} color={t.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Ionicons name="calendar-outline" size={12} color={t.mutedForeground} />
                      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                        {formatDate(item.createdAt, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                  {canWrite('leads') ? (
                    <Pressable onPress={() => setStatusLead(item)} hitSlop={8}>
                      <Badge label={meta.label} tone={meta.tone} />
                    </Pressable>
                  ) : (
                    <Badge label={meta.label} tone={meta.tone} />
                  )}
                  {canManage('leads') ? (
                    <Pressable
                      onPress={() => setDeleteTarget(item)}
                      hitSlop={8}
                      accessibilityLabel="Delete lead"
                    >
                      <Ionicons name="trash-outline" size={18} color={t.destructive} />
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}

      <Sheet
        visible={!!statusLead}
        onClose={() => setStatusLead(null)}
        title="Update status"
      >
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, marginBottom: spacing.md }} numberOfLines={1}>
          {statusLead?.email}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {LEAD_STATUSES.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() =>
                statusLead &&
                statusMutation.mutate({ id: statusLead.id, status: opt.value })
              }
              style={[
                styles.statusRow,
                {
                  borderColor: t.border,
                  backgroundColor:
                    leadStatusMeta(statusLead?.status).value === opt.value ? t.primary + '12' : t.card,
                },
              ]}
            >
              <Badge label={opt.label} tone={opt.tone} />
              {leadStatusMeta(statusLead?.status).value === opt.value ? (
                <Ionicons name="checkmark" size={18} color={t.primary} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Dialog
        visible={!!deleteTarget}
        title="Delete lead?"
        message={`Remove ${deleteTarget?.email} from the list? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { padding: spacing.lg, paddingBottom: 0 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  leadCard: { marginBottom: spacing.sm },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mailIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
