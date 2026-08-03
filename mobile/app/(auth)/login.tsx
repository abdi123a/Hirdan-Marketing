import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { Link } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, useToast } from '../../components/ui';
import { useAuthStore } from '../../lib/auth-store';
import { useTheme } from '../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../constants/theme';

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      toast('Enter email and password', 'error');
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast(result.message || 'Login failed', 'error');
      return;
    }
    useAuthStore.getState().setBiometricEnabled(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const onBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled || !biometricEnabled) {
      toast('Biometric unlock is not set up yet. Log in once first.', 'error');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Hirdan',
      fallbackLabel: 'Use password',
    });
    if (!result.success) {
      toast('Authentication cancelled', 'error');
    }
    // Session restore happens via hydrate + secure tokens; biometric is a gate only
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.sidebar }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.brandName}>Hirdan</Text>
          <Text style={styles.brandSub}>Agency workspace</Text>
        </View>

        <View style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.title, { color: t.foreground }]}>Sign in</Text>
          <Text style={{ color: t.mutedForeground, marginBottom: spacing.lg }}>
            Staff accounts only. Settings stay on the web dashboard.
          </Text>

          <View style={{ gap: spacing.md }}>
            <Input
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Password"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />
            <Button title="Sign in" loading={loading} onPress={onSubmit} />
            <Button title="Unlock with Face ID / biometrics" variant="outline" onPress={onBiometric} />
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={{ marginTop: spacing.lg }}>
              <Text style={{ color: t.primary, fontWeight: '600', textAlign: 'center' }}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, gap: spacing.xl },
  brand: { gap: 4 },
  brandName: {
    color: '#F5B824',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  brandSub: { color: '#E5E0F0', fontSize: fontSize.md },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', marginBottom: spacing.xs },
});
