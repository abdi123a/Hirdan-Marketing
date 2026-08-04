import React, { useState } from 'react';
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch, getFullUrl } from '../../../../lib/api-client';
import { formatDate, formatMoney, unwrapOne } from '../../../../lib/format';
import { titleCaseStatus } from '../../../../lib/documents';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  DetailSkeleton,
  useToast,
} from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../../constants/theme';

type ExpenseDetail = {
  id: string;
  description: string;
  amount: number;
  category?: string | null;
  date: string;
  notes?: string | null;
  receiptUrl?: string | null;
  accountId?: string;
  account?: { id?: string; name?: string; currency?: string; type?: string };
};

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => apiFetch<unknown>(endpoints.expenses.byId(id!)),
    enabled: !!id,
  });

  const expense = unwrapOne<ExpenseDetail>(data, 'expense', 'data');

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(endpoints.expenses.delete(id!), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast('Expense deleted', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !expense) {
    return (
      <EmptyState
        title="Expense not found"
        description={(error as Error)?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
        icon="receipt-outline"
      />
    );
  }

  const currency = expense.account?.currency || 'USD';
  const receiptUri = expense.receiptUrl ? getFullUrl(expense.receiptUrl) : null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />}
      >
        <Card style={{ gap: spacing.sm }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800' }}>
            {expense.description}
          </Text>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            {formatMoney(expense.amount, currency)}
          </Text>
          {expense.category ? (
            <Text style={{ color: t.mutedForeground }}>{titleCaseStatus(expense.category)}</Text>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <DetailRow label="Date" value={formatDate(expense.date)} />
          <DetailRow label="Account" value={expense.account?.name || '—'} />
          {expense.notes ? <DetailRow label="Notes" value={expense.notes} /> : null}
        </Card>

        {receiptUri ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '800' }}>Receipt</Text>
            <Image source={{ uri: receiptUri }} style={styles.receipt} resizeMode="cover" />
            <Button title="Open receipt" variant="outline" onPress={() => Linking.openURL(receiptUri)} />
          </Card>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            title="Edit expense"
            variant="outline"
            onPress={() => router.push(`/(tabs)/money/expense-edit/${id}`)}
          />
          <Button title="Delete" variant="destructive" onPress={() => setConfirmDelete(true)} />
        </View>
      </ScrollView>

      <Dialog
        visible={confirmDelete}
        title="Delete expense?"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: t.foreground, fontSize: fontSize.md }}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { width: '100%', height: 220, borderRadius: radius.md },
});
