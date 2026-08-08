import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { Text } from '../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints, type TransferEvent } from '@hirdan/shared';
import { apiFetch, downloadAndShareFile } from '../../lib/api-client';
import { copyToClipboard } from '../../lib/clipboard';
import { formatDate, relativeTime, unwrapList } from '../../lib/format';
import {
  fileIconName,
  formatBytes,
  getShortShareUrl,
  mimeTypeOf,
  normalizeTransfer,
  previewKindOf,
  statusLabel,
  statusOf,
  statusTone,
  type ExpiryUnit,
} from '../../lib/transfers';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  ListGroup,
  ListRow,
  SegmentedControl,
  Select,
  Sheet,
  DetailSkeleton,
  SkeletonListRow,
  useToast,
  withAlpha,
} from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../constants/theme';

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

export default function TransferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [emailOpen, setEmailOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const [renewType, setRenewType] = useState<'preset' | 'custom'>('preset');
  const [renewPreset, setRenewPreset] = useState('7');
  const [renewValue, setRenewValue] = useState('1');
  const [renewUnit, setRenewUnit] = useState<ExpiryUnit>('days');

  const listQ = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.transfer.list);
      return unwrapList<Record<string, any>>(res).map(normalizeTransfer);
    },
  });

  const transfer = useMemo(
    () => (listQ.data ?? []).find((x) => x.id === id),
    [listQ.data, id]
  );

  const eventsQ = useQuery({
    queryKey: ['transfer-events', id],
    queryFn: () => apiFetch<TransferEvent[]>(endpoints.transfer.events(id!)),
    enabled: !!id && logsOpen,
  });

  const status = transfer ? statusOf(transfer) : 'revoked';
  const shareUrl = transfer ? getShortShareUrl(transfer.shareId) : '';
  const canAct = status === 'active';
  const canRenew = status === 'expired' || status === 'active';
  const previewKind = transfer ? previewKindOf(transfer.fileName) : null;
  const canPreview = !!transfer && !transfer.isDeleted && status === 'active' && !!previewKind;
  // Android's WebView has no PDF renderer, so PDFs go to whichever app the device uses for
  // them rather than an in-app viewer that would render blank.
  const previewNeedsHandoff = previewKind === 'pdf' && Platform.OS === 'android';

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['transfers'] });
    await queryClient.invalidateQueries({ queryKey: ['transfer-events', id] });
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!transfer) throw new Error('Transfer not found');
      if (!recipientEmail.trim()) throw new Error('Recipient email is required');
      return apiFetch(endpoints.transfer.send(transfer.id), {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast('Email sent', 'success');
      setEmailOpen(false);
      setCustomMessage('');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!transfer) throw new Error('Transfer not found');
      const expiryValue =
        renewType === 'preset'
          ? Math.max(1, parseInt(renewPreset, 10) || 7)
          : Math.max(1, parseInt(renewValue, 10) || 1);
      const expiryUnit: ExpiryUnit = renewType === 'preset' ? 'days' : renewUnit;
      return apiFetch(endpoints.transfer.renew(transfer.id), {
        method: 'POST',
        body: JSON.stringify({ expiryValue, expiryUnit }),
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast('Link renewed', 'success');
      setRenewOpen(false);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!transfer) throw new Error('Transfer not found');
      return apiFetch(endpoints.transfer.byId(transfer.id), { method: 'DELETE' });
    },
    onSuccess: async () => {
      await invalidate();
      toast('Link revoked and file deleted', 'success');
      setRevokeOpen(false);
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const openEmail = () => {
    if (!transfer) return;
    setRecipientEmail(transfer.client?.email || transfer.emailSentTo || '');
    setRecipientName(transfer.client?.name || '');
    setCustomMessage('');
    setEmailOpen(true);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    const copied = await copyToClipboard(shareUrl);
    toast(copied ? 'Link copied' : 'Could not copy link', copied ? 'success' : 'error');
  };

  const downloadFile = async () => {
    if (!transfer) return;
    setSharing(true);
    try {
      await downloadAndShareFile(
        endpoints.transfer.download(transfer.shareId),
        transfer.fileName,
        mimeTypeOf(transfer.fileName)
      );
    } catch (e: any) {
      toast(e?.message || 'Could not download file', 'error');
    } finally {
      setSharing(false);
    }
  };

  const openPreview = () => {
    if (!transfer) return;
    if (previewNeedsHandoff) {
      void downloadFile();
      return;
    }
    router.push(`/transfer/preview/${transfer.id}`);
  };

  if (listQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (!transfer) {
    return (
      <EmptyState
        title="Transfer not found"
        description="It may have been revoked or you no longer have access."
        actionLabel="Back"
        onAction={() => router.back()}
        icon="cloud-upload-outline"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={listQ.isRefetching}
            onRefresh={() => listQ.refetch()}
            tintColor={t.primary}
          />
        }
      >
        <Card>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: t.accent }]}>
              <Ionicons name={fileIconName(transfer.fileName)} size={28} color={t.accentForeground} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.foreground, fontSize: fontSize.lg, fontWeight: '700' }}>
                {transfer.fileName}
              </Text>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
                {formatBytes(transfer.fileSize)} · {formatDate(transfer.createdAt)}
              </Text>
              <Badge label={statusLabel(status)} tone={statusTone(status)} />
            </View>
          </View>
        </Card>

        <Card>
          <MetaRow label="Share link" value={shareUrl} />
          <MetaRow
            label="Expires"
            value={
              status === 'revoked'
                ? 'Revoked'
                : `${formatDate(transfer.expiresAt)} (${relativeTime(transfer.expiresAt)})`
            }
          />
          <MetaRow label="Views" value={String(transfer.viewCount)} />
          <MetaRow label="Downloads" value={String(transfer.downloadCount)} />
          {transfer.client?.name ? <MetaRow label="Client" value={transfer.client.name} /> : null}
          {transfer.emailSentTo ? (
            <MetaRow
              label="Last emailed"
              value={`${transfer.emailSentTo}${
                transfer.emailSentAt ? ` · ${formatDate(transfer.emailSentAt)}` : ''
              }`}
            />
          ) : null}
          {transfer.message ? <MetaRow label="Message" value={transfer.message} /> : null}
        </Card>

        {/* Copying the link is what this screen exists for, so it is pinned
            below; everything else reads as a list of secondary operations. */}
        <ListGroup style={styles.actions}>
          {canAct ? (
            <>
              <ListRow
                title="Email link"
                left={<ActionIcon name="mail-outline" />}
                onPress={openEmail}
              />
              <ListRow
                title="Download / share file"
                left={<ActionIcon name="download-outline" />}
                right={sharing ? <ActivityIndicator color={t.mutedForeground} /> : undefined}
                onPress={downloadFile}
              />
              {canPreview ? (
                <ListRow
                  title={previewNeedsHandoff ? 'Open PDF' : 'Preview'}
                  left={<ActionIcon name="eye-outline" />}
                  right={
                    previewNeedsHandoff && sharing ? (
                      <ActivityIndicator color={t.mutedForeground} />
                    ) : undefined
                  }
                  onPress={openPreview}
                />
              ) : null}
            </>
          ) : null}

          {canRenew ? (
            <ListRow
              title="Renew link"
              subtitle="Extend the expiry date"
              left={<ActionIcon name="refresh-outline" />}
              onPress={() => setRenewOpen(true)}
            />
          ) : null}

          <ListRow
            title="Access logs"
            left={<ActionIcon name="list-outline" />}
            divider={transfer.isDeleted ? false : true}
            onPress={() => setLogsOpen(true)}
          />

          {!transfer.isDeleted ? (
            <ListRow
              title="Revoke & delete"
              destructive
              divider={false}
              left={<ActionIcon name="trash-outline" destructive />}
              onPress={() => setRevokeOpen(true)}
            />
          ) : null}
        </ListGroup>
      </ScrollView>

      {canAct ? (
        <ActionBar>
          <Button
            title="Copy link"
            icon="link-outline"
            block
            haptic="medium"
            onPress={copyLink}
            style={styles.primaryAction}
          />
        </ActionBar>
      ) : null}

      <Sheet visible={emailOpen} onClose={() => setEmailOpen(false)} title="Email share link">
        <View style={{ gap: spacing.md }}>
          <Input
            label="Recipient email"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input label="Recipient name" value={recipientName} onChangeText={setRecipientName} />
          <Input
            label="Message (optional)"
            value={customMessage}
            onChangeText={setCustomMessage}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Button
            title="Send email"
            onPress={() => sendMutation.mutate()}
            loading={sendMutation.isPending}
          />
        </View>
      </Sheet>

      <Sheet visible={renewOpen} onClose={() => setRenewOpen(false)} title="Renew link">
        <View style={{ gap: spacing.md }}>
          <SegmentedControl
            value={renewType}
            onChange={setRenewType}
            options={[
              { label: 'Preset', value: 'preset' },
              { label: 'Custom', value: 'custom' },
            ]}
          />
          {renewType === 'preset' ? (
            <SegmentedControl
              value={renewPreset}
              onChange={setRenewPreset}
              options={[
                { label: '3 days', value: '3' },
                { label: '7 days', value: '7' },
                { label: '10 days', value: '10' },
              ]}
            />
          ) : (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Amount"
                  value={renewValue}
                  onChangeText={setRenewValue}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  label="Unit"
                  value={renewUnit}
                  onChange={(v) => setRenewUnit(v as ExpiryUnit)}
                  options={[
                    { label: 'Minutes', value: 'minutes' },
                    { label: 'Hours', value: 'hours' },
                    { label: 'Days', value: 'days' },
                  ]}
                />
              </View>
            </View>
          )}
          <Button
            title="Renew"
            onPress={() => renewMutation.mutate()}
            loading={renewMutation.isPending}
          />
        </View>
      </Sheet>

      <Sheet visible={logsOpen} onClose={() => setLogsOpen(false)} title="Access logs">
        {eventsQ.isLoading ? (
          <View>
            <SkeletonListRow avatar={false} trailing={false} />
            <SkeletonListRow avatar={false} trailing={false} />
            <SkeletonListRow avatar={false} trailing={false} />
          </View>
        ) : (eventsQ.data ?? []).length === 0 ? (
          <Text style={{ color: t.mutedForeground }}>No views or downloads yet.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {(eventsQ.data ?? []).map((ev) => (
              <View
                key={ev.id}
                style={[styles.logRow, { borderBottomColor: t.border }]}
              >
                <Badge
                  label={ev.eventType === 'DOWNLOAD' ? 'Download' : 'View'}
                  tone={ev.eventType === 'DOWNLOAD' ? 'gold' : 'default'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.foreground, fontSize: fontSize.sm }}>
                    {formatDate(ev.createdAt, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={1}>
                    {ev.ipAddress || 'Unknown IP'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </Sheet>

      <Dialog
        visible={revokeOpen}
        title="Revoke this link?"
        message={`${transfer.fileName} will be permanently deleted and the share link will stop working.`}
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => revokeMutation.mutate()}
        onCancel={() => setRevokeOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.metaRow}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, width: 100 }}>{label}</Text>
      <Text style={{ color: t.foreground, fontSize: fontSize.sm, flex: 1 }} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginBottom: spacing.xl },
  primaryAction: { flex: 1 },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
