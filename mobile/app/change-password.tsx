import React, { useCallback, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/Text';
import { AuthButton, AuthField, AuthShell, Reveal } from '../components/auth';
import { useToast } from '../components/ui';
import { useAuthStore } from '../lib/auth-store';
import { registerForPushNotifications } from '../lib/push';
import { brand, colors, fontSize } from '../constants/theme';
import { stagger } from '../constants/motion';

/** Mirrors the server's passwordSchema (server/src/lib/auth-security.ts). */
const POLICY_HINT = 'At least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.';

function meetsPolicy(value: string): boolean {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[\W_]/.test(value)
  );
}

/** "Validation failed: newPassword: Password must …" → "Password must …" */
function readableServerError(message: string): string {
  return message.replace(/^Validation failed:\s*/, '').replace(/(^|,\s*)\w+:\s*/g, '$1');
}

/**
 * Set a new password. Reached two ways: forced (temporary or admin-reset
 * password — the API refuses everything else until this succeeds, so there is
 * no way back, only sign out) or voluntarily from Settings.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const forced = useAuthStore((s) => Boolean(s.user?.mustChangePassword));
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<'current' | 'next' | 'confirm' | null>(null);
  const [shakeToken, setShakeToken] = useState(0);

  const reject = useCallback((field: typeof invalid, message: string) => {
    setInvalid(field);
    setError(message);
    setShakeToken((token) => token + 1);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const onSubmit = useCallback(async () => {
    if (!current) return reject('current', 'Enter your current password');
    if (!meetsPolicy(next)) return reject('next', `New password: ${POLICY_HINT}`);
    if (next === current) return reject('next', 'New password must be different from the current one');
    if (next !== confirm) return reject('confirm', 'New passwords do not match');

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setInvalid(null);
    try {
      const result = await changePassword(current, next, confirm);
      if (!result.success) {
        const message = readableServerError(result.message || 'Could not change password');
        reject(/current password/i.test(message) ? 'current' : null, message);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast('Password updated', 'success');
      if (forced || !router.canGoBack()) {
        // Registration is refused while a change is pending; do it now.
        if (forced) registerForPushNotifications().catch(() => undefined);
        router.replace('/(tabs)/home');
      } else {
        router.back();
      }
    } finally {
      setLoading(false);
    }
  }, [current, next, confirm, changePassword, forced, reject, router, toast]);

  const onSignOut = useCallback(async () => {
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  const clearError = (field: typeof invalid) => {
    if (invalid === field) setInvalid(null);
    if (error) setError(null);
  };

  const toggle = (
    <Pressable
      onPress={() => setShow((prev) => !prev)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={show ? 'Hide passwords' : 'Show passwords'}
      style={styles.toggle}
    >
      <Ionicons
        name={show ? 'eye-outline' : 'eye-off-outline'}
        size={20}
        color={show ? brand.purple : '#9B94AB'}
      />
    </Pressable>
  );

  return (
    <AuthShell
      title={forced ? 'Set a new password' : 'Change password'}
      subtitle={
        forced
          ? 'Your password was set by an administrator. Choose your own to continue.'
          : 'Other devices will be signed out'
      }
      shakeToken={shakeToken}
      onBack={forced ? undefined : () => router.back()}
      footer={
        forced ? (
          <Reveal delay={stagger.card + stagger.step * 5}>
            <Pressable onPress={() => void onSignOut()} hitSlop={8} style={styles.footerLink}>
              <Text style={styles.footerMuted}>Not you?</Text>
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          </Reveal>
        ) : undefined
      }
    >
      <Reveal delay={stagger.card + stagger.step}>
        <AuthField
          label={forced ? 'Temporary password' : 'Current password'}
          icon="lock-closed-outline"
          invalid={invalid === 'current'}
          value={current}
          onChangeText={(text) => {
            setCurrent(text);
            clearError('current');
          }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => newRef.current?.focus()}
          right={toggle}
        />
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 2}>
        <AuthField
          ref={newRef}
          label="New password"
          icon="key-outline"
          invalid={invalid === 'next'}
          value={next}
          onChangeText={(text) => {
            setNext(text);
            clearError('next');
          }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 3}>
        <AuthField
          ref={confirmRef}
          label="Confirm new password"
          icon="key-outline"
          invalid={invalid === 'confirm'}
          value={confirm}
          onChangeText={(text) => {
            setConfirm(text);
            clearError('confirm');
          }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 3}>
        <View style={styles.messages}>
          {error ? (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>{POLICY_HINT}</Text>
          )}
        </View>
      </Reveal>

      <Reveal delay={stagger.card + stagger.step * 4}>
        <AuthButton
          label={forced ? 'Save and continue' : 'Update password'}
          icon="arrow-forward"
          loading={loading}
          onPress={onSubmit}
        />
      </Reveal>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: {
    minHeight: 36,
    justifyContent: 'center',
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    fontSize: fontSize.sm,
    lineHeight: 19,
    fontWeight: '500',
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    paddingVertical: 8,
  },
  footerMuted: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  link: {
    color: brand.purple,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
