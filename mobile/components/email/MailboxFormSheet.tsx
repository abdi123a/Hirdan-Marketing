import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button, Input, Sheet, SwitchRow, useToast } from '../ui';
import { emailApi } from '../../lib/email/api';
import { useMailboxMutations } from '../../lib/email/hooks';
import { assetUrl } from '../../lib/email/attachmentFetch';
import { pickImage } from '../../lib/email/attachments';
import type { Mailbox } from '../../lib/email/types';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#64748b'];

const EMPTY = {
  email: '',
  displayName: '',
  department: '',
  replyTo: '',
  color: '#6366f1',
  avatarUrl: '',
  signature: '',
  isActive: true,
  isDefault: false,
};

export function MailboxFormSheet({
  visible,
  onClose,
  mailbox,
}: {
  visible: boolean;
  onClose: () => void;
  mailbox?: Mailbox | null;
}) {
  const t = useTheme();
  const { toast } = useToast();
  const editing = !!mailbox;
  const { create, update } = useMailboxMutations();
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(
      mailbox
        ? {
            email: mailbox.email,
            displayName: mailbox.displayName,
            department: mailbox.department ?? '',
            replyTo: mailbox.replyTo ?? '',
            color: mailbox.color ?? '#6366f1',
            avatarUrl: mailbox.avatarUrl ?? '',
            signature: mailbox.signature ?? '',
            isActive: mailbox.isActive,
            isDefault: mailbox.isDefault,
          }
        : EMPTY
    );
  }, [visible, mailbox]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const uploadAvatar = async () => {
    try {
      const file = await pickImage();
      if (!file) return;
      setUploading(true);
      const res = await emailApi.uploadAvatar(file);
      if (res.avatarUrl) {
        set('avatarUrl', res.avatarUrl);
        toast('Avatar uploaded', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to upload avatar', 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const payload = {
      email: form.email.trim(),
      displayName: form.displayName.trim(),
      department: form.department.trim() || null,
      replyTo: form.replyTo.trim() || null,
      color: form.color || null,
      avatarUrl: form.avatarUrl.trim() || null,
      signature: form.signature || null,
      isActive: form.isActive,
      isDefault: form.isDefault,
    };
    try {
      if (editing) await update.mutateAsync({ id: mailbox!.id, data: payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch {
      /* toast handled in the hook */
    }
  };

  const busy = create.isPending || update.isPending;
  const valid = form.email.includes('@') && form.displayName.trim().length > 0;
  const avatar = assetUrl(form.avatarUrl);

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Edit mailbox' : 'New mailbox'}>
      <View style={{ gap: spacing.lg }}>
        <Input
          label="Display name *"
          value={form.displayName}
          onChangeText={(v) => set('displayName', v)}
          placeholder="Support"
        />
        <Input
          label="Department"
          value={form.department}
          onChangeText={(v) => set('department', v)}
          placeholder="Support"
        />
        <View style={{ gap: spacing.xs }}>
          <Input
            label="Email address *"
            value={form.email}
            onChangeText={(v) => set('email', v)}
            placeholder="support@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            The From/To address. Must be on a domain verified in Resend to send &amp; receive.
          </Text>
        </View>
        <Input
          label="Reply-To"
          value={form.replyTo}
          onChangeText={(v) => set('replyTo', v)}
          placeholder="Optional"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>Color</Text>
          <View style={styles.swatches}>
            {COLORS.map((color) => (
              <Pressable key={color} onPress={() => set('color', color)} accessibilityLabel={`Colour ${color}`}>
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: color,
                      borderWidth: form.color === color ? 3 : 0,
                      borderColor: t.card,
                    },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
            Avatar / Logo
          </Text>
          <View style={styles.avatarRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: `${form.color}22`, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: form.color, fontWeight: '700' }}>
                  {form.displayName ? form.displayName.slice(0, 2).toUpperCase() : 'MB'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title="Upload image"
                  variant="outline"
                  size="sm"
                  onPress={uploadAvatar}
                  loading={uploading}
                  style={{ flex: 1 }}
                />
                {form.avatarUrl ? (
                  <Button title="Remove" variant="ghost" size="sm" onPress={() => set('avatarUrl', '')} />
                ) : null}
              </View>
            </View>
          </View>
          <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
            Gmail and Outlook pull inbox avatars from Gravatar or Google Workspace / Office 365 rather
            than this image.
          </Text>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
            Signature (HTML allowed)
          </Text>
          <TextInput
            value={form.signature}
            onChangeText={(v) => set('signature', v)}
            placeholder="<p>Best regards,<br/>The Support Team</p>"
            placeholderTextColor={t.mutedForeground}
            multiline
            style={[
              styles.textarea,
              { color: t.foreground, borderColor: t.border, backgroundColor: t.card },
            ]}
          />
        </View>

        <View style={[styles.switchCard, { borderColor: t.border }]}>
          <SwitchRow
            label="Active"
            description="Inactive mailboxes cannot send."
            value={form.isActive}
            onValueChange={(v) => set('isActive', v)}
          />
        </View>
        <View style={[styles.switchCard, { borderColor: t.border }]}>
          <SwitchRow
            label="Default mailbox"
            description="Pre-selected in the composer."
            value={form.isDefault}
            onValueChange={(v) => set('isDefault', v)}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={busy} />
          <Button
            title={editing ? 'Save changes' : 'Create mailbox'}
            onPress={submit}
            loading={busy}
            disabled={!valid}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  textarea: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  switchCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
