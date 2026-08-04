import { useCallback, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { unwrapList } from '../lib/format';
import { usePermissions } from './usePermissions';
import {
  computeDashboardMetrics,
  greetingForNow,
  titleCaseStatus,
  todayLabel,
  type DashClient,
  type DashExpense,
  type DashInvoice,
  type DashLead,
  type DashProject,
  type DashSubscription,
  type DashTeamMember,
  type TaskWarning,
  type TrajectoryView,
  type WorkloadItem,
} from '../lib/dashboard-math';

function mapInvoice(raw: any): DashInvoice {
  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    client: raw.client?.company || raw.client?.name || 'Unknown',
    clientId: raw.clientId || raw.client?.id,
    amount: (raw.amount || 0) / 100,
    status: titleCaseStatus(raw.status),
    date: raw.date ? String(raw.date).split('T')[0] : '',
    dueDate: raw.dueDate ? String(raw.dueDate).split('T')[0] : '',
    deposit: raw.deposit != null ? raw.deposit / 100 : undefined,
    taxRate: raw.taxRate,
    discount: raw.discount,
    discountType: raw.discountType,
    items: (raw.items || []).map((item: any) => ({
      quantity: item.quantity,
      unitPrice: (item.unitPrice || 0) / 100,
    })),
    createdAt: raw.createdAt,
  };
}

function mapSubscription(raw: any): DashSubscription {
  let status = titleCaseStatus(raw.status);
  if ((status === 'Active' || status === 'Trial') && raw.endDate) {
    const endStr = String(raw.endDate).split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    if (endStr < todayStr) status = 'Ended';
  }
  return {
    id: raw.id,
    client: raw.client?.company || raw.client?.name || 'Unknown',
    plan: raw.package?.name || raw.plan || 'Custom',
    amount: (raw.amount || 0) / 100,
    billingCycle: titleCaseStatus(raw.billingCycle),
    startDate: raw.startDate ? String(raw.startDate).split('T')[0] : '',
    endDate: raw.endDate ? String(raw.endDate).split('T')[0] : 'N/A',
    status,
  };
}

function mapProject(raw: any): DashProject {
  return {
    id: raw.id,
    name: raw.name,
    client: raw.client?.company || raw.client?.name || '',
    status: titleCaseStatus(raw.status),
    progress: raw.progress ?? 0,
    dueDate: raw.dueDate ? String(raw.dueDate).split('T')[0] : undefined,
  };
}

function mapClient(raw: any): DashClient {
  return {
    id: raw.id,
    name: raw.name,
    company: raw.company,
    status: titleCaseStatus(raw.status),
    createdAt: raw.createdAt,
  };
}

function mapTeam(raw: any): DashTeamMember {
  return {
    id: raw.id,
    name: raw.name || raw.user?.name || 'Member',
    status: titleCaseStatus(raw.status),
  };
}

async function safeList<T>(
  path: string,
  map: (raw: any) => T
): Promise<{ data: T[]; ok: boolean }> {
  try {
    const res = await apiFetch<unknown>(path);
    return { data: unwrapList(res).map(map), ok: true };
  } catch {
    return { data: [], ok: false };
  }
}

/** Paginate take/skip list endpoints (maxTake 100) until a short page. */
async function fetchAllPaged<T>(
  basePath: string,
  map: (raw: any) => T,
  pageSize = 100,
  maxPages = 50
): Promise<{ data: T[]; ok: boolean }> {
  try {
    const all: T[] = [];
    let skip = 0;
    for (let page = 0; page < maxPages; page++) {
      const sep = basePath.includes('?') ? '&' : '?';
      const res = await apiFetch<unknown>(`${basePath}${sep}take=${pageSize}&skip=${skip}`);
      const batch = unwrapList(res).map(map);
      all.push(...batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
    }
    return { data: all, ok: true };
  } catch {
    return { data: [], ok: false };
  }
}

async function fetchExpensesRange(): Promise<{ expenses: DashExpense[]; ok: boolean }> {
  const now = new Date();
  const from = `${now.getFullYear() - 4}-01-01`;
  const to = `${now.getFullYear()}-12-31`;
  try {
    const all: DashExpense[] = [];
    let page = 1;
    let pages = 1;
    do {
      const res = await apiFetch<{
        expenses: any[];
        pages?: number;
      }>(`/expenses?from=${from}&to=${to}&limit=200&page=${page}`);
      const batch = res.expenses || [];
      all.push(
        ...batch.map((e) => ({
          id: e.id,
          amount: e.amount || 0,
          date: e.date ? String(e.date).split('T')[0] : '',
        }))
      );
      pages = res.pages || 1;
      page += 1;
    } while (page <= pages && page <= 20);
    return { expenses: all, ok: true };
  } catch {
    return { expenses: [], ok: false };
  }
}

export function useDashboardData() {
  const { user, canRead, canWrite, isAdmin } = usePermissions();
  const [trajectoryView, setTrajectoryView] = useState<TrajectoryView>('monthly');

  const isStaffView =
    user?.role === 'staff' || (!canRead('invoices') && !canRead('financial_reports'));

  const settingsQ = useQuery({
    queryKey: ['dashboard-settings'],
    queryFn: async () => {
      const res = await apiFetch<{ settings?: { currency?: string }; currency?: string }>(
        endpoints.settings.get
      );
      return res.settings?.currency || res.currency || 'USD';
    },
    staleTime: 5 * 60_000,
  });

  const notifQ = useQuery({
    queryKey: ['notif-counts'],
    queryFn: () =>
      apiFetch<{ total: number; unread: number }>(endpoints.notifications.counts),
  });

  const queries = useQueries({
    queries: [
      {
        queryKey: ['dashboard-clients'],
        queryFn: () => safeList(`${endpoints.clients.list}?take=100`, mapClient),
        enabled: canRead('clients'),
      },
      {
        queryKey: ['dashboard-invoices'],
        queryFn: () => fetchAllPaged(endpoints.invoices.list, mapInvoice),
        enabled: canRead('invoices'),
      },
      {
        queryKey: ['dashboard-projects'],
        queryFn: () => safeList(`${endpoints.projects.list}?take=100`, mapProject),
        enabled: canRead('projects'),
      },
      {
        queryKey: ['dashboard-subscriptions'],
        queryFn: () => fetchAllPaged(endpoints.subscriptions.list, mapSubscription),
        enabled: canRead('subscriptions'),
      },
      {
        queryKey: ['dashboard-team'],
        queryFn: () => safeList(`${endpoints.team.list}?take=200`, mapTeam),
        enabled: canRead('team'),
      },
      {
        queryKey: ['dashboard-leads'],
        queryFn: () =>
          safeList(`${endpoints.leads.list}?take=200`, (raw) => ({
            id: raw.id,
            createdAt: raw.createdAt,
          }) as DashLead),
        enabled: canRead('leads'),
      },
      {
        queryKey: ['dashboard-expenses'],
        queryFn: fetchExpensesRange,
        enabled: canRead('expenses'),
      },
      {
        queryKey: ['dashboard-task-analytics'],
        queryFn: async () => {
          try {
            return await apiFetch<{
              warnings?: TaskWarning[];
              workload?: WorkloadItem[];
            }>(endpoints.tasks.analyticsDashboard);
          } catch {
            return { warnings: [], workload: [] };
          }
        },
        enabled: isAdmin && canRead('projects'),
      },
    ],
  });

  const [
    clientsQ,
    invoicesQ,
    projectsQ,
    subscriptionsQ,
    teamQ,
    leadsQ,
    expensesQ,
    analyticsQ,
  ] = queries;

  const clients = canRead('clients') ? clientsQ.data?.data || [] : [];
  const invoices = canRead('invoices') ? invoicesQ.data?.data || [] : [];
  const projects = canRead('projects') ? projectsQ.data?.data || [] : [];
  const subscriptions = canRead('subscriptions') ? subscriptionsQ.data?.data || [] : [];
  const team = canRead('team') ? teamQ.data?.data || [] : [];
  const leads = canRead('leads') ? leadsQ.data?.data || [] : [];
  const expenses = canRead('expenses') ? expensesQ.data?.expenses || [] : [];
  const expensesAvailable = Boolean(canRead('expenses') && expensesQ.data?.ok);
  const warnings = analyticsQ.data?.warnings || [];
  const workload = analyticsQ.data?.workload || [];

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        invoices,
        subscriptions,
        projects,
        clients,
        leads,
        team,
        expenses,
        expensesAvailable,
        trajectoryView,
        warnings,
        workload,
        canRead: (m) => canRead(m as any),
      }),
    [
      invoices,
      subscriptions,
      projects,
      clients,
      leads,
      team,
      expenses,
      expensesAvailable,
      trajectoryView,
      warnings,
      workload,
      canRead,
    ]
  );

  const isLoading =
    (canRead('clients') && clientsQ.isLoading) ||
    (canRead('invoices') && invoicesQ.isLoading) ||
    (canRead('projects') && projectsQ.isLoading) ||
    (canRead('subscriptions') && subscriptionsQ.isLoading) ||
    (canRead('expenses') && expensesQ.isLoading);

  const isRefreshing = queries.some((q) => q.isRefetching) || notifQ.isRefetching;

  const refresh = useCallback(async () => {
    await Promise.all([
      ...queries.map((q) => q.refetch()),
      notifQ.refetch(),
      settingsQ.refetch(),
    ]);
  }, [queries, notifQ, settingsQ]);

  const fullName =
    (user?.name || '').trim() ||
    (user?.email || '').trim().split('@')[0] ||
    'there';
  const firstName = fullName.split(/\s+/)[0] || 'there';
  const roleLabel =
    user?.role === 'admin' ? 'Admin' : user?.role === 'manager' ? 'Manager' : 'Team';
  const currency = settingsQ.data || 'USD';

  return {
    isStaffView,
    isLoading,
    isRefreshing,
    refresh,
    currency,
    unread: notifQ.data?.unread || 0,
    greeting: greetingForNow(),
    firstName,
    fullName,
    todayLabel: todayLabel(),
    roleLabel,
    trajectoryView,
    setTrajectoryView,
    metrics,
    canRead,
    canWrite,
    permissions: {
      canWriteExpense: canWrite('expenses'),
      canWriteInvoice: canWrite('invoices'),
      canWriteProforma: canWrite('proforma'),
      canWriteClient: canWrite('clients'),
      canWriteProject: canWrite('projects'),
      canReadReports: canRead('financial_reports'),
      canWriteSocial: canWrite('social_media'),
      canReadSettings: canRead('settings'),
      canWriteEmail: canWrite('email'),
      canWriteTransfer: canWrite('transfers'),
      canReadTeam: canRead('team') && team.length > 0,
      canReadClients: canRead('clients'),
      canReadCalendar: canRead('calendar'),
      canReadProjects: canRead('projects'),
    },
    showTeamStat: team.length > 0,
    showLeadsStat: leads.length > 0 || metrics.newLeadsThisMonth > 0,
    expensesAvailable,
  };
}
