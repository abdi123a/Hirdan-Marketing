import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing } from '../constants/theme';
import { duration, ease, spring } from '../constants/motion';
import { useElevation, useTheme } from '../hooks/useTheme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';

const PROBE_URL = 'https://clients3.google.com/generate_204';
const PROBE_INTERVAL_MS = 20_000;
const PROBE_TIMEOUT_MS = 4_000;
/** How long the "back online" confirmation stays up before retracting. */
const RESTORED_MS = 1_800;

type Status = 'online' | 'offline' | 'restored';

/**
 * Connectivity notice, using a lightweight probe rather than pulling in a
 * native netinfo dependency.
 *
 * Floats over the content instead of pushing it down — a banner that reflows
 * the whole screen on every connectivity blip is far more disruptive than the
 * outage it is reporting. Recovery is confirmed briefly rather than the banner
 * just vanishing, so a dropout that resolved is still legible.
 */
export function OfflineBanner() {
  const t = useTheme();
  const shadows = useElevation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [status, setStatus] = useState<Status>('online');
  const wasOffline = useRef(false);
  const progress = useSharedValue(0);

  const probe = useCallback(async () => {
    let online = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      await fetch(PROBE_URL, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);
      online = true;
    } catch {
      online = false;
    }
    return online;
  }, []);

  useEffect(() => {
    let mounted = true;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const online = await probe();
      if (!mounted) return;

      if (!online) {
        wasOffline.current = true;
        setStatus('offline');
        return;
      }

      // Only celebrate recovery if there was an outage to recover from.
      if (wasOffline.current) {
        wasOffline.current = false;
        setStatus('restored');
        restoreTimer = setTimeout(() => {
          if (mounted) setStatus('online');
        }, RESTORED_MS);
      } else {
        setStatus('online');
      }
    };

    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    const interval = setInterval(() => void run(), PROBE_INTERVAL_MS);

    return () => {
      mounted = false;
      sub.remove();
      clearInterval(interval);
      if (restoreTimer) clearTimeout(restoreTimer);
    };
  }, [probe]);

  const visible = status !== 'online';

  useEffect(() => {
    if (reduceMotion) {
      progress.value = visible ? 1 : 0;
      return;
    }
    progress.value = visible
      ? withSpring(1, spring.sheet)
      : withDelay(80, withTiming(0, { duration: duration.base, easing: ease.in }));
  }, [visible, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -24 }],
  }));

  // Kept mounted through the retract animation, then fully removed so it never
  // intercepts touches while hidden.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), duration.base + 120);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  const offline = status === 'offline';
  const accent = offline ? t.warning : t.success;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + spacing.sm }]}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          { backgroundColor: t.card, borderColor: t.borderSubtle },
          shadows.lg,
          animatedStyle,
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: withAlpha(accent, 0.14) }]}>
          <Ionicons
            name={offline ? 'cloud-offline' : 'cloud-done'}
            size={19}
            color={accent}
          />
        </View>

        <View style={styles.copy}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {offline ? "You're offline" : 'Back online'}
          </Text>
          <Text variant="caption" color="muted" numberOfLines={2}>
            {offline
              ? 'Some actions may fail until the connection returns.'
              : 'Your connection has been restored.'}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    // Android draws by elevation, so this has to outrank every screen surface.
    zIndex: 900,
    elevation: 900,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 1 },
});
