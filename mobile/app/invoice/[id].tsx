import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from '../../components/ui/ScrollView';
import { Text } from '../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch, downloadAndSharePdf } from '../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, recordDate, unwrapOne } from '../../lib/format';
import { titleCaseStatus } from '../../lib/documents';
import { SendEmailSheet } from '../../components/SendEmailSheet';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ListGroup,
  ListRow,
  DetailSkeleton,
  useToast,
  withAlpha,
} from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, fontSize } from '../../constants/theme';

/** Tinted glyph for the secondary action list. */
function ActionIcon({
  name,
  destructive,
}: {
  name: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}) {
  const t = useTheme();
  const tone = destructive ? t.destructive : t.primary;
  return (
    <View style={[styles.actionIcon, { backgroundColor: withAlpha(tone, 0.11) }]}>
      <Ionicons name={name} size={17} color={tone} />
    </View>
  );
}

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  status: string;
  amount?: number;
  total?: number;
  currency?: string;
  date?: string;
  issueDate?: string;
  dueDate?: string | null;
  deposit?: number | null;
  taxRate?: number | null;
  discount?: number | null;
  discountType?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  deliveryNoteEnabled?: boolean;
  deliveryNoteTitle?: string | null;
  deliveryNoteContent?: string | null;
  client?: { id?: string; company?: string; name?: string; email?: string };
  items?: { description: string; quantity: number; unitPrice: number }[];
};

function tone(status?: string): 'default' | 'success' | 'warning' | 'destructive' {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'success';
  if (s === 'OVERDUE') return 'destructive';
  if (s === 'PENDING' || s === 'PARTIALLY_PAID') return 'warning';
  return 'default';
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sharing, setSharing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const settingsQ = useQuery({
    queryKey: ['agency-settings'],
    queryFn: async () => {
      const res = await apiFetch<any>(endpoints.settings.get);
      return res.settings || res;
    },
  });

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => apiFetch<unknown>(endpoints.invoices.byId(id!)),
    enabled: !!id,
  });

  const invoice = unwrapOne<InvoiceDetail>(data, 'invoice', 'data');

  const markPaid = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.invoices.update(id!), {
        method: 'PUT',
        body: JSON.stringify({ status: 'PAID' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast('Invoice marked as paid', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(endpoints.invoices.delete(id!), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast('Invoice deleted', 'success');
      router.back();
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
    return <DetailSkeleton />;
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
  const items = invoice.items || [];
  const clientName = invoice.client?.company || invoice.client?.name || 'Client';
  const total = moneyAmount(invoice);
  const balance = Math.max(0, total - (invoice.deposit || 0));
  const currency = invoice.currency || settingsQ.data?.currency || 'USD';

  return (
    <>
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
            <Badge label={titleCaseStatus(invoice.status)} tone={tone(invoice.status)} />
          </View>
          <Text style={{ color: t.mutedForeground }}>{clientName}</Text>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.sm }}>
            {formatMoney(total, currency)}
          </Text>
          {(invoice.deposit || 0) > 0 ? (
            <Text style={{ color: t.mutedForeground }}>
              Balance due {formatMoney(balance, currency)}
            </Text>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <DetailRow label="Issued" value={formatDate(recordDate(invoice))} />
          <DetailRow label="Due" value={formatDate(invoice.dueDate)} />
          {invoice.paymentMethod ? <DetailRow label="Payment method" value={invoice.paymentMethod} /> : null}
          {(invoice.deposit || 0) > 0 ? (
            <DetailRow label="Deposit" value={formatMoney(invoice.deposit || 0, currency)} />
          ) : null}
          {invoice.taxRate ? <DetailRow label="Tax rate" value={`${invoice.taxRate}%`} /> : null}
          {(invoice.discount || 0) > 0 ? (
            <DetailRow
              label="Discount"
              value={
                String(invoice.discountType).toUpperCase() === 'PERCENTAGE'
                  ? `${invoice.discount}%`
                  : formatMoney(Math.round((invoice.discount || 0) * 100), currency)
              }
            />
          ) : null}
        </Card>

        {items.length > 0 ? (
          <Card style={{ gap: spacing.md }}>
            <Text style={{ color: t.foreground, fontWeight: '800' }}>Line items</Text>
            {items.map((item, i) => (
              <View
                key={`${item.description}-${i}`}
                style={[
                  styles.item,
                  i < items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: t.border,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.foreground, fontWeight: '600' }}>
                    {String(item.description).replace(/<[^>]*>?/gm, '')}
                  </Text>
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {item.quantity} × {formatMoney(item.unitPrice, currency)}
                  </Text>
                </View>
                <Text style={{ color: t.foreground, fontWeight: '800' }}>
                  {formatMoney(item.quantity * item.unitPrice, currency)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {invoice.notes ? (
          <Card>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 }}>
              NOTES
            </Text>
            <Text style={{ color: t.foreground, lineHeight: 20 }}>{invoice.notes}</Text>
          </Card>
        ) : null}

        {invoice.deliveryNoteEnabled && invoice.deliveryNoteContent ? (
          <Card>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 }}>
              {(invoice.deliveryNoteTitle || 'Delivery note').toUpperCase()}
            </Text>
            <Text style={{ color: t.foreground, lineHeight: 20 }}>{invoice.deliveryNoteContent}</Text>
          </Card>
        ) : null}

        {/* Settling the invoice is the action that matters, so it is pinned
            below rather than being one of five identical buttons. */}
        <ListGroup style={styles.actions}>
          <ListRow
            title="Edit invoice"
            left={<ActionIcon name="create-outline" />}
            onPress={() => router.push(`/invoice/edit/${id}`)}
          />
          <ListRow
            title="Send email"
            left={<ActionIcon name="mail-outline" />}
            onPress={() => setEmailOpen(true)}
          />
          <ListRow
            title="Share PDF"
            left={<ActionIcon name="share-outline" />}
            right={sharing ? <ActivityIndicator color={t.mutedForeground} /> : undefined}
            onPress={handleShare}
          />
          <ListRow
            title="Delete invoice"
            destructive
            divider={false}
            left={<ActionIcon name="trash-outline" destructive />}
            onPress={() => setConfirmDelete(true)}
          />
        </ListGroup>
      </ScrollView>

      {!isPaid ? (
        <ActionBar>
          <Button
            title="Mark as paid"
            icon="checkmark-circle-outline"
            block
            haptic="medium"
            loading={markPaid.isPending}
            onPress={() => markPaid.mutate()}
            style={styles.primaryAction}
          />
        </ActionBar>
      ) : null}

      <SendEmailSheet
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        kind="invoice"
        id={id!}
        docNumber={invoice.invoiceNumber}
        agencyName={settingsQ.data?.agencyName || 'Hirdan Marketing'}
        clientName={clientName}
        clientEmail={invoice.client?.email}
        dueLabel={formatDate(invoice.dueDate)}
      />

      <Dialog
        visible={confirmDelete}
        title="Delete invoice?"
        message={`${invoice.invoiceNumber} will be permanently deleted.`}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { marginBottom: spacing.xl },
  primaryAction: { flex: 1 },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingBottom: spacing.md },
});
