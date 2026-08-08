import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ScrollView } from '../../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapOne } from '../../../lib/format';
import { EXPENSE_CATEGORIES } from '../../../lib/documents';
import {
  Button,
  DatePickerField,
  EmptyState,
  Input,
  Select,
  FormSkeleton,
  useToast,
} from '../../../components/ui';
import { useAccounts } from '../../../hooks/useAccounts';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

type ExpenseDetail = {
  id: string;
  description: string;
  amount: number;
  category?: string | null;
  date: string;
  notes?: string | null;
  receiptUrl?: string | null;
  accountId?: string;
  account?: { id?: string };
};

export default function ExpenseEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const accountsQ = useAccounts();

  const expenseQ = useQuery({
    queryKey: ['expense', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.expenses.byId(id!));
      const raw = unwrapOne<ExpenseDetail>(res, 'expense', 'data');
      if (!raw) throw new Error('Expense not found');
      return raw;
    },
  });

  useEffect(() => {
    if (expenseQ.data && !seeded) {
      const e = expenseQ.data;
      setAccountId(e.accountId || e.account?.id || '');
      setAmount(String((e.amount || 0) / 100));
      setDescription(e.description || '');
      setCategory(String(e.category || 'OTHER').toUpperCase());
      setDate(e.date ? String(e.date).slice(0, 10) : '');
      setNotes(e.notes || '');
      setReceiptUrl(e.receiptUrl || null);
      setSeeded(true);
    }
  }, [expenseQ.data, seeded]);

  const mutation = useMutation({
    mutationFn: async () => {
      const dollars = parseFloat(amount);
      if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Enter a valid amount');
      if (!accountId) throw new Error('Select an account');
      if (!description.trim()) throw new Error('Description is required');

      return apiFetch(endpoints.expenses.update(id!), {
        method: 'PUT',
        body: JSON.stringify({
          accountId,
          amount: dollars,
          category,
          description: description.trim(),
          date: new Date(date + 'T12:00:00').toISOString(),
          notes: notes.trim() || null,
          receiptUrl,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast('Expense updated', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (expenseQ.isLoading || accountsQ.isLoading || !seeded) {
    return <FormSkeleton />;
  }

  if (expenseQ.error) {
    return (
      <EmptyState
        title="Expense not found"
        description={(expenseQ.error as Error).message}
        actionLabel="Go back"
        onAction={() => router.back()}
        icon="receipt-outline"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Select
          label="Account *"
          value={accountId}
          onChange={setAccountId}
          options={(accountsQ.data || []).map((a) => ({
            label: `${a.name}${a.type ? ` (${a.type})` : ''}`,
            value: a.id,
          }))}
        />
        <Input
          label="Amount *"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="49.99"
        />
        <Input
          label="Description *"
          value={description}
          onChangeText={setDescription}
          placeholder="Office supplies"
        />
        <Select
          label="Category"
          value={category}
          onChange={setCategory}
          options={EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
        />
        <DatePickerField label="Date" value={date} onChange={setDate} />
        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <Button
          title="Save changes"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
