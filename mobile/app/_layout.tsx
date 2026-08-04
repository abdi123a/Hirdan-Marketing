import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityInfo, ActivityIndicator, Image, View } from 'react-native';
import { useAuthStore } from '../lib/auth-store';
import { ToastProvider } from '../components/ui';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  registerForPushNotifications,
  getActionPathFromNotification,
  subscribeToNotificationResponses,
} from '../lib/push';
import { brand } from '../constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLocked = useAuthStore((s) => s.isLocked);
  const segments = useSegments();
  const router = useRouter();
  const responseListener = useRef<{ remove: () => void } | null>(null);
  const sessionReady = isAuthenticated && !isLocked;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuth = segments[0] === '(auth)';
    if (!sessionReady && !inAuth) {
      router.replace('/(auth)/login');
    } else if (sessionReady && inAuth) {
      router.replace('/(tabs)/home');
      registerForPushNotifications().catch(() => undefined);
    }
  }, [isHydrated, sessionReady, segments, router]);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;

    void subscribeToNotificationResponses((data) => {
      const path = getActionPathFromNotification(data);
      if (path) router.push(path as any);
    }).then((subscription) => {
      if (cancelled) {
        subscription.remove();
        return;
      }
      responseListener.current = subscription;
    });

    return () => {
      cancelled = true;
      responseListener.current?.remove();
      responseListener.current = null;
    };
  }, [sessionReady, router]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <Image
          source={require('../assets/hirdan-logo.png')}
          style={{ width: 220, height: 100 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={brand.purple} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      {children}
    </View>
  );
}

export default function RootLayout() {
  // Honour reduce-motion at the root (screens can read this via AccessibilityInfo)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthGate>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </AuthGate>
            </ToastProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
