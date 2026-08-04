import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch, apiUpload } from '../../../lib/api-client';
import { EXPENSE_CATEGORIES } from '../../../lib/documents';
import {
  Button,
  EmptyState,
  Input,
  ProgressBar,
  Select,
  FormSkeleton,
  useToast,
} from '../../../components/ui';
import { useAccounts } from '../../../hooks/useAccounts';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

type PickedImage = { uri: string; name: string; type: string };

export default function ExpenseAddScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  const accountsQ = useAccounts();

  useEffect(() => {
    if (!accountId && accountsQ.data?.length) {
      setAccountId(accountsQ.data[0].id);
    }
  }, [accountsQ.data, accountId]);

  const pickImage = async (fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast('Camera permission is required', 'error');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const picked = {
          uri: asset.uri,
          name: asset.fileName || `receipt-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        };
        setImage(picked);
        await scanReceipt(picked);
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast('Photo library permission is required', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const picked = {
          uri: asset.uri,
          name: asset.fileName || `receipt-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        };
        setImage(picked);
        await scanReceipt(picked);
      }
    }
  };

  const scanReceipt = async (picked: PickedImage) => {
    setScanning(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('receipt', {
        uri: picked.uri,
        name: picked.name,
        type: picked.type,
      } as unknown as Blob);

      const res = await apiUpload<{
        receiptUrl?: string;
        extracted?: {
          amount?: number;
          description?: string;
          date?: string;
          category?: string;
        } | null;
        message?: string;
      }>(endpoints.expenses.scan, form, setProgress);

      if (res.receiptUrl) setReceiptUrl(res.receiptUrl);
      if (res.extracted) {
        if (res.extracted.amount != null) setAmount(String(res.extracted.amount));
        if (res.extracted.description) setDescription(res.extracted.description);
        if (res.extracted.date) setDate(String(res.extracted.date).slice(0, 10));
        if (res.extracted.category) {
          const cat = String(res.extracted.category).toUpperCase();
          if (EXPENSE_CATEGORIES.some((c) => c.value === cat)) setCategory(cat);
        }
        toast('Receipt scanned — review fields before saving', 'success');
      } else {
        toast(res.message || 'Receipt uploaded. Fill in fields manually.', 'default');
      }
    } catch (e: any) {
      toast(e?.message || 'Could not scan receipt', 'error');
    } finally {
      setScanning(false);
      setProgress(0);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const dollars = parseFloat(amount);
      if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Enter a valid amount');
      if (!accountId) throw new Error('Select an account');
      if (!description.trim()) throw new Error('Description is required');

      return apiFetch(endpoints.expenses.create, {
        method: 'POST',
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
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast('Expense submitted', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const canSubmit =
    description.trim().length > 0 && amount.trim().length > 0 && !!accountId && !scanning;

  if (accountsQ.isLoading) {
    return <FormSkeleton />;
  }

  if (accountsQ.error) {
    return (
      <EmptyState
        title="Could not load accounts"
        description={(accountsQ.error as Error).message}
        actionLabel="Retry"
        onAction={() => accountsQ.refetch()}
        icon="alert-circle-outline"
      />
    );
  }

  if (!accountsQ.data?.length) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.lg }}>
          No accounts yet
        </Text>
        <Text style={{ color: t.mutedForeground }}>
          Add a bank, cash, or wallet account in web Settings → Accounts, then add expenses here.
        </Text>
        <Button title="Go back" variant="outline" onPress={() => router.back()} />
      </View>
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
          placeholder="49.99"
          keyboardType="decimal-pad"
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
        <Input
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-08-04"
          autoCapitalize="none"
        />
        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />

        <View style={styles.receiptSection}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
            Receipt (scan with OCR)
          </Text>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.preview} />
          ) : (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
              Photo fills amount, description, date & category when possible
            </Text>
          )}
          <View style={styles.receiptActions}>
            <Pressable
              onPress={() => pickImage(false)}
              disabled={scanning}
              style={[styles.pickBtn, { borderColor: t.border }]}
            >
              <Text style={{ color: t.primary, fontWeight: '600' }}>Choose photo</Text>
            </Pressable>
            <Pressable
              onPress={() => pickImage(true)}
              disabled={scanning}
              style={[styles.pickBtn, { borderColor: t.border }]}
            >
              <Text style={{ color: t.primary, fontWeight: '600' }}>Take photo</Text>
            </Pressable>
          </View>
          {scanning || progress > 0 ? <ProgressBar progress={Math.max(progress, scanning ? 10 : 0)} /> : null}
          {receiptUrl ? (
            <Text style={{ color: t.success, fontSize: fontSize.xs }}>Receipt attached</Text>
          ) : null}
        </View>

        <Button
          title="Submit expense"
          loading={mutation.isPending}
          disabled={!canSubmit}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  receiptSection: { gap: spacing.sm },
  preview: { width: '100%', height: 180, borderRadius: radius.md },
  receiptActions: { flexDirection: 'row', gap: spacing.sm },
  pickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
