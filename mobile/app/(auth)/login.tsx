import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Link } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, useToast } from '../../components/ui';
import { useAuthStore } from '../../lib/auth-store';
import { getMobileRecaptchaToken } from '../../lib/public-settings';
import { useTheme } from '../../hooks/useTheme';
import { brand, spacing, fontSize, radius } from '../../constants/theme';

function BrandMark({ size = 72 }: { size?: number }) {
  const hSize = size * 0.78;
  return (
    <View style={[styles.markWrap, { width: size, height: size }]} accessibilityLabel="Hirdan">
      <View
        style={[
          styles.markCircle,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
          },
        ]}
      />
      <Text
        style={[
          styles.markH,
          {
            fontSize: hSize,
            lineHeight: hSize * 1.05,
            marginTop: -size * 0.04,
          },
        ]}
      >
        H
      </Text>
    </View>
  );
}

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const login = useAuthStore((s) => s.login);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const compact = height < 780;

  const onSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      toast('Enter email and password', 'error');
      return;
    }
    setLoading(true);
    try {
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = (await getMobileRecaptchaToken()) || undefined;
      } catch (e: any) {
        // Application key missing / SDK not ready — server skips until Android key is saved
        console.warn('reCAPTCHA token unavailable', e?.message || e);
      }
      const result = await login(email.trim(), password, recaptchaToken);
      if (!result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast(result.message || 'Login failed', 'error');
        return;
      }
      useAuthStore.getState().setBiometricEnabled(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setLoading(false);
    }
  }, [email, password, login, toast]);

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
  };

  return (
    <View style={[styles.root, { backgroundColor: brand.purple }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + (compact ? 36 : 56),
              paddingBottom: insets.bottom + 24,
              justifyContent: 'center',
              minHeight: height - insets.top,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <BrandMark size={compact ? 64 : 80} />
            <Text style={styles.brandName}>Hirdan</Text>
            <Text style={styles.brandSub}>Marketing</Text>
          </View>

          <View style={[styles.card, compact && styles.cardCompact, { backgroundColor: t.card }]}>
            <Text style={[styles.title, { color: t.foreground }, compact && styles.titleCompact]}>
              Sign in
            </Text>

            <View style={{ gap: compact ? spacing.sm : spacing.md, marginTop: spacing.md }}>
              <Input
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                style={compact ? styles.inputCompact : undefined}
              />
              <Input
                label="Password"
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                style={compact ? styles.inputCompact : undefined}
              />
              <Button title="Sign in" loading={loading} onPress={onSubmit} />
              <Button
                title="Unlock with biometrics"
                variant="outline"
                size="sm"
                onPress={onBiometric}
              />
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: brand.purple,
                    fontWeight: '600',
                    textAlign: 'center',
                    fontSize: fontSize.sm,
                  }}
                >
                  Forgot password?
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', gap: 2 },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  markCircle: {
    position: 'absolute',
    backgroundColor: brand.gold,
  },
  markH: {
    color: brand.purpleDeep,
    fontWeight: '800',
    letterSpacing: -2,
    textAlign: 'center',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  brandSub: {
    color: brand.gold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  cardCompact: {
    padding: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700' },
  titleCompact: { fontSize: fontSize.xl },
  inputCompact: {
    minHeight: 42,
    paddingVertical: spacing.sm,
  },
});
