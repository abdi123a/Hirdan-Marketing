import React, { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  endpoints,
  type ExpenseSummary,
  type InvoiceSummary,
  type ProformaSummary,
} from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, recordDate, unwrapList } from '../../../lib/format';
import { Badge, Button, EmptyState, ListRow, SegmentedControl, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

type TabKey = 'invoices' | 'proformas' | 'expenses';

function invoiceTone(status?: string): 'default' | 'success' | 'warning' | 'destructive' {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'success';
  if (s === 'OVERDUE') return 'destructive';
  if (s === 'SENT' || s === 'PARTIALLY_PAID') return 'warning';
  return 'default';
}

export default function MoneyScreen() {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('invoices');

  const invoices = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiFetch<unknown>(endpoints.invoices.list),
    enabled: tab === 'invoices',
  });
  const proformas = useQuery({
    queryKey: ['proformas'],
    queryFn: () => apiFetch<unknown>(endpoints.proformas.list),
    enabled: tab === 'proformas',
  });
  const expenses = useQuery({
    queryKey: ['expenses'],
    queryFn: () => apiFetch<unknown>(endpoints.expenses.list),
    enabled: tab === 'expenses',
  });

  const active = tab === 'invoices' ? invoices : tab === 'proformas' ? proformas : expenses;
  const invoiceList = unwrapList<InvoiceSummary>(invoices.data);
  const proformaList = unwrapList<ProformaSummary>(proformas.data);
  const expenseList = unwrapList<ExpenseSummary>(expenses.data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.header}>
        <SegmentedControl
          options={[
            { label: 'Invoices', value: 'invoices' },
            { label: 'Proformas', value: 'proformas' },
            { label: 'Expenses', value: 'expenses' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'expenses' ? (
          <Button title="Add expense" size="sm" onPress={() => router.push('/(tabs)/money/expense-add')} />
        ) : null}
      </View>

      {active.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
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
          data={invoiceList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={invoices.isRefetching} onRefresh={invoices.refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={<EmptyState title="No invoices" icon="document-text-outline" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.invoiceNumber}
              subtitle={`${item.client?.company || 'Client'} · ${formatDate(recordDate(item))}`}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={item.status} tone={invoiceTone(item.status)} />
                  <ListRowAmount amount={moneyAmount(item)} currency={item.currency} />
                </View>
              }
              onPress={() => router.push(`/(tabs)/money/invoice/${item.id}`)}
            />
          )}
        />
      ) : tab === 'proformas' ? (
        <FlashList
          data={proformaList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={proformas.isRefetching} onRefresh={proformas.refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={<EmptyState title="No proformas" icon="document-outline" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.proformaNumber}
              subtitle={`${item.client?.company || 'Client'} · ${formatDate(recordDate(item))}`}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={item.status} tone="default" />
                  <ListRowAmount amount={moneyAmount(item)} currency={item.currency} />
                </View>
              }
              onPress={() => router.push(`/(tabs)/money/proforma/${item.id}`)}
            />
          )}
        />
      ) : (
        <FlashList
          data={expenseList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={expenses.isRefetching} onRefresh={expenses.refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No expenses"
              actionLabel="Add expense"
              onAction={() => router.push('/(tabs)/money/expense-add')}
              icon="receipt-outline"
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.description}
              subtitle={formatDate(item.date)}
              right={<ListRowAmount amount={item.amount} currency={item.currency} />}
              onPress={() => router.push('/(tabs)/money/expenses')}
            />
          )}
        />
      )}
    </View>
  );
}

function ListRowAmount({ amount, currency }: { amount: number; currency?: string }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>
      {formatMoney(amount, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg, gap: spacing.md },
});
