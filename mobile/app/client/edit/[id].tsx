import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList, unwrapOne } from '../../../lib/format';
import { ClientForm } from '../../../components/ClientForm';
import { EmptyState, FormSkeleton, useToast } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import {
  clientFromApi,
  clientPayload,
  emptyClientForm,
  formFromClient,
  validateClientForm,
  type ClientFormValues,
} from '../../../lib/clients';
import { spacing } from '../../../constants/theme';

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClientFormValues>(emptyClientForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const clientQ = useQuery({
    queryKey: ['client-edit', id],
    enabled: !!id,
    queryFn: async () => {
      // Prefer list cache (works for non-admins); fall back to byId for admins.
      try {
        const listRes = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
        const fromList = unwrapList(listRes)
          .map((c) => clientFromApi(c as any))
          .find((c) => c.id === id);
        if (fromList) return fromList;
      } catch {
        /* continue */
      }
      const res = await apiFetch<unknown>(endpoints.clients.byId(id!));
      const raw = unwrapOne<any>(res, 'client', 'data');
      if (!raw) throw new Error('Client not found');
      return clientFromApi(raw);
    },
  });

  useEffect(() => {
    if (clientQ.data) {
      setForm(formFromClient(clientQ.data));
      setReady(true);
    }
  }, [clientQ.data]);

  const onChange = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) => {
    setForm((prev: ClientFormValues) => ({ ...prev, [key]: value }));
    const errorKey = key as string;
    if (errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: '' }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.clients.update(id!), {
        method: 'PUT',
        body: JSON.stringify(clientPayload(form)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['client-edit', id] });
      toast('Client updated', 'success');
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

  if (clientQ.isLoading || !ready) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FormSkeleton />
      </ScrollView>
    );
  }

  if (clientQ.error || !clientQ.data) {
    return (
      <EmptyState
        title="Client not found"
        description={(clientQ.error as Error)?.message}
        actionLabel="Go back"
        onAction={() => router.back()}
        icon="person-outline"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <ClientForm
          form={form}
          errors={errors}
          onChange={onChange}
          onSubmit={submit}
          submitLabel="Save changes"
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
