import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, SegmentedControl, Select, Sheet, useToast } from '../../../../components/ui';
import {
  EmailChipsInput,
  type EmailChipsInputHandle,
} from '../../../../components/email/EmailChipsInput';
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from '../../../../components/email/RichTextEditor';
import { TemplatePickerSheet } from '../../../../components/email/TemplatePickerSheet';
import { emailApi } from '../../../../lib/email/api';
import { useMailboxes, useSendEmail } from '../../../../lib/email/hooks';
import { useComposeStore, type ComposeInitial } from '../../../../lib/email/compose-store';
import { pickAttachments, type PreparedAttachment } from '../../../../lib/email/attachments';
import { applyTemplateVars } from '../../../../lib/email/templateVars';
import {
  formatBytes,
  fromLocalInputValue,
  fullTime,
  htmlToPlainText,
  toLocalInputValue,
} from '../../../../lib/email/format';
import type { EmailPriority } from '../../../../lib/email/types';
import { fontSize, radius, spacing } from '../../../../constants/theme';
import { useTheme } from '../../../../hooks/useTheme';

const PRIORITY_OPTIONS: { label: string; value: EmailPriority }[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'High', value: 'HIGH' },
];

const AUTOSAVE_MS = 4000;

function presets(): { label: string; at: Date }[] {
  const hour = new Date(Date.now() + 60 * 60 * 1000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date();
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  return [
    { label: 'In 1 hour', at: hour },
    { label: 'Tomorrow 9:00', at: tomorrow },
    { label: 'Monday 9:00', at: monday },
  ];
}

export default function ComposeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const editor = useRef<RichTextEditorHandle>(null);
  const toRef = useRef<EmailChipsInputHandle>(null);
  const ccRef = useRef<EmailChipsInputHandle>(null);
  const bccRef = useRef<EmailChipsInputHandle>(null);
  // Read the seed once so re-renders never reset the composer, then drop it so
  // the next compose starts blank.
  const [initial] = useState<ComposeInitial | null>(() => useComposeStore.getState().initial);
  useEffect(() => useComposeStore.getState().setInitial(null), []);

  const { data: mailboxes = [] } = useMailboxes();
  const send = useSendEmail();

  const writable = useMemo(
    () =>
      mailboxes.filter(
        (m) =>
          m.isActive &&
          (m.accessLevel === 'ADMIN' || m.accessLevel === 'WRITE' || m.accessLevel === 'MANAGE')
      ),
    [mailboxes]
  );

  const [mailboxId, setMailboxId] = useState(initial?.mailboxId ?? '');
  const [to, setTo] = useState<string[]>(initial?.to ?? []);
  const [cc, setCc] = useState<string[]>(initial?.cc ?? []);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(!!initial?.cc?.length);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [priority, setPriority] = useState<EmailPriority>('NORMAL');
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [draftId, setDraftId] = useState<string | undefined>(initial?.draftId);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [scheduleText, setScheduleText] = useState('');
  const sentRef = useRef(false);

  // Default to the mailbox the user would pick on the web composer.
  useEffect(() => {
    if (mailboxId || writable.length === 0) return;
    setMailboxId(writable.find((m) => m.isDefault)?.id || writable[0].id);
  }, [writable, mailboxId]);

  const selectedMailbox = writable.find((m) => m.id === mailboxId);
  const scheduledDate = scheduledAt ? fromLocalInputValue(scheduledAt) : null;

  const draftPayload = (html: string, recipients?: { to: string[]; cc: string[]; bcc: string[] }) => ({
    mailboxId: mailboxId || null,
    to: recipients?.to ?? to,
    cc: recipients?.cc ?? cc,
    bcc: recipients?.bcc ?? bcc,
    subject: subject || null,
    html,
    priority,
    scheduledAt: scheduledDate ? scheduledDate.toISOString() : null,
  });

  // Autosave, exactly as the web composer does while a message is open.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (sentRef.current) return;
      const html = (await editor.current?.flushHtml()) || editor.current?.getHtml() || '';
      const hasContent = to.length || cc.length || subject.trim() || (html && html !== '<br>');
      if (!hasContent) return;
      try {
        if (draftId) {
          await emailApi.updateDraft(draftId, draftPayload(html));
        } else {
          const res = await emailApi.createDraft(draftPayload(html));
          setDraftId(res.draft.id);
        }
      } catch {
        /* autosave is best-effort */
      }
    }, AUTOSAVE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, bcc, subject, priority, scheduledAt, mailboxId, draftId]);

  const attach = async () => {
    try {
      const picked = await pickAttachments();
      if (picked.length) setAttachments((prev) => [...prev, ...picked]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not attach file', 'error');
    }
  };

  const flushRecipients = () => {
    const nextTo = toRef.current?.commitPending() ?? to;
    const nextCc = ccRef.current?.commitPending() ?? cc;
    const nextBcc = bccRef.current?.commitPending() ?? bcc;
    return { to: nextTo, cc: nextCc, bcc: nextBcc };
  };

  const handleSend = async () => {
    if (!mailboxId) {
      toast('Choose a mailbox to send from', 'error');
      return;
    }
    const recipients = flushRecipients();
    if (!recipients.to.length) {
      toast('Add at least one recipient', 'error');
      return;
    }
    // Flush the WebView before reading — tapping Send blurs the editor and the
    // async postMessage sync would otherwise race, shipping an empty body that
    // receiving MTAs bounce.
    const body = (await editor.current?.flushHtml()) || '';
    if (!htmlToPlainText(body)) {
      toast('Write a message before sending', 'error');
      return;
    }
    const html = selectedMailbox?.signature
      ? `${body}<br/><br/>${selectedMailbox.signature}`
      : body;

    try {
      await send.mutateAsync({
        mailboxId,
        to: recipients.to,
        cc: recipients.cc,
        bcc: recipients.bcc,
        subject,
        html,
        priority,
        scheduledAt: scheduledDate ? scheduledDate.toISOString() : null,
        draftId,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      sentRef.current = true;
      router.back();
    } catch {
      /* toast handled in the hook */
    }
  };

  const saveDraftAndClose = async () => {
    const recipients = flushRecipients();
    const html = (await editor.current?.flushHtml()) || '';
    try {
      if (draftId) {
        await emailApi.updateDraft(draftId, draftPayload(html, recipients));
        toast('Draft saved', 'success');
      } else if (recipients.to.length || subject.trim() || html) {
        await emailApi.createDraft(draftPayload(html, recipients));
        toast('Draft saved', 'success');
      }
    } catch {
      /* closing should never block on a failed draft save */
    }
    sentRef.current = true;
    router.back();
  };

  const discard = async () => {
    setOptionsOpen(false);
    try {
      if (draftId) await emailApi.deleteDraft(draftId);
    } catch {
      /* ignore */
    }
    sentRef.current = true;
    router.back();
  };

  const applySchedule = (date: Date) => {
    setScheduledAt(toLocalInputValue(date));
    setScheduleOpen(false);
  };

  const applyManualSchedule = () => {
    const parsed = fromLocalInputValue(scheduleText.replace(' ', 'T'));
    if (!parsed) {
      toast('Use the format YYYY-MM-DD HH:mm', 'error');
      return;
    }
    applySchedule(parsed);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen
        options={{
          title: subject.trim() || 'New message',
          headerLeft: () => (
            <Pressable
              hitSlop={8}
              onPress={saveDraftAndClose}
              accessibilityLabel="Save draft and close"
              style={{ paddingHorizontal: spacing.sm }}
            >
              <Ionicons name="close" size={24} color={t.foreground} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Pressable hitSlop={8} onPress={attach} accessibilityLabel="Attach files">
                <Ionicons name="attach" size={23} color={t.foreground} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setOptionsOpen(true)} accessibilityLabel="More options">
                <Ionicons name="ellipsis-vertical" size={22} color={t.foreground} />
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={handleSend}
                disabled={send.isPending}
                accessibilityLabel={scheduledDate ? 'Schedule send' : 'Send message'}
              >
                <Ionicons
                  name={scheduledDate ? 'time' : 'send'}
                  size={21}
                  color={send.isPending ? t.mutedForeground : t.primary}
                />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {writable.length === 0 ? (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              No mailboxes you can send from. Ask an admin for write access.
            </Text>
          ) : (
            <Select
              label="From"
              value={mailboxId}
              placeholder="Select a mailbox"
              options={writable.map((m) => ({
                value: m.id,
                label: `${m.displayName} <${m.email}>`,
              }))}
              onChange={setMailboxId}
            />
          )}

          <Field label="To">
            <EmailChipsInput ref={toRef} value={to} onChange={setTo} placeholder="Recipients" />
          </Field>

          {showCc ? (
            <Field label="Cc">
              <EmailChipsInput ref={ccRef} value={cc} onChange={setCc} placeholder="Cc" />
            </Field>
          ) : null}

          {showBcc ? (
            <Field label="Bcc">
              <EmailChipsInput ref={bccRef} value={bcc} onChange={setBcc} placeholder="Bcc" />
            </Field>
          ) : null}

          {!showCc || !showBcc ? (
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              {!showCc ? (
                <Pressable onPress={() => setShowCc(true)}>
                  <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '600' }}>
                    Add Cc
                  </Text>
                </Pressable>
              ) : null}
              {!showBcc ? (
                <Pressable onPress={() => setShowBcc(true)}>
                  <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '600' }}>
                    Add Bcc
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Field label="Subject">
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor={t.mutedForeground}
              style={{ color: t.foreground, fontSize: fontSize.sm, paddingVertical: 6 }}
            />
          </Field>
        </View>

        <RichTextEditor
          ref={editor}
          initialHtml={initial?.html ?? ''}
          placeholder="Compose email"
          minHeight={220}
          maxHeight={480}
        />

        {attachments.length > 0 ? (
          <View style={styles.attachments}>
            {attachments.map((attachment, index) => (
              <View
                key={`${attachment.filename}-${index}`}
                style={[styles.chip, { borderColor: t.border, backgroundColor: t.card }]}
              >
                <Ionicons name="attach" size={13} color={t.mutedForeground} />
                <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.xs, maxWidth: 150 }}>
                  {attachment.filename}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: 10 }}>
                  {formatBytes(attachment.size)}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  accessibilityLabel={`Remove ${attachment.filename}`}
                >
                  <Ionicons name="close" size={13} color={t.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {scheduledDate ? (
          <View style={[styles.scheduleNote, { borderColor: t.primary, backgroundColor: t.accent }]}>
            <Ionicons name="time-outline" size={15} color={t.primary} />
            <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.xs }}>
              Sends {fullTime(scheduledDate.toISOString())}
            </Text>
            <Pressable hitSlop={8} onPress={() => setScheduledAt('')} accessibilityLabel="Clear schedule">
              <Ionicons name="close" size={15} color={t.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footerActions}>
          <Button
            title={scheduledDate ? 'Schedule' : 'Send'}
            onPress={handleSend}
            loading={send.isPending}
            style={{ flex: 1 }}
          />
          <Pressable hitSlop={8} onPress={() => setTemplatesOpen(true)} accessibilityLabel="Insert template">
            <Ionicons name="document-text-outline" size={22} color={t.mutedForeground} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setScheduleOpen(true)} accessibilityLabel="Schedule send">
            <Ionicons
              name="time-outline"
              size={22}
              color={scheduledDate ? t.primary : t.mutedForeground}
            />
          </Pressable>
        </View>
      </ScrollView>

      <TemplatePickerSheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={(template) => {
          if (!subject.trim() && template.subject) setSubject(applyTemplateVars(template.subject));
          editor.current?.appendHtml(applyTemplateVars(template.body));
        }}
      />

      <Sheet visible={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule send">
        <View style={{ gap: spacing.md }}>
          {presets().map((preset) => (
            <Pressable
              key={preset.label}
              onPress={() => applySchedule(preset.at)}
              style={({ pressed }) => [
                styles.presetRow,
                { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
              ]}
            >
              <Ionicons name="time-outline" size={17} color={t.primary} />
              <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.md }}>{preset.label}</Text>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {fullTime(preset.at.toISOString())}
              </Text>
            </Pressable>
          ))}

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
              Custom time
            </Text>
            <TextInput
              value={scheduleText}
              onChangeText={setScheduleText}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={t.mutedForeground}
              autoCapitalize="none"
              style={[
                styles.input,
                { color: t.foreground, borderColor: t.border, backgroundColor: t.card },
              ]}
            />
            <Button title="Set time" size="sm" variant="outline" onPress={applyManualSchedule} />
          </View>

          {scheduledDate ? (
            <Button
              title="Send immediately instead"
              variant="ghost"
              size="sm"
              onPress={() => {
                setScheduledAt('');
                setScheduleOpen(false);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} title="Message options">
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
              Priority
            </Text>
            <SegmentedControl options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
          </View>
          <Button
            title="Save as draft & close"
            variant="outline"
            onPress={() => {
              setOptionsOpen(false);
              saveDraftAndClose();
            }}
          />
          <Button title="Discard draft" variant="destructive" onPress={discard} />
        </View>
      </Sheet>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.field, { borderBottomColor: t.border }]}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, width: 54, paddingTop: 8 }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
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
  scheduleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 44,
  },
});
