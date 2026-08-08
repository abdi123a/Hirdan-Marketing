import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { Text } from '../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { formatDate, formatMoney, unwrapOne } from '../../lib/format';
import {
  billingCycleLabel,
  displayStatus,
  statusTone,
  subscriptionClientLabel,
  subscriptionFromApi,
  subscriptionPlanLabel,
} from '../../lib/subscriptions';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  DetailSkeleton,
  useToast,
} from '../../components/ui';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../constants/theme';

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite, canManage } = usePermissions();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subscriptionQ = useQuery({
    queryKey: ['subscription', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.subscriptions.byId(id!));
      const raw = unwrapOne<any>(res, 'subscription', 'data') || res;
      if (!raw?.id) throw new Error('Subscription not found');
      return subscriptionFromApi(raw);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(endpoints.subscriptions.delete(id!), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subs-for-client'] });
      toast('Subscription deleted', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (subscriptionQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (subscriptionQ.error || !subscriptionQ.data) {
    return (
      <EmptyState
        title="Subscription not found"
        description={(subscriptionQ.error as Error)?.message}
        actionLabel="Retry"
        onAction={() => subscriptionQ.refetch()}
        icon="layers-outline"
      />
    );
  }

  const s = subscriptionQ.data;
  const cycles = s.cycles || [];

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={subscriptionQ.isRefetching}
            onRefresh={() => subscriptionQ.refetch()}
            tintColor={t.primary}
          />
        }
      >
        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800', flex: 1 }}>
              {subscriptionPlanLabel(s)}
            </Text>
            <Badge
              label={displayStatus(s.status, s.endDate)}
              tone={statusTone(s.status, s.endDate)}
            />
          </View>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.md }}>
            {subscriptionClientLabel(s)}
          </Text>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            {formatMoney(s.amount)}
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            {billingCycleLabel(s.billingCycle)} billing
          </Text>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Field label="Client" value={subscriptionClientLabel(s)} />
          <Field label="Plan" value={s.plan} />
          {s.package?.name ? <Field label="Package" value={s.package.name} /> : null}
          <Field label="Billing cycle" value={billingCycleLabel(s.billingCycle)} />
          <Field label="Status" value={displayStatus(s.status, s.endDate)} />
          <Field label="Start date" value={s.startDate ? formatDate(s.startDate) : '—'} />
          <Field label="End date" value={s.endDate ? formatDate(s.endDate) : '—'} />
          {s.clientId ? (
            <Pressable
              onPress={() => router.push(`/client/${s.clientId}`)}
              style={[styles.linkBtn, { borderColor: t.border }]}
            >
              <Ionicons name="person-outline" size={16} color={t.primary} />
              <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.sm }}>
                Open client profile
              </Text>
            </Pressable>
          ) : null}
        </Card>

        {s.features ? (
          <Card>
            <Text
              style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 }}
            >
              FEATURES
            </Text>
            <Text style={{ color: t.foreground, lineHeight: 20 }}>{s.features}</Text>
          </Card>
        ) : null}

        {s.notes ? (
          <Card>
            <Text
              style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 }}
            >
              NOTES
            </Text>
            <Text style={{ color: t.foreground, lineHeight: 20 }}>{s.notes}</Text>
          </Card>
        ) : null}

        {cycles.length > 0 ? (
          <Card style={{ gap: spacing.sm, padding: 0, overflow: 'hidden' }}>
            <Text
              style={{
                color: t.mutedForeground,
                fontSize: fontSize.xs,
                fontWeight: '700',
                padding: spacing.lg,
                paddingBottom: 0,
              }}
            >
              BILLING CYCLES
            </Text>
            {cycles.map((cycle, i) => (
              <View
                key={cycle.id}
                style={[
                  styles.cycleRow,
                  i < cycles.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: t.border,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.foreground, fontWeight: '700' }}>
                    {cycle.label || `Cycle ${i + 1}`}
                  </Text>
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {formatDate(cycle.cycleStart)} – {formatDate(cycle.cycleEnd)}
                  </Text>
                </View>
                {cycle.taskCount != null && cycle.taskCount > 0 ? (
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {cycle.taskCount} tasks
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {canWrite('subscriptions') || canManage('subscriptions') ? (
          <View style={styles.actions}>
            {canWrite('subscriptions') ? (
              <Button
                title="Edit subscription"
                variant="outline"
                onPress={() => router.push(`/subscription/edit/${id}`)}
              />
            ) : null}
            {canManage('subscriptions') ? (
              <Button
                title="Delete"
                variant="destructive"
                onPress={() => setConfirmDelete(true)}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <Dialog
        visible={confirmDelete}
        title="Delete subscription?"
        message={`"${subscriptionPlanLabel(s)}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
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
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
