import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints, type ClientSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import {
  formatDate,
  formatMoney,
  moneyAmount,
  recordDate,
  unwrapList,
  unwrapOne,
} from '../../../lib/format';
import {
  clientDisplayName,
  clientFromApi,
  clientLocation,
  clientStatusLabel,
  clientStatusTone,
  isIndividual,
} from '../../../lib/clients';
import { ClientPortalCard } from '../../../components/ClientPortalCard';
import { ClientMeetingsSection } from '../../../components/ClientMeetingsSection';
import { ClientDocumentsSection } from '../../../components/ClientDocumentsSection';
import { ClientSocialSection } from '../../../components/ClientSocialSection';
import { ClientPlannerSection } from '../../../components/ClientPlannerSection';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ListRow,
  ProgressBar,
  DetailSkeleton,
  Tabs,
} from '../../../components/ui';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../hooks/useTheme';
import { brand, fontSize, radius, spacing } from '../../../constants/theme';

type TabKey =
  | 'overview'
  | 'projects'
  | 'billing'
  | 'subscriptions'
  | 'social'
  | 'planner'
  | 'documents'
  | 'meetings';

const TAB_KEYS: TabKey[] = [
  'overview',
  'projects',
  'billing',
  'subscriptions',
  'social',
  'planner',
  'documents',
  'meetings',
];

function invoiceTone(status?: string): 'default' | 'success' | 'warning' | 'destructive' {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'success';
  if (s === 'OVERDUE') return 'destructive';
  if (s === 'PENDING' || s === 'PARTIALLY_PAID' || s === 'SENT') return 'warning';
  return 'default';
}

function titleCase(raw?: string) {
  return String(raw || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function ClientDetailScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const t = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canWrite, canRead } = usePermissions();
  const initialTab = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'overview';
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (TAB_KEYS.includes(tabParam as TabKey)) setTab(tabParam as TabKey);
  }, [tabParam]);

  const clientQ = useQuery({
    queryKey: ['client', id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const listRes = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
        const fromList = unwrapList(listRes)
          .map((c) => clientFromApi(c as any))
          .find((c) => c.id === id);
        if (fromList) return { client: fromList, nested: null as any };
      } catch {
        /* continue */
      }

      const res = await apiFetch<unknown>(endpoints.clients.byId(id!));
      const raw = unwrapOne<any>(res, 'client', 'data');
      if (!raw) throw new Error('Client not found');
      return {
        client: clientFromApi(raw),
        nested: {
          projects: raw.projects || [],
          invoices: raw.invoices || [],
          proformas: raw.proformas || [],
          subscriptions: raw.subscriptions || [],
        },
      };
    },
  });

  const projectsQ = useQuery({
    queryKey: ['projects-for-client', id],
    enabled: !!id && canRead('projects'),
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.projects.list}?take=100`);
      return unwrapList(res).filter((p: any) => p.clientId === id || p.client?.id === id);
    },
  });

  const invoicesQ = useQuery({
    queryKey: ['invoices-for-client', id],
    enabled: !!id && canRead('invoices'),
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.invoices.list}?take=100`);
      return unwrapList(res).filter((i: any) => i.clientId === id || i.client?.id === id);
    },
  });

  const proformasQ = useQuery({
    queryKey: ['proformas-for-client', id],
    enabled: !!id && canRead('proforma'),
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.proformas.list}?take=100`);
      return unwrapList(res).filter((p: any) => p.clientId === id || p.client?.id === id);
    },
  });

  const subscriptionsQ = useQuery({
    queryKey: ['subs-for-client', id],
    enabled: !!id && canRead('subscriptions'),
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.subscriptions.list}?take=100`);
      return unwrapList(res).filter((s: any) => s.clientId === id || s.client?.id === id);
    },
  });

  const meetingsQ = useQuery({
    queryKey: ['meetings-for-client', id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const res = await apiFetch<{ meetings: any[] }>(endpoints.clients.meetings(id!));
        return res.meetings || [];
      } catch {
        return [];
      }
    },
  });

  const client = clientQ.data?.client as ClientSummary | undefined;
  const nested = clientQ.data?.nested;

  const projects = useMemo(() => {
    if (projectsQ.data?.length) return projectsQ.data;
    return nested?.projects || [];
  }, [projectsQ.data, nested]);

  const invoices = useMemo(() => {
    if (invoicesQ.data?.length) return invoicesQ.data;
    return nested?.invoices || [];
  }, [invoicesQ.data, nested]);

  const proformas = useMemo(() => {
    if (proformasQ.data?.length) return proformasQ.data;
    return nested?.proformas || [];
  }, [proformasQ.data, nested]);

  const subscriptions = useMemo(() => {
    if (subscriptionsQ.data?.length) return subscriptionsQ.data;
    return nested?.subscriptions || [];
  }, [subscriptionsQ.data, nested]);

  const meetings = meetingsQ.data || [];

  const totalRevenue = useMemo(() => {
    return invoices.reduce((sum: number, inv: any) => {
      const amount = moneyAmount(inv);
      const status = String(inv.status || '').toUpperCase();
      if (status === 'PAID') return sum + amount;
      if (status === 'PARTIALLY_PAID') return sum + (inv.deposit || 0);
      return sum;
    }, 0);
  }, [invoices]);

  const pendingRevenue = useMemo(() => {
    return invoices.reduce((sum: number, inv: any) => {
      const amount = moneyAmount(inv);
      const status = String(inv.status || '').toUpperCase();
      if (status === 'PENDING' || status === 'OVERDUE') return sum + amount;
      if (status === 'PARTIALLY_PAID') return sum + Math.max(0, amount - (inv.deposit || 0));
      return sum;
    }, 0);
  }, [invoices]);

  const activeProjectsCount =
    client?._count?.projects ??
    projects.filter((p: any) => String(p.status).toUpperCase() === 'IN_PROGRESS').length;

  const activeSubsCount = subscriptions.filter(
    (s: any) => String(s.status).toUpperCase() === 'ACTIVE'
  ).length;

  const refreshing =
    clientQ.isRefetching ||
    projectsQ.isRefetching ||
    invoicesQ.isRefetching ||
    subscriptionsQ.isRefetching ||
    meetingsQ.isRefetching;

  const onRefresh = () => {
    clientQ.refetch();
    projectsQ.refetch();
    invoicesQ.refetch();
    proformasQ.refetch();
    subscriptionsQ.refetch();
    meetingsQ.refetch();
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['client-documents', id] });
      queryClient.invalidateQueries({ queryKey: ['social-by-client', id] });
      queryClient.invalidateQueries({ queryKey: ['content-posts', id] });
    }
  };

  if (clientQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (clientQ.error || !client) {
    return (
      <EmptyState
        title="Client not found"
        description={(clientQ.error as Error)?.message || 'This client may have been removed.'}
        actionLabel="Retry"
        onAction={() => clientQ.refetch()}
        icon="person-outline"
      />
    );
  }

  const services = Array.from(
    new Set(
      invoices
        .flatMap((inv: any) => (inv.items || []).map((item: any) => item.description as string))
        .filter((d: string): d is string => Boolean(d))
    )
  ).slice(0, 5) as string[];

  const displayName = clientDisplayName(client);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
    >
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Avatar name={displayName} initials={client.initials} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800', flexShrink: 1 }}>
                {displayName}
              </Text>
              <Badge label={clientStatusLabel(client.status)} tone={clientStatusTone(client.status)} />
              {isIndividual(client) ? <Badge label="Individual" tone="default" /> : null}
            </View>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
              {client.name}
              {client.industry ? ` · ${client.industry}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {canWrite('clients') ? (
            <Pressable
              onPress={() => router.push(`/(tabs)/clients/edit/${client.id}`)}
              style={[styles.outlineBtn, { borderColor: t.border }]}
            >
              <Ionicons name="settings-outline" size={16} color={t.foreground} />
              <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs }}>
                Edit Profile
              </Text>
            </Pressable>
          ) : null}
          {canWrite('projects') ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/more/projects/add',
                  params: { clientId: client.id },
                })
              }
              style={[styles.solidBtn, { backgroundColor: t.primary }]}
            >
              <Ionicons name="add" size={16} color={t.primaryForeground} />
              <Text style={{ color: t.primaryForeground, fontWeight: '700', fontSize: fontSize.xs }}>
                New Project
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard icon="trending-up-outline" label="Total revenue" value={formatMoney(totalRevenue)} color={t.success} />
        <StatCard icon="card-outline" label="Pending" value={formatMoney(pendingRevenue)} color={t.warning} />
        <StatCard icon="briefcase-outline" label="Projects" value={String(activeProjectsCount)} color="#3B82F6" />
        <StatCard icon="layers-outline" label="Active subs" value={String(activeSubsCount)} color={brand.purple} />
      </View>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'projects', label: `Projects (${projects.length})` },
          { key: 'billing', label: 'Financials' },
          { key: 'subscriptions', label: `Subs (${subscriptions.length})` },
          { key: 'social', label: 'Social' },
          { key: 'planner', label: 'Planner' },
          { key: 'documents', label: 'Docs' },
          { key: 'meetings', label: `Meetings (${meetings.length})` },
        ]}
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {tab === 'overview' ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <Text style={[styles.sectionTitle, { color: t.foreground }]}>Professional profile</Text>
              <Field
                icon="mail-outline"
                label="Email"
                value={client.email}
                onPress={client.email ? () => Linking.openURL(`mailto:${client.email}`) : undefined}
              />
              <Field
                icon="call-outline"
                label="Phone"
                value={client.phone}
                onPress={client.phone ? () => Linking.openURL(`tel:${client.phone}`) : undefined}
              />
              <Field
                icon="globe-outline"
                label="Website"
                value={client.website}
                onPress={
                  client.website
                    ? () =>
                        Linking.openURL(
                          client.website!.startsWith('http')
                            ? client.website!
                            : `https://${client.website}`
                        )
                    : undefined
                }
              />
              <Field icon="location-outline" label="Location" value={clientLocation(client)} />
              <Field icon="business-outline" label="Industry" value={client.industry} />
              <Field icon="calendar-outline" label="Member since" value={formatDate(client.createdAt)} />
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: t.foreground }]}>Notes</Text>
              <Text style={{ color: client.notes ? t.foreground : t.mutedForeground, lineHeight: 22 }}>
                {client.notes || 'No notes on file for this client yet.'}
              </Text>
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: t.foreground }]}>Provided services</Text>
              {services.length > 0 ? (
                services.map((s) => (
                  <View key={s} style={styles.chipRow}>
                    <Ionicons name="checkmark-circle" size={16} color={t.success} />
                    <Text style={{ color: t.foreground, flex: 1 }}>{s}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
                  No specific services recorded via billing
                </Text>
              )}
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: t.foreground }]}>Billing automation</Text>
              <Field
                label="Invoice day"
                value={client.invoiceGenerationDay != null ? String(client.invoiceGenerationDay) : '—'}
              />
              <Field
                label="Payment reminder (days)"
                value={client.paymentReminderDelay != null ? String(client.paymentReminderDelay) : '—'}
              />
              <Field
                label="Overdue notice (days)"
                value={client.overdueNoticeDelay != null ? String(client.overdueNoticeDelay) : '—'}
              />
            </Card>

            {canWrite('clients') ? <ClientPortalCard client={client} /> : null}
          </>
        ) : null}

        {tab === 'projects' ? (
          <>
            {canWrite('projects') ? (
              <ButtonRow
                label="New project"
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/more/projects/add',
                    params: { clientId: client.id },
                  })
                }
              />
            ) : null}
            {projects.length === 0 ? (
              <EmptyState
                title="No projects"
                description="No projects linked to this client yet."
                icon="briefcase-outline"
              />
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {projects.map((p: any, i: number) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/(tabs)/more/projects/${p.id}`)}
                    style={[
                      styles.listItem,
                      i < projects.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: t.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <Text style={{ color: t.foreground, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Badge label={titleCase(p.status)} tone="default" />
                      </View>
                      {p.dueDate ? (
                        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                          Due {formatDate(p.dueDate)}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <ProgressBar progress={p.progress ?? 0} height={6} />
                        </View>
                        <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700' }}>
                          {p.progress ?? 0}%
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
                  </Pressable>
                ))}
              </Card>
            )}
          </>
        ) : null}

        {tab === 'billing' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: t.foreground }]}>Invoices</Text>
              {canWrite('invoices') ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/money/invoice-add',
                      params: { clientId: client.id },
                    })
                  }
                >
                  <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.xs }}>
                    + New invoice
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" icon="document-text-outline" />
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {invoices.map((inv: any) => (
                  <ListRow
                    key={inv.id}
                    title={inv.invoiceNumber || 'Invoice'}
                    subtitle={formatDate(recordDate(inv))}
                    right={
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Badge label={titleCase(inv.status)} tone={invoiceTone(inv.status)} />
                        <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.sm }}>
                          {formatMoney(moneyAmount(inv), inv.currency)}
                        </Text>
                      </View>
                    }
                    onPress={() => router.push(`/(tabs)/money/invoice/${inv.id}`)}
                  />
                ))}
              </Card>
            )}

            <View style={[styles.sectionHeader, { marginTop: spacing.sm }]}>
              <Text style={[styles.sectionTitle, { color: t.foreground }]}>Proformas</Text>
              {canWrite('proforma') ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/money/proforma-add',
                      params: { clientId: client.id },
                    })
                  }
                >
                  <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.xs }}>
                    + New proforma
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {proformas.length === 0 ? (
              <EmptyState title="No proformas" icon="document-outline" />
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {proformas.map((p: any) => (
                  <ListRow
                    key={p.id}
                    title={p.proformaNumber || 'Proforma'}
                    subtitle={formatDate(recordDate(p))}
                    right={
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Badge label={titleCase(p.status)} tone="default" />
                        <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.sm }}>
                          {formatMoney(moneyAmount(p), p.currency)}
                        </Text>
                      </View>
                    }
                    onPress={() => router.push(`/(tabs)/money/proforma/${p.id}`)}
                  />
                ))}
              </Card>
            )}
          </>
        ) : null}

        {tab === 'subscriptions' ? (
          subscriptions.length === 0 ? (
            <EmptyState title="No subscriptions" icon="card-outline" />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {subscriptions.map((s: any, i: number) => (
                <View
                  key={s.id}
                  style={[
                    styles.listItem,
                    i < subscriptions.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: t.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: t.foreground, fontWeight: '700' }}>
                      {s.package?.name || s.plan || 'Plan'}
                    </Text>
                    <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                      {titleCase(s.billingCycle)} · {formatDate(s.startDate)}
                      {s.endDate ? ` → ${formatDate(s.endDate)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={titleCase(s.status)} tone={clientStatusTone(s.status)} />
                    <Text style={{ color: t.foreground, fontWeight: '800' }}>
                      {formatMoney(s.amount || 0)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )
        ) : null}

        {tab === 'social' ? <ClientSocialSection clientId={client.id} /> : null}

        {tab === 'planner' ? (
          <ClientPlannerSection clientId={client.id} clientName={displayName} />
        ) : null}

        {tab === 'documents' ? <ClientDocumentsSection clientId={client.id} /> : null}

        {tab === 'meetings' ? (
          <ClientMeetingsSection
            clientId={client.id}
            clientName={displayName}
            meetings={meetings}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function ButtonRow({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.outlineBtn, { borderColor: t.border, alignSelf: 'flex-start' }]}
    >
      <Ionicons name="add" size={16} color={t.primary} />
      <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.xs }}>{label}</Text>
    </Pressable>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  const t = useTheme();
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

function Field({
  icon,
  label,
  value,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.field}>
      {icon ? (
        <View style={[styles.fieldIcon, { backgroundColor: t.muted }]}>
          <Ionicons name={icon} size={16} color={t.mutedForeground} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>
          {label}
        </Text>
        <Text
          style={{
            color: onPress ? t.primary : t.foreground,
            fontSize: fontSize.md,
            fontWeight: onPress ? '600' : '500',
            marginTop: 2,
          }}
        >
          {value || '—'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  solidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  statCard: { flexBasis: '47%', flexGrow: 1, gap: 6, minWidth: 140 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
