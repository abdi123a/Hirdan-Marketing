import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  endpoints,
  type ExpenseSummary,
  type InvoiceSummary,
  type ProformaSummary,
} from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, recordDate, unwrapList } from '../../../lib/format';
import {
  computeExpenseListStats,
  computeInvoiceListStats,
  titleCaseStatus,
} from '../../../lib/documents';
import {
  Badge,
  Dialog,
  EmptyState,
  KpiCard,
  KpiGrid,
  ListRow,
  SearchBar,
  SegmentedControl,
  ListSkeleton,
  useToast,
} from '../../../components/ui';
import { useAccounts } from '../../../hooks/useAccounts';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, radius } from '../../../constants/theme';

type TabKey = 'invoices' | 'proformas' | 'expenses';

type InvoiceRow = InvoiceSummary & {
  amount?: number;
  deposit?: number | null;
  client?: { id?: string; company?: string; name?: string; email?: string };
};

type ProformaRow = ProformaSummary & {
  amount?: number;
  client?: { id?: string; company?: string; name?: string };
};

type ExpenseRow = ExpenseSummary & {
  account?: { name?: string; currency?: string };
};

function invoiceTone(status?: string): 'default' | 'success' | 'warning' | 'destructive' {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID' || s === 'ACCEPTED') return 'success';
  if (s === 'OVERDUE' || s === 'EXPIRED') return 'destructive';
  if (s === 'SENT' || s === 'PARTIALLY_PAID' || s === 'PENDING') return 'warning';
  return 'default';
}

export default function MoneyScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite, canRead, isAdmin } = usePermissions();
  const [tab, setTab] = useState<TabKey>('invoices');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: TabKey;
    id: string;
    label: string;
  } | null>(null);

  const canMutateInvoices = isAdmin || canWrite('invoices');
  const canMutateProformas = isAdmin || canWrite('proforma');
  const canMutateExpenses = isAdmin || canWrite('expenses');

  const settingsQ = useQuery({
    queryKey: ['agency-settings'],
    queryFn: async () => {
      const res = await apiFetch<any>(endpoints.settings.get);
      return res.settings || res;
    },
  });
  const currency = settingsQ.data?.currency || 'USD';

  const invoices = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiFetch<unknown>(`${endpoints.invoices.list}?take=100`),
    enabled: canRead('invoices'),
  });
  const proformas = useQuery({
    queryKey: ['proformas'],
    queryFn: () => apiFetch<unknown>(`${endpoints.proformas.list}?take=100`),
    enabled: canRead('proforma'),
  });
  const expenses = useQuery({
    queryKey: ['expenses'],
    queryFn: () => apiFetch<unknown>(`${endpoints.expenses.list}?limit=100`),
    enabled: canRead('expenses'),
  });
  const accounts = useAccounts({ enabled: tab === 'expenses' && canRead('expenses') });

  const active = tab === 'invoices' ? invoices : tab === 'proformas' ? proformas : expenses;
  const invoiceList = unwrapList<InvoiceRow>(invoices.data);
  const proformaList = unwrapList<ProformaRow>(proformas.data);
  const expenseList = unwrapList<ExpenseRow>(expenses.data);
  const accountList = useMemo(() => accounts.data ?? [], [accounts.data]);

  const q = search.trim().toLowerCase();

  const filteredInvoices = useMemo(() => {
    if (!q) return invoiceList;
    return invoiceList.filter((item) => {
      const client = item.client?.company || item.client?.name || '';
      return (
        item.invoiceNumber?.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        String(item.client?.email || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [invoiceList, q]);

  const filteredProformas = useMemo(() => {
    if (!q) return proformaList;
    return proformaList.filter((item) => {
      const client = item.client?.company || item.client?.name || '';
      return item.proformaNumber?.toLowerCase().includes(q) || client.toLowerCase().includes(q);
    });
  }, [proformaList, q]);

  const filteredExpenses = useMemo(() => {
    if (!q) return expenseList;
    return expenseList.filter((item) => {
      return (
        item.description?.toLowerCase().includes(q) ||
        String(item.category || '')
          .toLowerCase()
          .includes(q) ||
        String(item.account?.name || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [expenseList, q]);

  const invoiceStats = useMemo(() => computeInvoiceListStats(invoiceList), [invoiceList]);
  const expenseStats = useMemo(
    () => computeExpenseListStats(expenseList, accountList),
    [expenseList, accountList]
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const path =
        deleteTarget.kind === 'invoices'
          ? endpoints.invoices.delete(deleteTarget.id)
          : deleteTarget.kind === 'proformas'
            ? endpoints.proformas.delete(deleteTarget.id)
            : endpoints.expenses.delete(deleteTarget.id);
      return apiFetch(path, { method: 'DELETE' });
    },
    onSuccess: () => {
      if (!deleteTarget) return;
      const key =
        deleteTarget.kind === 'invoices'
          ? 'invoices'
          : deleteTarget.kind === 'proformas'
            ? 'proformas'
            : 'expenses';
      queryClient.invalidateQueries({ queryKey: [key] });
      toast(`${deleteTarget.label} deleted`, 'success');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const fab =
    tab === 'invoices' && canMutateInvoices
      ? { label: 'New invoice', href: '/(tabs)/money/invoice-add' as const }
      : tab === 'proformas' && canMutateProformas
        ? { label: 'New proforma', href: '/(tabs)/money/proforma-add' as const }
        : tab === 'expenses' && canMutateExpenses
          ? { label: 'Add expense', href: '/(tabs)/money/expense-add' as const }
          : null;

  const searchPlaceholder =
    tab === 'invoices'
      ? 'Search invoices…'
      : tab === 'proformas'
        ? 'Search proformas…'
        : 'Search expenses…';

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.header}>
        <SegmentedControl
          options={[
            ...(canRead('invoices') ? [{ label: 'Invoices', value: 'invoices' as const }] : []),
            ...(canRead('proforma') ? [{ label: 'Proformas', value: 'proformas' as const }] : []),
            ...(canRead('expenses') ? [{ label: 'Expenses', value: 'expenses' as const }] : []),
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setSearch('');
          }}
        />
        <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder} />
      </View>

      {active.isLoading ? (
        <ListSkeleton rows={5} avatar={false} padding={0} />
      ) : active.error ? (
        <EmptyState
          title="Could not load data"
          description={(active.error as Error).message}
          actionLabel="Retry"
          onAction={() => active.refetch()}
          icon="alert-circle-outline"
        />
      ) : tab === 'invoices' ? (
        <FlashList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: fab ? 88 : spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={invoices.isRefetching} onRefresh={invoices.refetch} tintColor={t.primary} />
          }
          ListHeaderComponent={
            <View style={styles.statsPad}>
              <KpiGrid>
                <KpiCard
                  label="Paid"
                  value={formatMoney(invoiceStats.paid, currency)}
                  hint={`${invoiceStats.paidCount} invoice${invoiceStats.paidCount === 1 ? '' : 's'}`}
                  hintTone="success"
                  icon="checkmark-circle-outline"
                  tone="success"
                />
                <KpiCard
                  label="Pending"
                  value={formatMoney(invoiceStats.pending, currency)}
                  hint={`${invoiceStats.pendingCount} invoice${invoiceStats.pendingCount === 1 ? '' : 's'}`}
                  hintTone="warning"
                  icon="time-outline"
                  tone="warning"
                />
                <KpiCard
                  label="Overdue"
                  value={formatMoney(invoiceStats.overdue, currency)}
                  hint={`${invoiceStats.overdueCount} invoice${invoiceStats.overdueCount === 1 ? '' : 's'}`}
                  hintTone="destructive"
                  icon="alert-circle-outline"
                  tone="danger"
                  fullWidth
                />
              </KpiGrid>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No invoices"
              description="Create your first invoice to get paid."
              actionLabel={canMutateInvoices ? 'New invoice' : undefined}
              onAction={canMutateInvoices ? () => router.push('/(tabs)/money/invoice-add') : undefined}
              icon="document-text-outline"
            />
          }
          renderItem={({ item }) => {
            const total = moneyAmount(item);
            const balance = Math.max(0, total - (item.deposit || 0));
            return (
              <ListRow
                title={item.invoiceNumber}
                subtitle={`${item.client?.company || item.client?.name || 'Client'} · ${formatDate(recordDate(item))}`}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={titleCaseStatus(item.status)} tone={invoiceTone(item.status)} />
                    <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>
                      {formatMoney(balance, item.currency || currency)}
                    </Text>
                  </View>
                }
                onPress={() => router.push(`/(tabs)/money/invoice/${item.id}`)}
                onLongPress={
                  canMutateInvoices
                    ? () =>
                        setDeleteTarget({
                          kind: 'invoices',
                          id: item.id,
                          label: item.invoiceNumber,
                        })
                    : undefined
                }
              />
            );
          }}
        />
      ) : tab === 'proformas' ? (
        <FlashList
          data={filteredProformas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: fab ? 88 : spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={proformas.isRefetching} onRefresh={proformas.refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No proformas"
              description="Create a proforma quote for a client."
              actionLabel={canMutateProformas ? 'New proforma' : undefined}
              onAction={canMutateProformas ? () => router.push('/(tabs)/money/proforma-add') : undefined}
              icon="document-outline"
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.proformaNumber}
              subtitle={`${item.client?.company || item.client?.name || 'Client'} · ${formatDate(recordDate(item))}`}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={titleCaseStatus(item.status)} tone={invoiceTone(item.status)} />
                  <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>
                    {formatMoney(moneyAmount(item), item.currency || currency)}
                  </Text>
                </View>
              }
              onPress={() => router.push(`/(tabs)/money/proforma/${item.id}`)}
              onLongPress={
                canMutateProformas
                  ? () =>
                      setDeleteTarget({
                        kind: 'proformas',
                        id: item.id,
                        label: item.proformaNumber,
                      })
                  : undefined
              }
            />
          )}
        />
      ) : (
        <FlashList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: fab ? 88 : spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={expenses.isRefetching} onRefresh={expenses.refetch} tintColor={t.primary} />
          }
          ListHeaderComponent={
            <View style={styles.statsPad}>
              <KpiGrid>
                <KpiCard
                  label="Total expenses"
                  value={formatMoney(expenseStats.totalExpenses, currency)}
                  hint="All time"
                  icon="receipt-outline"
                  tone="purple"
                />
                <KpiCard
                  label="Accounts balance"
                  value={formatMoney(expenseStats.totalBalance, currency)}
                  hint="Across accounts"
                  hintTone="success"
                  icon="wallet-outline"
                  tone="success"
                />
              </KpiGrid>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No expenses"
              actionLabel={canMutateExpenses ? 'Add expense' : undefined}
              onAction={canMutateExpenses ? () => router.push('/(tabs)/money/expense-add') : undefined}
              icon="receipt-outline"
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.description}
              subtitle={`${formatDate(item.date)}${item.category ? ` · ${titleCaseStatus(item.category)}` : ''}${
                item.account?.name ? ` · ${item.account.name}` : ''
              }`}
              right={
                <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>
                  {formatMoney(item.amount, item.currency || item.account?.currency || currency)}
                </Text>
              }
              onPress={() => router.push(`/(tabs)/money/expense/${item.id}`)}
              onLongPress={
                canMutateExpenses
                  ? () =>
                      setDeleteTarget({
                        kind: 'expenses',
                        id: item.id,
                        label: item.description,
                      })
                  : undefined
              }
            />
          )}
        />
      )}

      {fab ? (
        <Pressable
          onPress={() => router.push(fab.href)}
          style={[styles.fab, { backgroundColor: t.primary }]}
          accessibilityRole="button"
          accessibilityLabel={fab.label}
        >
          <Ionicons name="add" size={28} color={t.primaryForeground} />
        </Pressable>
      ) : null}

      <Dialog
        visible={!!deleteTarget}
        title={`Delete ${deleteTarget?.label || ''}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg, gap: spacing.md },
  statsPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
