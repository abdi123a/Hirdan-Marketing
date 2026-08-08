import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button, useToast } from '../ui';
import { useReply } from '../../lib/email/hooks';
import { pickAttachments, type PreparedAttachment } from '../../lib/email/attachments';
import { applyTemplateVars } from '../../lib/email/templateVars';
import { formatBytes, htmlToPlainText } from '../../lib/email/format';
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor';
import { TemplatePickerSheet } from './TemplatePickerSheet';

interface Props {
  conversationId: string;
  signature?: string | null;
  onSent?: () => void;
}

export function ReplyBox({ conversationId, signature, onSent }: Props) {
  const t = useTheme();
  const { toast } = useToast();
  const editor = useRef<RichTextEditorHandle>(null);
  const [replyAll, setReplyAll] = useState(false);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const reply = useReply(conversationId);

  const attach = async () => {
    try {
      const picked = await pickAttachments();
      if (picked.length) setAttachments((prev) => [...prev, ...picked]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not attach file', 'error');
    }
  };

  const send = async () => {
    // Flush the WebView before reading — tapping Send blurs the editor and the
    // async postMessage sync would otherwise race, shipping an empty body.
    const html = ((await editor.current?.flushHtml()) || '').trim();
    if (!html || html === '<br>' || !htmlToPlainText(html)) {
      toast('Write a reply first', 'error');
      return;
    }
    const body = signature ? `${html}<br/><br/>${signature}` : html;
    try {
      await reply.mutateAsync({
        html: body,
        replyAll,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      editor.current?.clear();
      setAttachments([]);
      onSent?.();
    } catch {
      /* toast handled in the hook */
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Pressable onPress={() => setReplyAll((v) => !v)} style={[styles.replyAll, { borderBottomColor: t.border }]}>
        <Ionicons
          name={replyAll ? 'checkbox' : 'square-outline'}
          size={17}
          color={replyAll ? t.primary : t.mutedForeground}
        />
        <Ionicons name="people-outline" size={14} color={t.mutedForeground} />
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Reply all</Text>
      </Pressable>

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <RichTextEditor ref={editor} placeholder="Write a reply…" minHeight={130} maxHeight={340} />

        {attachments.length > 0 ? (
          <View style={styles.attachments}>
            {attachments.map((a, index) => (
              <View key={`${a.filename}-${index}`} style={[styles.chip, { borderColor: t.border, backgroundColor: t.muted }]}>
                <Ionicons name="attach" size={13} color={t.mutedForeground} />
                <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.xs, maxWidth: 130 }}>
                  {a.filename}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{formatBytes(a.size)}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  accessibilityLabel={`Remove ${a.filename}`}
                >
                  <Ionicons name="close" size={13} color={t.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={reply.isPending ? 'Sending…' : 'Send'}
            onPress={send}
            loading={reply.isPending}
            size="sm"
            style={{ paddingHorizontal: spacing.xl }}
          />
          <Pressable hitSlop={8} onPress={attach} accessibilityLabel="Attach files">
            <Ionicons name="attach" size={20} color={t.mutedForeground} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setTemplatesOpen(true)} accessibilityLabel="Insert template">
            <Ionicons name="document-text-outline" size={19} color={t.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <TemplatePickerSheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={(template) => editor.current?.appendHtml(applyTemplateVars(template.body))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  replyAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
