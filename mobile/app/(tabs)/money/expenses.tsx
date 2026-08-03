import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type ExpenseSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, formatMoney, unwrapList } from '../../../lib/format';
import { Button, EmptyState, ListRow, Skeleton } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize } from '../../../constants/theme';

export default function ExpensesScreen() {
  const t = useTheme();
  const router = useRouter();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => apiFetch<unknown>(endpoints.expenses.list),
  });

  const expenses = unwrapList<ExpenseSummary>(data);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.header}>
        <Button title="Add expense" onPress={() => router.push('/(tabs)/money/expense-add')} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load expenses"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="alert-circle-outline"
        />
      ) : (
        <FlashList
          data={expenses}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
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
              subtitle={`${formatDate(item.date)}${item.category ? ` · ${item.category}` : ''}`}
              right={
                <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.sm }}>
                  {formatMoney(item.amount, item.currency)}
                </Text>
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
});
