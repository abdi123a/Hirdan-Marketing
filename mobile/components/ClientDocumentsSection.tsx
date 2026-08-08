import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ui/Text';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch, apiUpload, downloadAndSharePdf, getFullUrl } from '../lib/api-client';
import { formatDate } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  DatePickerField,
  Dialog,
  EmptyState,
  Input,
  Select,
  Sheet,
  SkeletonListRow,
  SwitchRow,
  useToast,
} from './ui';
import { useTheme } from '../hooks/useTheme';
import { fontSize, spacing } from '../constants/theme';

const DOC_TYPES = [
  { label: 'Contract', value: 'CONTRACT' },
  { label: 'Report', value: 'REPORT' },
  { label: 'Onboarding', value: 'ONBOARDING' },
  { label: 'Brand Guide', value: 'BRAND_GUIDE' },
  { label: 'Content Calendar', value: 'CONTENT_CALENDAR' },
  { label: 'Other', value: 'OTHER' },
];

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label])
);

type ClientDoc = {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  expiryDate?: string | null;
  clientVisible: boolean;
  isSigned?: boolean;
  internalNotes?: string | null;
  clientNotes?: string | null;
};

type UploadForm = {
  title: string;
  type: string;
  internalNotes: string;
  clientNotes: string;
  expiryDate: string;
  clientVisible: boolean;
};

const emptyUpload = (): UploadForm => ({
  title: '',
  type: 'OTHER',
  internalNotes: '',
  clientNotes: '',
  expiryDate: '',
  clientVisible: true,
});

export function ClientDocumentsSection({ clientId }: { clientId: string }) {
  const t = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState<UploadForm>(emptyUpload());
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientDoc | null>(null);
  const [progress, setProgress] = useState(0);

  const docsQ = useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async () => {
      const res = await apiFetch<{ documents: ClientDoc[] }>(endpoints.clients.documents(clientId));
      return res.documents || [];
    },
  });

  const documents = docsQ.data || [];

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPicked(asset);
    if (!form.title.trim()) {
      setForm((p) => ({ ...p, title: asset.name.replace(/\.[^.]+$/, '') }));
    }
  };

  const uploadM = useMutation({
    mutationFn: async () => {
      if (!picked) throw new Error('Select a file');
      if (!form.title.trim()) throw new Error('Title is required');
      const formData = new FormData();
      formData.append('file', {
        uri: picked.uri,
        name: picked.name,
        type: picked.mimeType || 'application/octet-stream',
      } as any);
      formData.append('title', form.title.trim());
      formData.append('type', form.type);
      if (form.internalNotes) formData.append('internalNotes', form.internalNotes);
      if (form.clientNotes) formData.append('clientNotes', form.clientNotes);
      if (form.expiryDate) formData.append('expiryDate', form.expiryDate);
      formData.append('clientVisible', String(form.clientVisible));
      return apiUpload(endpoints.clients.documents(clientId), formData, setProgress);
    },
    onSuccess: () => {
      toast('Document uploaded', 'success');
      setShowUpload(false);
      setPicked(null);
      setForm(emptyUpload());
      setProgress(0);
      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
    },
    onError: (e: Error) => {
      setProgress(0);
      toast(e.message || 'Upload failed', 'error');
    },
  });

  const toggleM = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      apiFetch(endpoints.clients.documentById(clientId, id), {
        method: 'PUT',
        body: JSON.stringify({ clientVisible: visible }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] }),
    onError: (e: Error) => toast(e.message || 'Failed to update visibility', 'error'),
  });

  const deleteM = useMutation({
    mutationFn: (docId: string) =>
      apiFetch(endpoints.clients.documentById(clientId, docId), { method: 'DELETE' }),
    onSuccess: () => {
      toast('Document removed', 'success');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
    },
    onError: (e: Error) => toast(e.message || 'Failed to delete', 'error'),
  });

  const openPreview = async (doc: ClientDoc) => {
    try {
      const url = getFullUrl(doc.fileUrl);
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else toast('Cannot open this file', 'error');
    } catch (e: any) {
      toast(e?.message || 'Preview failed', 'error');
    }
  };

  const downloadDoc = async (doc: ClientDoc) => {
    try {
      await downloadAndSharePdf(doc.fileUrl, `${doc.title.replace(/\s+/g, '-')}`);
    } catch (e: any) {
      toast(e?.message || 'Download failed', 'error');
    }
  };

  if (docsQ.isLoading) {
    return (
      <View>
        <SkeletonListRow avatar={false} />
        <SkeletonListRow avatar={false} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
            Documents & contracts
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Uploaded files, contracts, and reports for this client
          </Text>
        </View>
        <Button title="Upload" size="sm" onPress={() => setShowUpload(true)} />
      </View>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents uploaded yet"
          description="Upload contracts, brand guides, or reports"
          icon="document-text-outline"
          actionLabel="Upload document"
          onAction={() => setShowUpload(true)}
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documents.map((doc, i) => (
            <View
              key={doc.id}
              style={[
                styles.row,
                i < documents.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: t.border,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: t.foreground, fontWeight: '700' }}>{doc.title}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <Badge label={DOC_TYPE_LABELS[doc.type] || doc.type} />
                  {doc.isSigned ? <Badge label="Signed" tone="success" /> : null}
                  {doc.expiryDate ? (
                    <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                      Expires {formatDate(doc.expiryDate)}
                    </Text>
                  ) : null}
                </View>
                <SwitchRow
                  label="Client visible"
                  value={!!doc.clientVisible}
                  onValueChange={(v) => toggleM.mutate({ id: doc.id, visible: v })}
                />
              </View>
              <View style={{ gap: 10 }}>
                <Pressable onPress={() => openPreview(doc)} hitSlop={8}>
                  <Ionicons name="eye-outline" size={18} color={t.primary} />
                </Pressable>
                <Pressable onPress={() => downloadDoc(doc)} hitSlop={8}>
                  <Ionicons name="download-outline" size={18} color={t.foreground} />
                </Pressable>
                <Pressable onPress={() => setDeleteTarget(doc)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={t.destructive} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={showUpload} onClose={() => setShowUpload(false)} title="Upload document">
        <View style={{ gap: spacing.md }}>
          <Pressable
            onPress={pickFile}
            style={[styles.drop, { borderColor: t.border, backgroundColor: t.muted }]}
          >
            <Ionicons name="cloud-upload-outline" size={28} color={t.mutedForeground} />
            <Text style={{ color: t.foreground, fontWeight: '700', textAlign: 'center' }}>
              {picked ? picked.name : 'Tap to select a file'}
            </Text>
            {picked?.size ? (
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {(picked.size / 1024 / 1024).toFixed(2)} MB
              </Text>
            ) : null}
          </Pressable>
          <Input
            label="Title"
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
          />
          <Select
            label="Type"
            value={form.type}
            options={DOC_TYPES}
            onChange={(v) => setForm((p) => ({ ...p, type: v }))}
          />
          <DatePickerField
            label="Expiry"
            value={form.expiryDate}
            onChange={(v) => setForm((p) => ({ ...p, expiryDate: v }))}
            optional
          />
          <Input
            label="Internal notes"
            value={form.internalNotes}
            onChangeText={(v) => setForm((p) => ({ ...p, internalNotes: v }))}
            multiline
            style={{ minHeight: 64, textAlignVertical: 'top' }}
          />
          <Input
            label="Client notes"
            value={form.clientNotes}
            onChangeText={(v) => setForm((p) => ({ ...p, clientNotes: v }))}
            multiline
            style={{ minHeight: 64, textAlignVertical: 'top' }}
          />
          <SwitchRow
            label="Visible in client portal"
            value={form.clientVisible}
            onValueChange={(v) => setForm((p) => ({ ...p, clientVisible: v }))}
          />
          {progress > 0 && progress < 100 ? (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Uploading {progress}%</Text>
          ) : null}
          <Button
            title={uploadM.isPending ? 'Uploading…' : 'Upload'}
            loading={uploadM.isPending}
            disabled={!picked || !form.title.trim() || uploadM.isPending}
            onPress={() => uploadM.mutate()}
          />
        </View>
      </Sheet>

      <Dialog
        visible={!!deleteTarget}
        title="Delete document"
        message={`Remove “${deleteTarget?.title || 'this document'}”?`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteM.mutate(deleteTarget.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  drop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
});
