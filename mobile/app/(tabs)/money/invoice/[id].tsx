import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints, type InvoiceSummary } from '@hirdan/shared';
import { apiFetch, downloadAndSharePdf } from '../../../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, recordDate, unwrapOne } from '../../../../lib/format';
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { spacing, fontSize } from '../../../../constants/theme';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sharing, setSharing] = useState(false);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => apiFetch<unknown>(endpoints.invoices.byId(id!)),
    enabled: !!id,
  });

  const invoice = unwrapOne<InvoiceSummary & { items?: { description: string; amount: number }[] }>(
    data,
    'invoice',
    'data'
  );

  const markPaid = useMutation({
    mutationFn: async () => {
      try {
        await apiFetch(endpoints.invoices.markPaid(id!), { method: 'POST' });
      } catch {
        await apiFetch(endpoints.invoices.markPaid(id!), { method: 'PUT' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast('Invoice marked as paid', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const handleShare = async () => {
    if (!id) return;
    setSharing(true);
    try {
      await downloadAndSharePdf(endpoints.invoices.exportPdf(id), `invoice-${id}.pdf`);
    } catch (e: any) {
      toast(e?.message || 'Could not share PDF', 'error');
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} />
        <Skeleton height={80} />
      </View>
    );
  }

  if (error || !invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        description={(error as Error)?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
        icon="document-text-outline"
      />
    );
  }

  const isPaid = String(invoice.status).toUpperCase() === 'PAID';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />}
    >
      <Card style={{ gap: spacing.sm }}>
        <View style={styles.row}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800', flex: 1 }}>
            {invoice.invoiceNumber}
          </Text>
          <Badge label={invoice.status} tone={isPaid ? 'success' : 'warning'} />
        </View>
        <Text style={{ color: t.mutedForeground }}>{invoice.client?.company || 'Client'}</Text>
        <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.sm }}>
          {formatMoney(moneyAmount(invoice), invoice.currency)}
        </Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <DetailRow label="Issued" value={formatDate(recordDate(invoice))} />
        <DetailRow label="Due" value={formatDate(invoice.dueDate ?? (invoice as { due?: string }).due)} />
        {invoice.paidAt ? <DetailRow label="Paid" value={formatDate(invoice.paidAt)} /> : null}
      </Card>

      <View style={styles.actions}>
        {!isPaid ? (
          <Button title="Mark paid" loading={markPaid.isPending} onPress={() => markPaid.mutate()} />
        ) : null}
        <Button title="Share PDF" variant="outline" loading={sharing} onPress={handleShare} />
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: t.foreground, fontSize: fontSize.md }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm },
});
