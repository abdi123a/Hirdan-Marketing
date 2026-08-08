import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { unwrapList } from '../../lib/format';
import { clientDisplayName, clientFromApi } from '../../lib/clients';
import { parseMoney } from '../../lib/documents';
import {
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  normalizeBillingCycle,
  normalizeStatus,
} from '../../lib/subscriptions';
import {
  Button,
  DatePickerField,
  FormSkeleton,
  Input,
  Select,
  useToast,
} from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../constants/theme';

export default function SubscriptionAddScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { clientId: clientIdParam } = useLocalSearchParams<{ clientId?: string }>();

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

  const [clientId, setClientId] = useState(clientIdParam || '');
  const [packageId, setPackageId] = useState('');
  const [plan, setPlan] = useState('');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [features, setFeatures] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (clientIdParam) setClientId(clientIdParam);
  }, [clientIdParam]);

  const packageOptions = useMemo(
    () => [
      { label: 'None', value: '' },
      ...(packagesQ.data || []).map((p) => ({ label: p.name, value: p.id })),
    ],
    [packagesQ.data]
  );

  useEffect(() => {
    if (!packageId) return;
    const pkg = (packagesQ.data || []).find((p) => p.id === packageId);
    if (!pkg) return;
    if (!plan.trim()) setPlan(pkg.name);
    if (!amount.trim() && pkg.price != null) setAmount(String((pkg.price || 0) / 100));
  }, [packageId, packagesQ.data, plan, amount]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ subscription: { id: string } }>(endpoints.subscriptions.create, {
        method: 'POST',
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
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subs-for-client'] });
      toast('Subscription created', 'success');
      const subId = res.subscription?.id;
      if (subId) router.replace(`/subscription/${subId}`);
      else router.back();
    },
    onError: (e: Error) => toast(e.message || 'Failed to create subscription', 'error'),
  });

  if (clientsQ.isLoading || packagesQ.isLoading) {
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
          title={mutation.isPending ? 'Creating…' : 'Create subscription'}
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
