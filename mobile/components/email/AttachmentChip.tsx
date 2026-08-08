import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Sheet, SkeletonListRow, useToast } from '../ui';
import { emailApi } from '../../lib/email/api';
import { emailKeys } from '../../lib/email/hooks';
import { downloadAttachment, isPreviewable } from '../../lib/email/attachmentFetch';
import { pickOneAttachment } from '../../lib/email/attachments';
import { afterSheetClose } from '../../lib/email/sheet-handoff';
import { formatBytes, listTime } from '../../lib/email/format';
import type { Attachment } from '../../lib/email/types';

function iconFor(mime: string, filename: string): keyof typeof Ionicons.glyphMap {
  if (/^image\//.test(mime)) return 'image-outline';
  if (mime === 'application/pdf' || /\.pdf$/i.test(filename)) return 'document-text-outline';
  if (/spreadsheet|excel|csv/i.test(mime)) return 'grid-outline';
  if (/zip|compressed/i.test(mime)) return 'archive-outline';
  return 'document-outline';
}

interface Props {
  attachment: Attachment;
  conversationId: string;
  onPreview: (attachment: Attachment) => void;
}

export function AttachmentChip({ attachment: a, conversationId, onPreview }: Props) {
  const t = useTheme();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const canPreview = isPreviewable(a.mimeType);
  const version = a.version ?? 1;

  const versions = useQuery({
    queryKey: ['email', 'attachment-versions', a.id],
    queryFn: () => emailApi.attachmentVersions(a.id).then((r) => r.versions),
    enabled: historyOpen,
  });

  const download = async (id: string, filename: string, mimeType?: string) => {
    setBusy(true);
    try {
      await downloadAttachment(id, filename, mimeType);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    setActionsOpen(false);
    try {
      const prepared = await pickOneAttachment();
      if (!prepared) return;
      setBusy(true);
      await emailApi.replaceAttachment(a.id, {
        filename: prepared.filename,
        content: prepared.content,
        contentType: prepared.contentType,
      });
      qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: ['email', 'attachment-versions', a.id] });
      toast('Attachment replaced (new version saved)', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to replace', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => (canPreview ? onPreview(a) : download(a.id, a.filename, a.mimeType))}
        onLongPress={() => setActionsOpen(true)}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: t.border, backgroundColor: pressed ? t.accent : t.muted },
        ]}
      >
        <Ionicons name={iconFor(a.mimeType, a.filename)} size={18} color={t.mutedForeground} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.xs, fontWeight: '600', flexShrink: 1 }}>
              {a.filename}
            </Text>
            {version > 1 ? (
              <View style={[styles.versionTag, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.accentForeground, fontSize: 9, fontWeight: '700' }}>v{version}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{formatBytes(a.size)}</Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={t.mutedForeground} />
        ) : (
          <Pressable hitSlop={8} onPress={() => setActionsOpen(true)} accessibilityLabel="Attachment actions">
            <Ionicons name="ellipsis-horizontal" size={16} color={t.mutedForeground} />
          </Pressable>
        )}
      </Pressable>

      <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title={a.filename}>
        <View style={{ gap: 2 }}>
          {canPreview ? (
            <SheetAction
              icon="eye-outline"
              label="Preview"
              onPress={() => {
                setActionsOpen(false);
                afterSheetClose(() => onPreview(a));
              }}
            />
          ) : null}
          <SheetAction
            icon="download-outline"
            label="Download / share"
            onPress={() => {
              setActionsOpen(false);
              download(a.id, a.filename, a.mimeType);
            }}
          />
          <SheetAction icon="cloud-upload-outline" label="Replace (keeps history)" onPress={replace} />
          <SheetAction
            icon="time-outline"
            label="Version history"
            onPress={() => {
              setActionsOpen(false);
              afterSheetClose(() => setHistoryOpen(true));
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Version history">
        {versions.isLoading ? (
          <View>
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
          </View>
        ) : (versions.data ?? []).length === 0 ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>Only one version.</Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {(versions.data ?? []).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => {
                  setHistoryOpen(false);
                  download(v.id, v.filename, v.mimeType);
                }}
                style={({ pressed }) => [
                  styles.versionRow,
                  { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
                ]}
              >
                <View style={[styles.versionTag, { backgroundColor: t.muted }]}>
                  <Text style={{ color: t.foreground, fontSize: 9, fontWeight: '700' }}>v{v.version}</Text>
                </View>
                <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.xs }}>
                  {v.filename}
                </Text>
                {v.isLatest ? (
                  <Text style={{ color: t.primary, fontSize: 9, fontWeight: '700' }}>latest</Text>
                ) : null}
                <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{listTime(v.createdAt)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetAction, { backgroundColor: pressed ? t.accent : 'transparent' }]}
    >
      <Ionicons name={icon} size={19} color={t.primary} />
      <Text style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 200,
    flexGrow: 1,
    flexBasis: '45%',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  versionTag: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
});
