import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AuthButton, AuthField, AuthShell, Reveal } from '../../components/auth';
import { useToast } from '../../components/ui';
import { apiFetch } from '../../lib/api-client';
import { brand, colors, fontSize } from '../../constants/theme';
import { ease, spring, stagger } from '../../constants/motion';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [shakeToken, setShakeToken] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const requestLink = useCallback(
    async (address: string) => {
      await apiFetch(endpoints.auth.forgotPassword, {
        method: 'POST',
        body: JSON.stringify({ email: address }),
      });
    },
    [],
  );

  const onSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setInvalid(true);
      setShakeToken((token) => token + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast('Enter a valid email address', 'error');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await requestLink(trimmed);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSentTo(trimmed);
      setCooldown(RESEND_SECONDS);
    } catch (e: any) {
      setShakeToken((token) => token + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast(e?.message || 'Request failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [email, requestLink, toast]);

  const onResend = useCallback(async () => {
    if (!sentTo || cooldown > 0) return;
    setLoading(true);
    try {
      await requestLink(sentTo);
      void Haptics.selectionAsync();
      setCooldown(RESEND_SECONDS);
      toast('Reset link sent again', 'success');
    } catch (e: any) {
      toast(e?.message || 'Request failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [sentTo, cooldown, requestLink, toast]);

  const sent = sentTo !== null;

  return (
    <AuthShell
      title="Reset password"
      subtitle="We’ll send a secure link so you can set a new one"
      shakeToken={shakeToken}
      onBack={() => router.back()}
      footer={
        <Reveal delay={stagger.card + stagger.step * 4}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.footerLink}>
            <Text style={styles.footerMuted}>Remember your password?</Text>
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </Reveal>
      }
    >
      {sent ? (
        <SentPanel
          email={sentTo}
          cooldown={cooldown}
          loading={loading}
          onResend={onResend}
          onDone={() => router.back()}
        />
      ) : (
        <>
          <Reveal delay={stagger.card + stagger.step}>
            <AuthField
              label="Email"
              icon="mail-outline"
              invalid={invalid}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (invalid) setInvalid(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          </Reveal>

          <Reveal delay={stagger.card + stagger.step * 2}>
            <AuthButton label="Send reset link" loading={loading} onPress={onSubmit} />
          </Reveal>
        </>
      )}
    </AuthShell>
  );
}

type SentPanelProps = {
  email: string;
  cooldown: number;
  loading: boolean;
  onResend: () => void;
  onDone: () => void;
};

function SentPanel({ email, cooldown, loading, onResend, onDone }: SentPanelProps) {
  return (
    <>
      <Reveal delay={60} style={styles.sentHeader}>
        <SuccessMark />
        <Text style={styles.sentTitle}>Link on its way</Text>
        <Text style={styles.sentBody}>
          If an account exists for <Text style={styles.sentEmail}>{email}</Text>, the reset link
          will arrive in the next minute.
        </Text>
      </Reveal>

      <Reveal delay={180}>
        <AuthButton label="Back to sign in" onPress={onDone} />
      </Reveal>

      <Reveal delay={240}>
        <Pressable
          onPress={onResend}
          disabled={cooldown > 0 || loading}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.resend}
        >
          <Text style={[styles.resendText, cooldown > 0 && styles.resendWaiting]}>
            {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend email'}
          </Text>
        </Pressable>
      </Reveal>
    </>
  );
}

function SuccessMark() {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pop.value = withDelay(80, withSpring(1, spring.bouncy));
    pulse.value = withDelay(160, withTiming(1, { duration: 900, easing: ease.out }));
  }, [pop, pulse]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pop.value, [0, 0.35, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [{ scale: reduceMotion ? 1 : interpolate(pop.value, [0, 1], [0.6, 1]) }],
  }));

  // A single ring expanding outward reads as the message leaving the device.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.4,
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.7]) }],
  }));

  return (
    <View style={styles.markWrap}>
      {reduceMotion ? null : (
        <Animated.View pointerEvents="none" style={[styles.markRing, ringStyle]} />
      )}
      <Animated.View style={[styles.mark, badgeStyle]}>
        <Ionicons name="mail-open-outline" size={32} color={colors.success} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sentHeader: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  markWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  markRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.success,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F6EE',
  },
  sentTitle: {
    color: colors.foreground,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sentBody: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  sentEmail: {
    color: colors.foreground,
    fontWeight: '700',
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  resendText: {
    color: brand.purple,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  resendWaiting: {
    color: colors.mutedForeground,
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
