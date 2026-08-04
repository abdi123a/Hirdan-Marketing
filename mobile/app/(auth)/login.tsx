import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AuthButton, AuthField, AuthShell, Reveal } from '../../components/auth';
import { useToast } from '../../components/ui';
import { useAuthStore } from '../../lib/auth-store';
import { loadCredentials } from '../../lib/secure-storage';
import { getMobileRecaptchaToken } from '../../lib/public-settings';
import { brand, colors, fontSize } from '../../constants/theme';
import { duration, ease, stagger } from '../../constants/motion';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const unlock = useAuthStore((s) => s.unlock);
  const isLocked = useAuthStore((s) => s.isLocked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const { toast } = useToast();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [shakeToken, setShakeToken] = useState(0);

  const canUseBiometrics =
    biometricEnabled && (hasSavedPassword || (isAuthenticated && isLocked));

  useEffect(() => {
    loadCredentials().then((saved) => {
      if (!saved) return;
      setEmail(saved.email);
      if (saved.password) {
        setPassword(saved.password);
        setHasSavedPassword(true);
      }
    });
  }, []);

  const reject = useCallback(
    (message: string) => {
      setShakeToken((token) => token + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast(message, 'error');
    },
    [toast],
  );

  const onSubmit = useCallback(async () => {
    const trimmed = email.trim();
    const badEmail = !EMAIL_PATTERN.test(trimmed);
    const badPassword = password.length === 0;

    setEmailInvalid(badEmail);
    setPasswordInvalid(badPassword);

    if (badEmail || badPassword) {
      reject(badEmail ? 'Enter a valid email address' : 'Enter your password');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const recaptchaToken = (await getMobileRecaptchaToken()) || undefined;
      const result = await login(trimmed, password, recaptchaToken);
      if (!result.success) {
        setPasswordInvalid(true);
        reject(result.message || 'Login failed');
        return;
      }
      setHasSavedPassword(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setLoading(false);
    }
  }, [email, password, login, reject]);

  const onBiometric = useCallback(async () => {
    if (!canUseBiometrics) {
      toast('Turn on biometrics in More → Security after logging in.', 'error');
      return;
    }

    setBioLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        toast('Biometrics are not available on this device.', 'error');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Hirdan',
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        toast('Authentication cancelled', 'error');
        return;
      }

      // Existing session — just unlock the gate.
      if (isAuthenticated && isLocked) {
        unlock();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      const saved = await loadCredentials();
      if (!saved?.email || !saved.password) {
        toast('No saved password found. Log in once to save it.', 'error');
        return;
      }

      const recaptchaToken = (await getMobileRecaptchaToken()) || undefined;
      const loginResult = await login(saved.email, saved.password, recaptchaToken);
      if (!loginResult.success) {
        reject(loginResult.message || 'Could not unlock with biometrics');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setBioLoading(false);
    }
  }, [canUseBiometrics, isAuthenticated, isLocked, login, reject, toast, unlock]);

  // Auto-prompt Face ID when returning to a locked session.
  useEffect(() => {
    if (isAuthenticated && isLocked && biometricEnabled) {
      void onBiometric();
    }
    // Only on mount / lock transition — not when onBiometric identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLocked, biometricEnabled]);

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        isLocked
          ? 'Unlock with Face ID or enter your password'
          : 'Sign in to pick up where you left off'
      }
      shakeToken={shakeToken}
      footer={
        canUseBiometrics ? (
          <Reveal delay={stagger.card + stagger.step * 5}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <AuthButton
              variant="ghost"
              label="Unlock with biometrics"
              icon="finger-print"
              loading={bioLoading}
              onPress={onBiometric}
            />
          </Reveal>
        ) : null
      }
    >
      <Reveal delay={stagger.card + stagger.step}>
        <AuthField
          label="Email"
          icon="mail-outline"
          invalid={emailInvalid}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailInvalid) setEmailInvalid(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 2}>
        <AuthField
          ref={passwordRef}
          label="Password"
          icon="lock-closed-outline"
          invalid={passwordInvalid}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (passwordInvalid) setPasswordInvalid(false);
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          right={
            <VisibilityToggle
              visible={showPassword}
              onPress={() => setShowPassword((prev) => !prev)}
            />
          }
        />
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 3} style={styles.row}>
        <View />
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </Link>
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 4}>
        <AuthButton label="Log in" icon="arrow-forward" loading={loading} onPress={onSubmit} />
      </Reveal>
    </AuthShell>
  );
}

function VisibilityToggle({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const state = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    state.value = withTiming(visible ? 1 : 0, { duration: duration.fast, easing: ease.out });
  }, [visible, state]);

  const hiddenStyle = useAnimatedStyle(() => ({
    opacity: 1 - state.value,
    transform: [{ scale: interpolate(state.value, [0, 1], [1, 0.82]) }],
  }));

  const shownStyle = useAnimatedStyle(() => ({
    opacity: state.value,
    transform: [{ scale: interpolate(state.value, [0, 1], [0.82, 1]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      style={styles.toggle}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.toggleLayer, hiddenStyle]}>
        <Ionicons name="eye-off-outline" size={20} color="#9B94AB" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.toggleLayer, shownStyle]}>
        <Ionicons name="eye-outline" size={20} color={brand.purple} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 2,
  },
  link: {
    color: brand.purple,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  toggle: {
    width: 26,
    height: 26,
  },
  toggleLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2DEEA',
  },
  dividerText: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
