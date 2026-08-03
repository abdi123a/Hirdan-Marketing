import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiUpload } from '../../../lib/api-client';
import { Button, Input, ProgressBar, useToast } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

type PickedImage = { uri: string; name: string; type: string };

export default function ExpenseAddScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [image, setImage] = useState<PickedImage | null>(null);
  const [progress, setProgress] = useState(0);

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
        setImage({
          uri: asset.uri,
          name: asset.fileName || `receipt-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
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
        setImage({
          uri: asset.uri,
          name: asset.fileName || `receipt-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(amount) * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error('Enter a valid amount');

      const form = new FormData();
      form.append('description', description.trim());
      form.append('amount', String(cents));
      form.append('date', date);
      if (image) {
        form.append('receipt', {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as unknown as Blob);
      }

      return apiUpload(endpoints.expenses.create, form, setProgress);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast('Expense submitted', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const canSubmit = description.trim().length > 0 && amount.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Input label="Amount" value={amount} onChangeText={setAmount} placeholder="49.99" keyboardType="decimal-pad" />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Office supplies" />
        <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-08-03" autoCapitalize="none" />

        <View style={styles.receiptSection}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>Receipt</Text>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.preview} />
          ) : (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>Optional photo of receipt</Text>
          )}
          <View style={styles.receiptActions}>
            <Pressable onPress={() => pickImage(false)} style={[styles.pickBtn, { borderColor: t.border }]}>
              <Text style={{ color: t.primary, fontWeight: '600' }}>Choose photo</Text>
            </Pressable>
            <Pressable onPress={() => pickImage(true)} style={[styles.pickBtn, { borderColor: t.border }]}>
              <Text style={{ color: t.primary, fontWeight: '600' }}>Take photo</Text>
            </Pressable>
          </View>
        </View>

        {mutation.isPending && progress > 0 ? <ProgressBar progress={progress} /> : null}

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
  form: { padding: spacing.lg, gap: spacing.md },
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
