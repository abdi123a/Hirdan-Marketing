import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityInfo, ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../lib/auth-store';
import { ToastProvider } from '../components/ui';
import { OfflineBanner } from '../components/OfflineBanner';
import { useTheme } from '../hooks/useTheme';
import { registerForPushNotifications, getActionPathFromNotification } from '../lib/push';

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
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)/home');
      registerForPushNotifications().catch(() => undefined);
    }
  }, [isHydrated, isAuthenticated, segments, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const path = getActionPathFromNotification(data);
      if (path) router.push(path as any);
    });
    return () => {
      responseListener.current?.remove();
    };
  }, [isAuthenticated, router]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background }}>
        <ActivityIndicator color={t.primary} size="large" />
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
