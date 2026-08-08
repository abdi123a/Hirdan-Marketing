import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from '../../components/ui/ScrollView';
import { Text } from '../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { downloadAndSharePdf, apiFetch } from '../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, recordDate, unwrapOne } from '../../lib/format';
import { titleCaseStatus } from '../../lib/documents';
import { SendEmailSheet } from '../../components/SendEmailSheet';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  DetailSkeleton,
  useToast,
  ActionBar,
  ListGroup,
  ListRow,
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

type ProformaDetail = {
  id: string;
  proformaNumber: string;
  status: string;
  amount?: number;
  total?: number;
  currency?: string;
  date?: string;
  issueDate?: string;
  dueDate?: string | null;
  validUntil?: string | null;
  deposit?: number | null;
  taxRate?: number | null;
  discount?: number | null;
  discountType?: string | null;
  notes?: string | null;
  deliveryNoteEnabled?: boolean;
  deliveryNoteTitle?: string | null;
  deliveryNoteContent?: string | null;
  client?: { id?: string; company?: string; name?: string; email?: string };
  items?: { description: string; quantity: number; unitPrice: number }[];
};

function tone(status?: string): 'default' | 'success' | 'warning' | 'destructive' {
  const s = String(status || '').toUpperCase();
  if (s === 'ACCEPTED') return 'success';
  if (s === 'EXPIRED') return 'destructive';
  if (s === 'SENT' || s === 'PARTIALLY_PAID') return 'warning';
  return 'default';
}

export default function ProformaDetailScreen() {
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
    queryKey: ['proforma', id],
    queryFn: () => apiFetch<unknown>(endpoints.proformas.byId(id!)),
    enabled: !!id,
  });

  const proforma = unwrapOne<ProformaDetail>(data, 'proforma', 'data');

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ invoiceId?: string; invoiceNumber?: string }>(endpoints.proformas.update(id!), {
        method: 'PUT',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['proforma', id] });
      queryClient.invalidateQueries({ queryKey: ['proformas'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const invoiceId = res.invoiceId || res.invoiceNumber;
      toast(
        invoiceId ? `Accepted — invoice ${res.invoiceNumber || invoiceId} created` : 'Proforma accepted',
        'success'
      );
      if (invoiceId) {
        router.replace(`/invoice/${invoiceId}`);
      }
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(endpoints.proformas.delete(id!), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] });
      toast('Proforma deleted', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const handleShare = async () => {
    if (!id) return;
    setSharing(true);
    try {
      await downloadAndSharePdf(endpoints.proformas.exportPdf(id), `proforma-${id}.pdf`);
    } catch (e: any) {
      toast(e?.message || 'Could not share PDF', 'error');
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !proforma) {
    return (
      <EmptyState
        title="Proforma not found"
        description={(error as Error)?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
        icon="document-outline"
      />
    );
  }

  const items = proforma.items || [];
  const clientName = proforma.client?.company || proforma.client?.name || 'Client';
  const isAccepted = String(proforma.status).toUpperCase() === 'ACCEPTED';
  const currency = proforma.currency || settingsQ.data?.currency || 'USD';
  const validUntil = formatDate(proforma.dueDate || proforma.validUntil);

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
              {proforma.proformaNumber}
            </Text>
            <Badge label={titleCaseStatus(proforma.status)} tone={tone(proforma.status)} />
          </View>
          <Text style={{ color: t.mutedForeground }}>{clientName}</Text>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.sm }}>
            {formatMoney(moneyAmount(proforma), currency)}
          </Text>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <DetailRow label="Issued" value={formatDate(recordDate(proforma))} />
          <DetailRow label="Valid until" value={validUntil} />
          {(proforma.deposit || 0) > 0 ? (
            <DetailRow label="Deposit" value={formatMoney(proforma.deposit || 0, currency)} />
          ) : null}
          {proforma.taxRate ? <DetailRow label="Tax rate" value={`${proforma.taxRate}%`} /> : null}
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

        {proforma.notes ? (
          <Card>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 }}>
              NOTES
            </Text>
            <Text style={{ color: t.foreground, lineHeight: 20 }}>{proforma.notes}</Text>
          </Card>
        ) : null}

        {proforma.deliveryNoteEnabled && proforma.deliveryNoteContent ? (
          <Card>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 }}>
              {(proforma.deliveryNoteTitle || 'Delivery note').toUpperCase()}
            </Text>
            <Text style={{ color: t.foreground, lineHeight: 20 }}>{proforma.deliveryNoteContent}</Text>
          </Card>
        ) : null}

        {/* Accepting is the action that moves this forward, so it is pinned
            below instead of being one of five identical buttons. */}
        <ListGroup style={styles.actions}>
          <ListRow
            title="Edit proforma"
            left={<ActionIcon name="create-outline" />}
            onPress={() => router.push(`/proforma/edit/${id}`)}
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
            title="Delete proforma"
            destructive
            divider={false}
            left={<ActionIcon name="trash-outline" destructive />}
            onPress={() => setConfirmDelete(true)}
          />
        </ListGroup>
      </ScrollView>

      {!isAccepted ? (
        <ActionBar>
          <Button
            title="Accept & create invoice"
            icon="checkmark-circle-outline"
            block
            haptic="medium"
            loading={acceptMutation.isPending}
            onPress={() => acceptMutation.mutate()}
            style={styles.primaryAction}
          />
        </ActionBar>
      ) : null}

      <SendEmailSheet
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        kind="proforma"
        id={id!}
        docNumber={proforma.proformaNumber}
        agencyName={settingsQ.data?.agencyName || 'Hirdan Marketing'}
        clientName={clientName}
        clientEmail={proforma.client?.email}
        dueLabel={validUntil}
      />

      <Dialog
        visible={confirmDelete}
        title="Delete proforma?"
        message={`${proforma.proformaNumber} will be permanently deleted.`}
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
