import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatMoney } from '../../../lib/format';
import {
  Card,
  DatePickerField,
  EmptyState,
  FormSkeleton,
  SegmentedControl,
} from '../../../components/ui';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../hooks/useTheme';
import { fontSize, spacing } from '../../../constants/theme';

type ReportTab = 'income' | 'balance' | 'cashflow';

type IncomeStatement = {
  period: { from: string; to: string; months: number };
  revenue: { invoiceRevenue: number; subscriptionRevenue: number; total: number };
  expenses: {
    payroll: number;
    rent: number;
    software: number;
    marketing: number;
    utilities: number;
    miscellaneous: number;
    total: number;
  };
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
};

type BalanceSheet = {
  asOf: string;
  assets: {
    cash: number;
    accountsReceivable: number;
    fixedAssets: number;
    accumulatedDepreciation: number;
    total: number;
  };
  liabilities: { accountsPayable: number; accruedPayroll: number; total: number };
  equity: { retainedEarnings: number; total: number };
  totalLiabilitiesAndEquity: number;
};

type CashFlow = {
  period: { from: string; to: string };
  operatingActivities: {
    receiptsFromClients: number;
    paymentsForPayroll: number;
    paymentsForExpenses: number;
    netCashFromOperating: number;
  };
  investingActivities: { purchaseOfEquipment: number; netCashFromInvesting: number };
  financingActivities: { ownerDrawings: number; netCashFromFinancing: number };
  netChangeInCash: number;
  cashAtBeginning: number;
  cashAtEnd: number;
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultFromDate(): string {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), 0, 1));
}

function defaultToDate(): string {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function LineRow({
  label,
  amount,
  bold,
  negative,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  negative?: boolean;
}) {
  const t = useTheme();
  const display = negative && amount > 0 ? -amount : amount;
  return (
    <View style={styles.lineRow}>
      <Text
        style={{
          color: t.foreground,
          fontSize: fontSize.sm,
          fontWeight: bold ? '700' : '500',
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: display < 0 ? t.destructive : bold ? t.foreground : t.mutedForeground,
          fontSize: fontSize.sm,
          fontWeight: bold ? '800' : '600',
        }}
      >
        {formatMoney(display)}
      </Text>
    </View>
  );
}

function TotalCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'destructive' }) {
  const t = useTheme();
  const color =
    tone === 'success' ? t.success : tone === 'warning' ? t.warning : tone === 'destructive' ? t.destructive : t.primary;
  return (
    <Card style={styles.totalCard}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: fontSize.xl, fontWeight: '800', marginTop: 4 }}>
        {formatMoney(value)}
      </Text>
    </Card>
  );
}

export default function FinancialReportsScreen() {
  const t = useTheme();
  const { canRead } = usePermissions();
  const allowed = canRead('financial_reports');

  const [tab, setTab] = useState<ReportTab>('income');
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  const incomeQ = useQuery({
    queryKey: ['financial-income', fromDate, toDate],
    enabled: allowed && tab === 'income',
    queryFn: () =>
      apiFetch<IncomeStatement>(
        `${endpoints.financial.incomeStatement}?from=${fromDate}&to=${toDate}`,
      ),
  });

  const balanceQ = useQuery({
    queryKey: ['financial-balance', toDate],
    enabled: allowed && tab === 'balance',
    queryFn: () =>
      apiFetch<BalanceSheet>(`${endpoints.financial.balanceSheet}?asOf=${toDate}`),
  });

  const cashFlowQ = useQuery({
    queryKey: ['financial-cashflow', fromDate, toDate],
    enabled: allowed && tab === 'cashflow',
    queryFn: () =>
      apiFetch<CashFlow>(`${endpoints.financial.cashFlow}?from=${fromDate}&to=${toDate}`),
  });

  const activeQ = tab === 'income' ? incomeQ : tab === 'balance' ? balanceQ : cashFlowQ;

  const profitTone = useMemo(() => {
    const net = incomeQ.data?.netProfit ?? 0;
    if (net > 0) return 'success';
    if (net < 0) return 'destructive';
    return undefined;
  }, [incomeQ.data?.netProfit]);

  if (!allowed) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <View style={[styles.gateCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Ionicons name="lock-closed-outline" size={32} color={t.mutedForeground} />
          <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.lg, marginTop: spacing.md }}>
            Financial reports restricted
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs }}>
            You need financial report access to view income statements, balance sheets, and cash flow.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={activeQ.isRefetching}
          onRefresh={() => activeQ.refetch()}
          tintColor={t.primary}
        />
      }
    >
      <SegmentedControl
        options={[
          { label: 'Income', value: 'income' as const },
          { label: 'Balance', value: 'balance' as const },
          { label: 'Cash flow', value: 'cashflow' as const },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab !== 'balance' ? (
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <DatePickerField label="From" value={fromDate} onChange={setFromDate} />
          </View>
          <View style={{ flex: 1 }}>
            <DatePickerField label="To" value={toDate} onChange={setToDate} />
          </View>
        </View>
      ) : (
        <DatePickerField label="As of" value={toDate} onChange={setToDate} />
      )}

      {activeQ.isLoading ? (
        <FormSkeleton fields={6} />
      ) : activeQ.error ? (
        <EmptyState
          icon="stats-chart-outline"
          title="Could not load report"
          description={(activeQ.error as Error).message}
          actionLabel="Retry"
          onAction={() => activeQ.refetch()}
        />
      ) : tab === 'income' && incomeQ.data ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.totalsRow}>
            <TotalCard label="Total revenue" value={incomeQ.data.revenue.total} />
            <TotalCard label="Net profit" value={incomeQ.data.netProfit} tone={profitTone} />
          </View>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Revenue</Text>
            <LineRow label="Invoice revenue" amount={incomeQ.data.revenue.invoiceRevenue} />
            <LineRow label="Subscription revenue" amount={incomeQ.data.revenue.subscriptionRevenue} />
            <LineRow label="Total revenue" amount={incomeQ.data.revenue.total} bold />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Expenses</Text>
            <LineRow label="Payroll" amount={incomeQ.data.expenses.payroll} />
            <LineRow label="Rent" amount={incomeQ.data.expenses.rent} />
            <LineRow label="Software" amount={incomeQ.data.expenses.software} />
            <LineRow label="Marketing" amount={incomeQ.data.expenses.marketing} />
            <LineRow label="Utilities" amount={incomeQ.data.expenses.utilities} />
            <LineRow label="Miscellaneous" amount={incomeQ.data.expenses.miscellaneous} />
            <LineRow label="Total expenses" amount={incomeQ.data.expenses.total} bold />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <LineRow label="Gross profit" amount={incomeQ.data.grossProfit} bold />
            <LineRow label="Net profit" amount={incomeQ.data.netProfit} bold />
            <View style={styles.lineRow}>
              <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '700', flex: 1 }}>
                Profit margin
              </Text>
              <Text style={{ color: t.primary, fontSize: fontSize.sm, fontWeight: '800' }}>
                {incomeQ.data.profitMargin.toFixed(1)}%
              </Text>
            </View>
          </Card>
        </View>
      ) : tab === 'balance' && balanceQ.data ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.totalsRow}>
            <TotalCard label="Total assets" value={balanceQ.data.assets.total} />
            <TotalCard label="Total equity" value={balanceQ.data.equity.total} tone="success" />
          </View>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Assets</Text>
            <LineRow label="Cash" amount={balanceQ.data.assets.cash} />
            <LineRow label="Accounts receivable" amount={balanceQ.data.assets.accountsReceivable} />
            <LineRow label="Fixed assets" amount={balanceQ.data.assets.fixedAssets} />
            <LineRow label="Accumulated depreciation" amount={balanceQ.data.assets.accumulatedDepreciation} />
            <LineRow label="Total assets" amount={balanceQ.data.assets.total} bold />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Liabilities</Text>
            <LineRow label="Accounts payable" amount={balanceQ.data.liabilities.accountsPayable} />
            <LineRow label="Accrued payroll" amount={balanceQ.data.liabilities.accruedPayroll} />
            <LineRow label="Total liabilities" amount={balanceQ.data.liabilities.total} bold />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <LineRow label="Retained earnings" amount={balanceQ.data.equity.retainedEarnings} />
            <LineRow label="Total equity" amount={balanceQ.data.equity.total} bold />
            <LineRow
              label="Liabilities + equity"
              amount={balanceQ.data.totalLiabilitiesAndEquity}
              bold
            />
          </Card>
        </View>
      ) : tab === 'cashflow' && cashFlowQ.data ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.totalsRow}>
            <TotalCard label="Net change" value={cashFlowQ.data.netChangeInCash} />
            <TotalCard label="Cash at end" value={cashFlowQ.data.cashAtEnd} tone="success" />
          </View>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Operating</Text>
            <LineRow label="Receipts from clients" amount={cashFlowQ.data.operatingActivities.receiptsFromClients} />
            <LineRow
              label="Payroll payments"
              amount={cashFlowQ.data.operatingActivities.paymentsForPayroll}
              negative
            />
            <LineRow
              label="Expense payments"
              amount={cashFlowQ.data.operatingActivities.paymentsForExpenses}
              negative
            />
            <LineRow
              label="Net operating cash"
              amount={cashFlowQ.data.operatingActivities.netCashFromOperating}
              bold
            />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Investing</Text>
            <LineRow
              label="Equipment purchases"
              amount={cashFlowQ.data.investingActivities.purchaseOfEquipment}
              negative
            />
            <LineRow
              label="Net investing cash"
              amount={cashFlowQ.data.investingActivities.netCashFromInvesting}
              bold
            />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>Financing</Text>
            <LineRow label="Owner drawings" amount={cashFlowQ.data.financingActivities.ownerDrawings} />
            <LineRow
              label="Net financing cash"
              amount={cashFlowQ.data.financingActivities.netCashFromFinancing}
              bold
            />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <LineRow label="Cash at beginning" amount={cashFlowQ.data.cashAtBeginning} />
            <LineRow label="Net change in cash" amount={cashFlowQ.data.netChangeInCash} bold />
            <LineRow label="Cash at end" amount={cashFlowQ.data.cashAtEnd} bold />
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  gateCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  totalCard: {
    flex: 1,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});
