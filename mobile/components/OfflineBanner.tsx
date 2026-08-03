import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, fontSize } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

/** Offline banner using a lightweight connectivity probe (no extra native deps). */
export function OfflineBanner() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const probe = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (mounted) setOffline(false);
      } catch {
        if (mounted) setOffline(true);
      }
    };

    probe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') probe();
    });
    const interval = setInterval(probe, 20000);
    return () => {
      mounted = false;
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  if (!offline) return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: t.warning, paddingTop: insets.top > 0 ? 0 : spacing.sm },
      ]}
    >
      <Text style={styles.text}>
        You're offline. Some actions may fail until connectivity returns.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    color: '#1F1633',
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
