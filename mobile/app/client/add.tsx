import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { ClientForm } from '../../components/ClientForm';
import { useToast } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import {
  clientPayload,
  emptyClientForm,
  validateClientForm,
  type ClientFormValues,
} from '../../lib/clients';
import { spacing } from '../../constants/theme';

export default function AddClientScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClientFormValues>(emptyClientForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onChange = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.clients.create, {
        method: 'POST',
        body: JSON.stringify(clientPayload(form)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Client added', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const submit = () => {
    const next = validateClientForm(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        <ClientForm
          form={form}
          errors={errors}
          onChange={onChange}
          onSubmit={submit}
          submitLabel="Create client"
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
