import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { setToastHandler } from '../../lib/toast';

type ToastItem = { id: string; message: string; tone?: 'default' | 'success' | 'error' };

const ToastCtx = createContext<{ toast: (message: string, tone?: ToastItem['tone']) => void }>({
  toast: () => undefined,
});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const toast = useCallback((message: string, tone: ToastItem['tone'] = 'default') => {
    const id = String(Date.now());
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 2800);
  }, []);

  // Let plain modules (query hooks, API layers) raise toasts too.
  useEffect(() => {
    setToastHandler(toast);
    return () => setToastHandler(null);
  }, [toast]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <View pointerEvents="none" style={[styles.host, { top: insets.top + 8 }]}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.toast,
              {
                backgroundColor:
                  item.tone === 'error'
                    ? t.destructive
                    : item.tone === 'success'
                      ? t.success
                      : t.sidebar,
              },
            ]}
          >
            <Text style={{ color: '#fff', fontSize: fontSize.sm, fontWeight: '600' }}>
              {item.message}
            </Text>
          </View>
        ))}
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
    gap: spacing.sm,
  },
  toast: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
