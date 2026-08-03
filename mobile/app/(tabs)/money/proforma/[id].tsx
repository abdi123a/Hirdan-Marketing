import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type ProformaSummary } from '@hirdan/shared';
import { downloadAndSharePdf, apiFetch } from '../../../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, recordDate, unwrapOne } from '../../../../lib/format';
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { spacing, fontSize } from '../../../../constants/theme';

export default function ProformaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['proforma', id],
    queryFn: () => apiFetch<unknown>(endpoints.proformas.byId(id!)),
    enabled: !!id,
  });

  const proforma = unwrapOne<ProformaSummary>(data, 'proforma', 'data');

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
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} />
        <Skeleton height={80} />
      </View>
    );
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

  return (
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
          <Badge label={proforma.status} />
        </View>
        <Text style={{ color: t.mutedForeground }}>{proforma.client?.company || 'Client'}</Text>
        <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.sm }}>
          {formatMoney(moneyAmount(proforma), proforma.currency)}
        </Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <DetailRow label="Issued" value={formatDate(recordDate(proforma))} />
        <DetailRow label="Valid until" value={formatDate(proforma.validUntil)} />
      </Card>

      <Button title="Share PDF" variant="outline" loading={sharing} onPress={handleShare} />
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
});
