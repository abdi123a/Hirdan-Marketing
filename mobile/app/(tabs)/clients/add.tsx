import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { Button, Input, useToast } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function AddClientScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.clients.create, {
        method: 'POST',
        body: JSON.stringify({
          company: company.trim(),
          contactName: contactName.trim() || undefined,
          name: contactName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Client created', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const canSubmit = company.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Input label="Company *" value={company} onChangeText={setCompany} placeholder="Acme Corp" autoCapitalize="words" />
        <Input label="Contact name" value={contactName} onChangeText={setContactName} placeholder="Jane Doe" autoCapitalize="words" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="jane@acme.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
        <View style={{ marginTop: spacing.md }}>
          <Button
            title="Create client"
            loading={mutation.isPending}
            disabled={!canSubmit}
            onPress={() => mutation.mutate()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md },
});
