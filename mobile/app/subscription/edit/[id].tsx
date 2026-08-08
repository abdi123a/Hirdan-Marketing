import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList, unwrapOne } from '../../../lib/format';
import { clientDisplayName, clientFromApi } from '../../../lib/clients';
import { parseMoney } from '../../../lib/documents';
import {
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  isoDateOnly,
  normalizeBillingCycle,
  normalizeStatus,
  subscriptionFromApi,
} from '../../../lib/subscriptions';
import {
  Button,
  DatePickerField,
  FormSkeleton,
  Input,
  Select,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function SubscriptionEditScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const subscriptionQ = useQuery({
    queryKey: ['subscription', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.subscriptions.byId(id!));
      const raw = unwrapOne<any>(res, 'subscription', 'data') || res;
      if (!raw?.id) throw new Error('Subscription not found');
      return subscriptionFromApi(raw);
    },
  });

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList(res).map((c) => clientFromApi(c as any));
    },
  });

  const packagesQ = useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.packages.list);
      return unwrapList<{ id: string; name: string; price?: number }>(res);
    },
  });

  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [plan, setPlan] = useState('');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [features, setFeatures] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const s = subscriptionQ.data;
    if (!s) return;
    setClientId(s.clientId || '');
    setPackageId(s.packageId || '');
    setPlan(s.plan);
    setAmount(s.amount ? String(s.amount / 100) : '');
    setBillingCycle(normalizeBillingCycle(s.billingCycle));
    setStartDate(isoDateOnly(s.startDate));
    setEndDate(isoDateOnly(s.endDate));
    setStatus(normalizeStatus(s.status));
    setFeatures(s.features || '');
    setNotes(s.notes || '');
  }, [subscriptionQ.data]);

  const packageOptions = useMemo(
    () => [
      { label: 'None', value: '' },
      ...(packagesQ.data || []).map((p) => ({ label: p.name, value: p.id })),
    ],
    [packagesQ.data]
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.subscriptions.update(id!), {
        method: 'PUT',
        body: JSON.stringify({
          clientId,
          packageId: packageId || null,
          plan: plan.trim(),
          amount: Math.round(parseMoney(amount) * 100),
          billingCycle: normalizeBillingCycle(billingCycle),
          startDate,
          endDate: endDate || null,
          status: normalizeStatus(status),
          features: features.trim() || null,
          notes: notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subs-for-client'] });
      toast('Subscription updated', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message || 'Failed to update subscription', 'error'),
  });

  if (subscriptionQ.isLoading || clientsQ.isLoading || packagesQ.isLoading) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FormSkeleton />
      </ScrollView>
    );
  }

  if (subscriptionQ.error || !subscriptionQ.data) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}>
        <Button title="Retry" onPress={() => subscriptionQ.refetch()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Select
          label="Client"
          value={clientId}
          options={(clientsQ.data || []).map((c) => ({
            label: clientDisplayName(c),
            value: c.id,
          }))}
          onChange={setClientId}
        />
        <Select label="Package (optional)" value={packageId} options={packageOptions} onChange={setPackageId} />
        <Input label="Plan name" value={plan} onChangeText={setPlan} placeholder="Social media retainer" />
        <Input
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Select
          label="Billing cycle"
          value={billingCycle}
          options={[...BILLING_CYCLES]}
          onChange={setBillingCycle}
        />
        <DatePickerField label="Start date" value={startDate} onChange={setStartDate} />
        <DatePickerField label="End date" value={endDate} onChange={setEndDate} optional />
        <Select
          label="Status"
          value={status}
          options={[...SUBSCRIPTION_STATUSES]}
          onChange={setStatus}
        />
        <Input
          label="Features"
          value={features}
          onChangeText={setFeatures}
          multiline
          placeholder="Optional"
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Optional"
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Button
          title={mutation.isPending ? 'Saving…' : 'Save changes'}
          loading={mutation.isPending}
          disabled={!clientId || !plan.trim() || !amount.trim() || !startDate || mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
