import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList, unwrapOne } from '../../../lib/format';
import { clientDisplayName, clientFromApi } from '../../../lib/clients';
import {
  buildDocumentPayload,
  emptyDocumentForm,
  formFromDocument,
  validateDocumentForm,
  type DocumentFormState,
} from '../../../lib/documents';
import { DocumentForm } from '../../../components/DocumentForm';
import { EmptyState, FormSkeleton, useToast } from '../../../components/ui';
import { useInventory } from '../../../hooks/useInventory';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function InvoiceEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { inventory } = useInventory();
  const [form, setForm] = useState<DocumentFormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const settingsQ = useQuery({
    queryKey: ['agency-settings'],
    queryFn: async () => {
      const res = await apiFetch<any>(endpoints.settings.get);
      return res.settings || res;
    },
  });

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList(res).map((c) => clientFromApi(c as any));
    },
  });

  const invoiceQ = useQuery({
    queryKey: ['invoice', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.invoices.byId(id!));
      const raw = unwrapOne<any>(res, 'invoice', 'data');
      if (!raw) throw new Error('Invoice not found');
      return raw;
    },
  });

  useEffect(() => {
    if (invoiceQ.data && !form) {
      setForm(formFromDocument('invoice', invoiceQ.data, settingsQ.data?.taxRate ?? 0));
    }
  }, [invoiceQ.data, settingsQ.data, form]);

  const clientOptions = useMemo(
    () =>
      (clientsQ.data || []).map((c) => ({
        id: c.id,
        label: clientDisplayName(c),
      })),
    [clientsQ.data]
  );

  const currency = settingsQ.data?.currency || 'USD';
  const activeForm = form || emptyDocumentForm('invoice', settingsQ.data?.taxRate ?? 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildDocumentPayload('invoice', activeForm);
      return apiFetch(endpoints.invoices.update(id!), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      toast('Invoice updated', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const submit = () => {
    const next = validateDocumentForm(activeForm);
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  if (invoiceQ.isLoading || clientsQ.isLoading || !form) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FormSkeleton />
      </ScrollView>
    );
  }

  if (invoiceQ.error) {
    return (
      <EmptyState
        title="Invoice not found"
        description={(invoiceQ.error as Error).message}
        actionLabel="Go back"
        onAction={() => router.back()}
        icon="document-text-outline"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <DocumentForm
          kind="invoice"
          form={activeForm}
          errors={errors}
          clients={clientOptions}
          currency={currency}
          inventory={inventory}
          onChange={setForm}
          onSubmit={submit}
          submitLabel="Save changes"
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
