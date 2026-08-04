import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { FOLLOW_UP_TYPES } from '../lib/documents';
import { Button, Input, Select, Sheet, useToast } from './ui';
import { spacing } from '../constants/theme';

type Kind = 'invoice' | 'proforma';

export function SendEmailSheet({
  visible,
  onClose,
  kind,
  id,
  docNumber,
  agencyName,
  clientName,
  clientEmail,
  dueLabel,
}: {
  visible: boolean;
  onClose: () => void;
  kind: Kind;
  id: string;
  docNumber: string;
  agencyName: string;
  clientName: string;
  clientEmail?: string | null;
  dueLabel?: string;
}) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [followUpType, setFollowUpType] = useState('GENTLE_REMINDER');

  useEffect(() => {
    if (!visible) return;
    const agency = agencyName || 'Hirdan Marketing';
    const name = clientName || 'there';
    setTo(clientEmail || '');
    setCc('');
    setIsFollowUp(false);
    setFollowUpType('GENTLE_REMINDER');
    if (kind === 'invoice') {
      setSubject(`Invoice ${docNumber} from ${agency}`);
      setBody(
        `Hi ${name},\n\nPlease find attached invoice ${docNumber}${
          dueLabel ? ` due on ${dueLabel}` : ''
        }.\n\nThank you,\n${agency}`
      );
    } else {
      setSubject(`Proforma Estimate ${docNumber} from ${agency}`);
      setBody(
        `Hi ${name},\n\nPlease find attached proforma estimate ${docNumber}${
          dueLabel ? ` valid until ${dueLabel}` : ''
        }.\n\nThank you,\n${agency}`
      );
    }
  }, [visible, kind, docNumber, agencyName, clientName, clientEmail, dueLabel]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!to.trim()) throw new Error('Recipient email is required');
      if (!subject.trim()) throw new Error('Subject is required');
      if (!body.trim()) throw new Error('Message is required');

      const endpoint =
        kind === 'invoice' ? endpoints.invoices.sendEmail(id) : endpoints.proformas.sendEmail(id);

      const payload: Record<string, unknown> = {
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        filename:
          kind === 'invoice' ? `Invoice_${docNumber}.pdf` : `Proforma_${docNumber}.pdf`,
      };

      if (kind === 'proforma') {
        payload.isFollowUp = isFollowUp;
        payload.followUpType = followUpType;
        payload.customNote = body.trim();
      }

      return apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast(isFollowUp ? 'Follow-up email sent' : 'Email sent', 'success');
      onClose();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={kind === 'invoice' ? 'Send invoice' : isFollowUp ? 'Send follow-up' : 'Send proforma'}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          style={{ maxHeight: 480 }}
        >
          <Input
            label="To *"
            value={to}
            onChangeText={setTo}
            placeholder="client@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="CC"
            value={cc}
            onChangeText={setCc}
            placeholder="ops@example.com, billing@…"
            autoCapitalize="none"
          />
          {kind === 'proforma' ? (
            <Select
              label="Email type"
              value={isFollowUp ? 'followup' : 'standard'}
              onChange={(v) => setIsFollowUp(v === 'followup')}
              options={[
                { label: 'Send estimate', value: 'standard' },
                { label: 'Follow-up reminder', value: 'followup' },
              ]}
            />
          ) : null}
          {kind === 'proforma' && isFollowUp ? (
            <Select
              label="Follow-up type"
              value={followUpType}
              onChange={setFollowUpType}
              options={FOLLOW_UP_TYPES.map((f) => ({ label: f.label, value: f.value }))}
            />
          ) : null}
          <Input label="Subject *" value={subject} onChangeText={setSubject} />
          <Input
            label="Message *"
            value={body}
            onChangeText={setBody}
            multiline
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Send email"
              loading={mutation.isPending}
              onPress={() => mutation.mutate()}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
