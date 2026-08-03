import React, { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type HrDocumentSummary } from '@hirdan/shared';
import { apiFetch, downloadAndSharePdf } from '../../../lib/api-client';
import { formatDate, unwrapList } from '../../../lib/format';
import { Badge, EmptyState, ListRow, Skeleton, useToast } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function HrScreen() {
  const t = useTheme();
  const { toast } = useToast();
  const [sharingId, setSharingId] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['hr-documents'],
    queryFn: () => apiFetch<unknown>(endpoints.hr.list),
  });

  const documents = unwrapList<HrDocumentSummary>(data);

  const handleShare = async (doc: HrDocumentSummary) => {
    setSharingId(doc.id);
    try {
      const safeTitle = doc.title.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40);
      await downloadAndSharePdf(endpoints.hr.exportPdf(doc.id), `hr-${safeTitle}.pdf`);
    } catch (e: any) {
      toast(e?.message || 'Could not share PDF', 'error');
    } finally {
      setSharingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load HR documents"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
          icon="document-text-outline"
        />
      ) : (
        <FlashList
          data={documents}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          ListEmptyComponent={<EmptyState title="No HR documents" icon="document-text-outline" />}
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={`${item.type} · ${formatDate(item.createdAt)}`}
              right={
                item.status ? (
                  <Badge label={sharingId === item.id ? 'Sharing…' : item.status} />
                ) : undefined
              }
              onPress={() => handleShare(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
