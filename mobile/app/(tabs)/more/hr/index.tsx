import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@hirdan/shared';
import { apiFetch, downloadAndSharePdf } from '../../../../lib/api-client';
import { formatDate, unwrapList } from '../../../../lib/format';
import {
  hrDocFromApi,
  hrDocTitle,
  hrDocTypeLabel,
  hrStatusLabel,
  hrStatusTone,
  type HrDocumentRow,
} from '../../../../lib/hr';
import {
  Badge,
  EmptyState,
  Input,
  ListSkeleton,
  Sheet,
  useToast,
} from '../../../../components/ui';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../../constants/theme';

export default function HrDocumentsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canWrite, canManage } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [actionDoc, setActionDoc] = useState<HrDocumentRow | null>(null);
  const [rejectDoc, setRejectDoc] = useState<HrDocumentRow | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['hr-documents'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.hr.list}?take=100`);
      return unwrapList(res).map((d) => hrDocFromApi(d as Record<string, unknown>));
    },
  });

  const documents = data || [];

  const pendingCount = useMemo(
    () => documents.filter((d) => String(d.status).toUpperCase() === 'PENDING_APPROVAL').length,
    [documents]
  );

  const handleShare = async (doc: HrDocumentRow) => {
    setSharingId(doc.id);
    try {
      const safeName = doc.docNumber.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40);
      await downloadAndSharePdf(endpoints.hr.exportPdf(doc.id), `hr-${safeName}.pdf`);
    } catch (e: any) {
      toast(e?.message || 'Could not share PDF', 'error');
    } finally {
      setSharingId(null);
    }
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(endpoints.hr.approve(id), { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] });
      toast('Document approved', 'success');
      setActionDoc(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      apiFetch(endpoints.hr.reject(id), {
        method: 'POST',
        body: JSON.stringify({ comment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] });
      toast('Document rejected', 'success');
      setRejectDoc(null);
      setRejectComment('');
      setActionDoc(null);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const canReview = canManage('hr') || canWrite('hr');

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            HR Documents
          </Text>
          <Text style={{ color: t.mutedForeground, marginTop: 2, fontSize: fontSize.sm }}>
            Certificates, payslips, and notices
          </Text>
        </View>
        {canWrite('hr') ? (
          <Pressable
            onPress={() => router.push('/(tabs)/more/hr/generate')}
            style={[styles.addBtn, { backgroundColor: t.primary }]}
          >
            <Ionicons name="add" size={18} color={t.primaryForeground} />
            <Text style={{ color: t.primaryForeground, fontWeight: '700', fontSize: fontSize.sm }}>
              Generate
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} avatar={false} padding={0} />
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
          ListHeaderComponent={
            pendingCount > 0 ? (
              <View style={[styles.banner, { backgroundColor: t.warning + '18', borderColor: t.warning + '44' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={t.warning} />
                <Text style={{ color: t.foreground, fontSize: fontSize.sm, flex: 1 }}>
                  {pendingCount} document{pendingCount === 1 ? '' : 's'} awaiting approval
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="No HR documents"
              description={
                canWrite('hr')
                  ? 'Generate a certificate or payslip for an employee.'
                  : undefined
              }
              actionLabel={canWrite('hr') ? 'Generate document' : undefined}
              onAction={canWrite('hr') ? () => router.push('/(tabs)/more/hr/generate') : undefined}
              icon="document-text-outline"
            />
          }
          renderItem={({ item }) => {
            const isPending = String(item.status).toUpperCase() === 'PENDING_APPROVAL';
            const sharing = sharingId === item.id;
            return (
              <Pressable
                onPress={() => handleShare(item)}
                onLongPress={() => setActionDoc(item)}
                style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}
                      numberOfLines={2}
                    >
                      {hrDocTitle(item)}
                    </Text>
                    <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }} numberOfLines={1}>
                      {item.employee?.name || 'Employee'} · {hrDocTypeLabel(item.docType)}
                    </Text>
                    <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                      {formatDate(item.generatedAt || item.createdAt)}
                    </Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => setActionDoc(item)}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={t.mutedForeground} />
                  </Pressable>
                </View>
                <View style={styles.badges}>
                  <Badge
                    label={sharing ? 'Sharing…' : hrStatusLabel(item.status)}
                    tone={hrStatusTone(item.status)}
                  />
                  {isPending && canReview ? (
                    <>
                      <Pressable
                        onPress={() => approveMutation.mutate(item.id)}
                        style={[styles.chipBtn, { backgroundColor: t.success + '18' }]}
                      >
                        <Ionicons name="checkmark" size={14} color={t.success} />
                        <Text style={{ color: t.success, fontWeight: '700', fontSize: fontSize.xs }}>
                          Approve
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setRejectDoc(item)}
                        style={[styles.chipBtn, { backgroundColor: t.destructive + '18' }]}
                      >
                        <Ionicons name="close" size={14} color={t.destructive} />
                        <Text style={{ color: t.destructive, fontWeight: '700', fontSize: fontSize.xs }}>
                          Reject
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}

      <Sheet visible={!!actionDoc} onClose={() => setActionDoc(null)} title={actionDoc ? hrDocTitle(actionDoc) : undefined}>
        <View style={{ gap: spacing.sm }}>
          <ActionRow
            icon="share-outline"
            label="Share PDF"
            onPress={() => {
              const doc = actionDoc;
              setActionDoc(null);
              if (doc) handleShare(doc);
            }}
          />
          {actionDoc &&
          String(actionDoc.status).toUpperCase() === 'PENDING_APPROVAL' &&
          canReview ? (
            <>
              <ActionRow
                icon="checkmark-circle-outline"
                label="Approve"
                onPress={() => actionDoc && approveMutation.mutate(actionDoc.id)}
              />
              <ActionRow
                icon="close-circle-outline"
                label="Reject"
                destructive
                onPress={() => {
                  setRejectDoc(actionDoc);
                  setActionDoc(null);
                }}
              />
            </>
          ) : null}
        </View>
      </Sheet>

      <Sheet
        visible={!!rejectDoc}
        onClose={() => {
          setRejectDoc(null);
          setRejectComment('');
        }}
        title="Reject document"
      >
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            A comment is required when rejecting this document.
          </Text>
          <Input
            label="Rejection reason"
            value={rejectComment}
            onChangeText={setRejectComment}
            multiline
            numberOfLines={3}
            style={{ minHeight: 88, textAlignVertical: 'top' }}
            placeholder="Explain why this document is rejected"
          />
          <Pressable
            onPress={() => {
              if (!rejectDoc) return;
              const comment = rejectComment.trim();
              if (!comment) {
                toast('Comment is required', 'error');
                return;
              }
              rejectMutation.mutate({ id: rejectDoc.id, comment });
            }}
            style={[styles.rejectBtn, { backgroundColor: t.destructive }]}
          >
            <Text style={{ color: t.destructiveForeground || '#fff', fontWeight: '700' }}>
              Reject document
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionRow, { borderColor: t.border, backgroundColor: t.background }]}
    >
      <Ionicons name={icon} size={20} color={destructive ? t.destructive : t.primary} />
      <Text
        style={{
          color: destructive ? t.destructive : t.foreground,
          fontWeight: '600',
          fontSize: fontSize.md,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejectBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
  },
});
