import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button, Skeleton, useToast } from '../ui';
import { downloadAttachment, fetchAttachmentToCache, isImage } from '../../lib/email/attachmentFetch';
import { formatBytes } from '../../lib/email/format';
import type { Attachment } from '../../lib/email/types';

export function AttachmentPreviewModal({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const image = attachment ? isImage(attachment.mimeType) : false;
  const pdf = attachment?.mimeType === 'application/pdf';
  // Android's WebView has no built-in PDF renderer, so PDFs open in a viewer app.
  const canRenderInline = image || (pdf && Platform.OS === 'ios');

  useEffect(() => {
    if (!attachment || !canRenderInline) {
      setUri(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setUri(null);
    fetchAttachmentToCache(attachment.id, attachment.filename, true)
      .then((next) => {
        if (!cancelled) setUri(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment?.id, canRenderInline]);

  const save = async () => {
    if (!attachment) return;
    try {
      await downloadAttachment(attachment.id, attachment.filename, attachment.mimeType);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Download failed', 'error');
    }
  };

  return (
    <Modal
      visible={!!attachment}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top }}>
        <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.card }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
              {attachment?.filename}
            </Text>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              {attachment ? formatBytes(attachment.size) : ''}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={save} accessibilityLabel="Download attachment">
            <Ionicons name="download-outline" size={22} color={t.primary} />
          </Pressable>
          <Pressable hitSlop={8} onPress={onClose} accessibilityLabel="Close preview">
            <Ionicons name="close" size={24} color={t.mutedForeground} />
          </Pressable>
        </View>

        <View style={[styles.body, { backgroundColor: t.muted }]}>
          {loading ? (
            <View style={{ width: '100%', padding: spacing.xl, gap: spacing.md, alignItems: 'center' }}>
              <Skeleton height={220} width="78%" radius={radius.lg} />
              <Skeleton height={12} width="48%" />
            </View>
          ) : failed ? (
            <Fallback message="Couldn't load a preview. Try downloading instead." onSave={save} />
          ) : uri && image ? (
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          ) : uri && pdf ? (
            <WebView
              originWhitelist={['*']}
              source={{ uri }}
              style={{ flex: 1, backgroundColor: t.muted }}
            />
          ) : (
            <Fallback message="No inline preview for this file type." onSave={save} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function Fallback({ message, onSave }: { message: string; onSave: () => void }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
      <Ionicons name="document-outline" size={40} color={t.mutedForeground} />
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, textAlign: 'center' }}>
        {message}
      </Text>
      <Button title="Download" onPress={onSave} size="sm" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  image: { width: '100%', height: '100%', borderRadius: radius.sm },
});
