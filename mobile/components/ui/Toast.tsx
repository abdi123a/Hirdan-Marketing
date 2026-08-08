import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../../constants/theme';
import { duration, ease, spring } from '../../constants/motion';
import { useElevation, useTheme } from '../../hooks/useTheme';
import { setToastHandler, type ToastTone } from '../../lib/toast';
import { withAlpha } from './Badge';
import { Text } from './Text';

type ToastItem = { id: string; message: string; tone: ToastTone };

const ToastCtx = createContext<{ toast: (message: string, tone?: ToastTone) => void }>({
  toast: () => undefined,
});

export function useToast() {
  return useContext(ToastCtx);
}

const VISIBLE_MS = 3200;
/** Clears the floating tab bar (icon row + label) plus a small gap. */
const TAB_CLEARANCE = 72;

const TONE_META: Record<
  ToastTone,
  {
    icon: keyof typeof Ionicons.glyphMap;
    haptic: Haptics.NotificationFeedbackType | null;
  }
> = {
  success: { icon: 'checkmark-circle', haptic: Haptics.NotificationFeedbackType.Success },
  error: { icon: 'alert-circle', haptic: Haptics.NotificationFeedbackType.Error },
  default: { icon: 'information-circle', haptic: null },
};

function tonePalette(tone: ToastTone, t: ReturnType<typeof useTheme>) {
  // withAlpha rather than a hex suffix: `${token}1A` produces an invalid
  // colour the moment a token is defined as rgba() instead of hex.
  if (tone === 'success') {
    return { icon: t.success, wash: withAlpha(t.success, 0.12), text: t.foreground };
  }
  if (tone === 'error') {
    return { icon: t.destructive, wash: withAlpha(t.destructive, 0.12), text: t.foreground };
  }
  return { icon: t.primary, wash: withAlpha(t.primary, 0.12), text: t.foreground };
}

function ToastCard({
  item,
  onDone,
}: {
  item: ToastItem;
  onDone: (id: string) => void;
}) {
  const t = useTheme();
  const shadows = useElevation();
  const reduceMotion = useReducedMotion();
  const visible = useSharedValue(0);
  const exiting = useRef(false);
  const palette = tonePalette(item.tone, t);
  const meta = TONE_META[item.tone];

  const dismiss = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    if (reduceMotion) {
      onDone(item.id);
      return;
    }
    visible.value = withTiming(0, { duration: duration.fast, easing: ease.out }, (finished) => {
      if (finished) runOnJS(onDone)(item.id);
    });
  }, [item.id, onDone, reduceMotion, visible]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(item.message);

    if (meta.haptic) {
      void Haptics.notificationAsync(meta.haptic);
    }

    visible.value = reduceMotion ? 1 : withSpring(1, spring.gentle);

    const timer = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [dismiss, item.message, meta.haptic, reduceMotion, visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [
      { translateY: (1 - visible.value) * 16 },
      { scale: 0.96 + visible.value * 0.04 },
    ],
  }));

  return (
    <Animated.View style={[styles.toastWrap, animStyle]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={dismiss}
        style={({ pressed }) => [
          styles.toast,
          {
            backgroundColor: t.card,
            borderColor: t.borderSubtle,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
          shadows.lg,
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: palette.wash }]}>
          <Ionicons name={meta.icon} size={20} color={palette.icon} />
        </View>
        <Text variant="bodyStrong" style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const insets = useSafeAreaInsets();
  const seq = useRef(0);

  const remove = useCallback((id: string) => {
    setItem((prev) => (prev?.id === id ? null : prev));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = 'default') => {
    const trimmed = message.trim();
    if (!trimmed) return;
    seq.current += 1;
    setItem({ id: `${Date.now()}-${seq.current}`, message: trimmed, tone });
  }, []);

  useEffect(() => {
    setToastHandler(toast);
    return () => setToastHandler(null);
  }, [toast]);

  const value = useMemo(() => ({ toast }), [toast]);
  const bottom = Math.max(insets.bottom, spacing.md) + TAB_CLEARANCE;

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
        {item ? <ToastCard key={item.id} item={item} onDone={remove} /> : null}
      </View>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
    elevation: 1000,
  },
  toastWrap: {
    width: '100%',
  },
  toast: {
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
  message: {
    flex: 1,
  },
});
