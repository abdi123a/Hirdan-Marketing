import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints, type TransferUploadResult } from '@hirdan/shared';
import { apiFetch, apiUpload } from '../../../lib/api-client';
import { copyToClipboard } from '../../../lib/clipboard';
import { unwrapList } from '../../../lib/format';
import { clientDisplayName, clientFromApi } from '../../../lib/clients';
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  formatBytes,
  getShortShareUrl,
  isBlockedFile,
  type ExpiryUnit,
  type PickedTransferFile,
} from '../../../lib/transfers';
import {
  Button,
  FormSkeleton,
  Input,
  ProgressBar,
  SegmentedControl,
  Select,
  Sheet,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

type ClientOption = { id: string; name: string; email?: string | null };

export default function TransferAddScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<PickedTransferFile[]>([]);
  const [expiryType, setExpiryType] = useState<'preset' | 'custom'>('preset');
  const [expiryPreset, setExpiryPreset] = useState('7');
  const [customValue, setCustomValue] = useState('1');
  const [customUnit, setCustomUnit] = useState<ExpiryUnit>('days');
  const [clientId, setClientId] = useState('none');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<{
    id: string;
    shareUrl: string;
    fileName: string;
    clientEmail?: string | null;
    clientName?: string | null;
  } | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  const clientsQ = useQuery({
    queryKey: ['clients', 'transfer'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList<Record<string, any>>(res).map(clientFromApi);
    },
  });

  const clientOptions = useMemo(() => {
    const opts = [{ label: 'No client', value: 'none' }];
    for (const c of clientsQ.data ?? []) {
      opts.push({ label: clientDisplayName(c), value: c.id });
    }
    return opts;
  }, [clientsQ.data]);

  const selectedClient: ClientOption | undefined = useMemo(() => {
    if (clientId === 'none') return undefined;
    const c = (clientsQ.data ?? []).find((x) => x.id === clientId);
    return c ? { id: c.id, name: clientDisplayName(c), email: c.email } : undefined;
  }, [clientId, clientsQ.data]);

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: '*/*',
      });
      if (result.canceled) return;

      const next: PickedTransferFile[] = [];
      for (const asset of result.assets) {
        if (isBlockedFile(asset.name)) {
          toast(`File type not allowed: ${asset.name}`, 'error');
          continue;
        }
        if (asset.size != null && asset.size > MAX_FILE_SIZE) {
          toast(`${asset.name} exceeds ${formatBytes(MAX_FILE_SIZE)}`, 'error');
          continue;
        }
        next.push({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        });
      }

      setFiles((prev) => {
        const merged = [...prev, ...next];
        if (merged.length > MAX_FILES) {
          toast(`You can upload at most ${MAX_FILES} files`, 'error');
          return merged.slice(0, MAX_FILES);
        }
        return merged;
      });
    } catch (e: any) {
      toast(e?.message || 'Could not pick files', 'error');
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const upload = async () => {
    if (!files.length) {
      toast('Pick at least one file', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      for (const f of files) {
        form.append('file', {
          uri: f.uri,
          name: f.name,
          type: f.type,
        } as unknown as Blob);
      }

      const expiryValue = expiryType === 'preset' ? expiryPreset : customValue;
      const expiryUnit: ExpiryUnit = expiryType === 'preset' ? 'days' : customUnit;
      form.append('expiryValue', String(Math.max(1, parseInt(expiryValue, 10) || 1)));
      form.append('expiryUnit', expiryUnit);
      if (message.trim()) form.append('message', message.trim());
      if (clientId !== 'none') form.append('clientId', clientId);

      const data = await apiUpload<TransferUploadResult>(
        endpoints.transfer.upload,
        form,
        setProgress
      );

      // Keep metadata in sync (same as web post-upload PATCH).
      await apiFetch(endpoints.transfer.byId(data.id), {
        method: 'PATCH',
        body: JSON.stringify({
          clientId,
          message: message.trim() || null,
          expiryValue: Math.max(1, parseInt(expiryValue, 10) || 1),
          expiryUnit,
        }),
      });

      const shareUrl = data.shareUrl || getShortShareUrl(data.shareId);
      await queryClient.invalidateQueries({ queryKey: ['transfers'] });

      setSuccess({
        id: data.id,
        shareUrl,
        fileName: data.fileName || (files.length === 1 ? files[0].name : `${files.length} files`),
        clientEmail: selectedClient?.email,
        clientName: selectedClient?.name,
      });
      setRecipientEmail(selectedClient?.email || '');
      setRecipientName(selectedClient?.name || '');
      toast('Upload complete', 'success');
    } catch (e: any) {
      toast(e?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const copyLink = async () => {
    if (!success) return;
    const copied = await copyToClipboard(success.shareUrl);
    toast(copied ? 'Link copied' : 'Could not copy link', copied ? 'success' : 'error');
  };

  const sendEmail = async () => {
    if (!success) return;
    if (!recipientEmail.trim()) {
      toast('Recipient email is required', 'error');
      return;
    }
    setSending(true);
    try {
      await apiFetch(endpoints.transfer.send(success.id), {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast('Email sent', 'success');
      setEmailOpen(false);
    } catch (e: any) {
      toast(e?.message || 'Could not send email', 'error');
    } finally {
      setSending(false);
    }
  };

  const done = () => {
    if (success) {
      router.replace(`/(tabs)/more/transfer/${success.id}`);
    } else {
      router.back();
    }
  };

  if (clientsQ.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <FormSkeleton />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={pickFiles}
          disabled={uploading}
          style={[styles.dropzone, { borderColor: t.border, backgroundColor: t.card }]}
        >
          <Ionicons name="cloud-upload-outline" size={36} color={t.primary} />
          <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>
            Tap to choose files
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, textAlign: 'center' }}>
            Up to {MAX_FILES} files · {formatBytes(MAX_FILE_SIZE)} each
          </Text>
        </Pressable>

        {files.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.foreground }]}>
              {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalBytes)}
            </Text>
            {files.map((f, i) => (
              <View
                key={`${f.uri}-${i}`}
                style={[styles.fileRow, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.foreground, fontWeight: '600' }} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {formatBytes(f.size || 0)}
                  </Text>
                </View>
                <Pressable onPress={() => removeFile(i)} hitSlop={8} disabled={uploading}>
                  <Ionicons name="close-circle" size={22} color={t.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.foreground }]}>Link expiry</Text>
          <SegmentedControl
            value={expiryType}
            onChange={setExpiryType}
            options={[
              { label: 'Preset', value: 'preset' },
              { label: 'Custom', value: 'custom' },
            ]}
          />
          {expiryType === 'preset' ? (
            <SegmentedControl
              value={expiryPreset}
              onChange={setExpiryPreset}
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
                  value={customValue}
                  onChangeText={setCustomValue}
                  keyboardType="number-pad"
                  editable={!uploading}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  label="Unit"
                  value={customUnit}
                  onChange={(v) => setCustomUnit(v as ExpiryUnit)}
                  options={[
                    { label: 'Minutes', value: 'minutes' },
                    { label: 'Hours', value: 'hours' },
                    { label: 'Days', value: 'days' },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        <Select
          label="Client (optional)"
          value={clientId}
          onChange={setClientId}
          options={clientOptions}
          placeholder="No client"
        />

        <Input
          label="Message (optional)"
          value={message}
          onChangeText={setMessage}
          placeholder="Note for the recipient"
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          editable={!uploading}
        />

        {uploading ? (
          <View style={styles.section}>
            <Text style={{ color: t.foreground, fontWeight: '600' }}>Uploading… {progress}%</Text>
            <ProgressBar progress={progress} />
          </View>
        ) : null}

        <Button
          title={uploading ? 'Uploading…' : 'Create share link'}
          onPress={upload}
          loading={uploading}
          disabled={!files.length || uploading}
        />
      </ScrollView>

      <Sheet
        visible={!!success && !emailOpen}
        onClose={done}
        title="Share link ready"
      >
        {success ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>{success.fileName}</Text>
            <Pressable
              onPress={copyLink}
              style={[styles.linkBox, { backgroundColor: t.muted, borderColor: t.border }]}
            >
              <Text style={{ color: t.foreground, flex: 1 }} selectable numberOfLines={2}>
                {success.shareUrl}
              </Text>
              <Ionicons name="copy-outline" size={20} color={t.primary} />
            </Pressable>
            <Button title="Copy link" onPress={copyLink} />
            <Button title="Email link" variant="outline" onPress={() => setEmailOpen(true)} />
            <Button title="View transfer" variant="secondary" onPress={done} />
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={emailOpen}
        onClose={() => {
          setEmailOpen(false);
        }}
        title="Email share link"
      >
        <View style={{ gap: spacing.md }}>
          <Input
            label="Recipient email"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Recipient name"
            value={recipientName}
            onChangeText={setRecipientName}
          />
          <Input
            label="Message (optional)"
            value={customMessage}
            onChangeText={setCustomMessage}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Button title="Send email" onPress={sendEmail} loading={sending} />
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
