import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { unwrapList, unwrapOne } from '../../lib/format';
import { clientDisplayName, clientFromApi } from '../../lib/clients';
import {
  buildDocumentPayload,
  emptyDocumentForm,
  validateDocumentForm,
  type DocumentFormState,
} from '../../lib/documents';
import { DocumentForm } from '../../components/DocumentForm';
import { FormSkeleton, useToast } from '../../components/ui';
import { useInventory } from '../../hooks/useInventory';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../constants/theme';

export default function ProformaAddScreen() {
  const t = useTheme();
  const router = useRouter();
  const { clientId: clientIdParam } = useLocalSearchParams<{ clientId?: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { inventory } = useInventory();

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

  const taxDefault = settingsQ.data?.taxRate ?? 0;
  const currency = settingsQ.data?.currency || 'USD';
  const [form, setForm] = useState<DocumentFormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const activeForm = form || emptyDocumentForm('proforma', taxDefault);

  useEffect(() => {
    if (!form && settingsQ.data) {
      const seeded = emptyDocumentForm('proforma', settingsQ.data.taxRate ?? 0);
      if (clientIdParam) seeded.clientId = clientIdParam;
      setForm(seeded);
    }
  }, [settingsQ.data, form, clientIdParam]);

  const clientOptions = useMemo(
    () =>
      (clientsQ.data || []).map((c) => ({
        id: c.id,
        label: clientDisplayName(c),
      })),
    [clientsQ.data]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildDocumentPayload('proforma', activeForm);
      return apiFetch<{ proforma: { id: string } }>(endpoints.proformas.create, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] });
      toast('Proforma created', 'success');
      const id = unwrapOne<{ id: string }>(res, 'proforma')?.id;
      if (id) router.replace(`/proforma/${id}`);
      else router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const submit = () => {
    const next = validateDocumentForm(activeForm);
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  if (settingsQ.isLoading || clientsQ.isLoading) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FormSkeleton />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <DocumentForm
          kind="proforma"
          form={activeForm}
          errors={errors}
          clients={clientOptions}
          currency={currency}
          inventory={inventory}
          onChange={setForm}
          onSubmit={submit}
          submitLabel="Save proforma"
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
