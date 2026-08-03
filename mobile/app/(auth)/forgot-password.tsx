import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@hirdan/shared';
import { Button, Input, useToast } from '../../components/ui';
import { apiFetch } from '../../lib/api-client';
import { useTheme } from '../../hooks/useTheme';
import { spacing, fontSize } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await apiFetch(endpoints.auth.forgotPassword, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      toast('If that email exists, a reset link was sent.', 'success');
      router.back();
    } catch (e: any) {
      toast(e?.message || 'Request failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: true, title: 'Reset password' }} />
      <View style={styles.body}>
        <Text style={{ color: t.mutedForeground, marginBottom: spacing.lg }}>
          We will email a reset link if an account exists for this address.
        </Text>
        <Input
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button title="Send reset link" loading={loading} onPress={onSubmit} style={{ marginTop: spacing.lg }} />
        <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.sm },
});
