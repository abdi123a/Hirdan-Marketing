import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityInfo, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../lib/auth-store';
import { ToastProvider } from '../components/ui';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  registerForPushNotifications,
  getActionPathFromNotification,
  subscribeToNotificationResponses,
} from '../lib/push';
import { font } from '../constants/typography';
import { useTheme } from '../hooks/useTheme';

/**
 * Hold the native splash until the session is restored.
 *
 * Without this, Expo drops the splash the moment the root view mounts — which
 * is before hydration finishes — so the app used to show the splash image,
 * then a second in-app loading screen with a different logo, then the UI.
 * Three stages for one launch. Holding the one native splash across the whole
 * startup means there is only ever one.
 */
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 220 });

/** Longest the splash may ever hold, however hydration goes. */
const MAX_SPLASH_MS = 4000;

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

  /*
   * Hand off from the native splash when the session is restored — or after
   * MAX_SPLASH_MS regardless.
   *
   * The timeout is not decoration. Holding the splash means the app has no
   * other way to tell the user anything, so any path where hydration never
   * settles leaves them staring at a logo with no error and no escape. Showing
   * a possibly-unready screen beats a permanent splash.
   */
  useEffect(() => {
    if (isHydrated) {
      void SplashScreen.hideAsync().catch(() => undefined);
      return;
    }
    const bailout = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, MAX_SPLASH_MS);
    return () => clearTimeout(bailout);
  }, [isHydrated]);

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

  /*
   * The navigator always mounts, even mid-hydration.
   *
   * Returning null here left expo-router with no navigator at the root, so the
   * `router.replace` above had nothing to navigate and the tree never
   * finished coming up — the app sat on the splash indefinitely. The splash is
   * covering this window anyway, so there is nothing to hide by rendering it.
   */
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      {children}
    </View>
  );
}

const detailOptions = (title: string, t: ReturnType<typeof useTheme>) => ({
  headerShown: true,
  title,
  animation: 'slide_from_right' as const,
  headerStyle: { backgroundColor: t.background },
  headerTintColor: t.foreground,
  headerShadowVisible: false,
  // Native headers don't inherit the app's type scale, so the family has to be
  // named here or every pushed screen reverts to the platform face.
  headerTitleStyle: {
    ...font(600),
    fontSize: 17,
    color: t.foreground,
  },
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: t.background },
});

const modalOptions = (title: string, t: ReturnType<typeof useTheme>) => ({
  ...detailOptions(title, t),
  presentation: 'modal' as const,
  animation: 'slide_from_bottom' as const,
});

function RootNavigator() {
  const t = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />

      <Stack.Screen name="client/[id]" options={detailOptions('Client', t)} />
      <Stack.Screen name="client/add" options={modalOptions('Add Client', t)} />
      <Stack.Screen name="client/edit/[id]" options={modalOptions('Edit Client', t)} />

      <Stack.Screen name="invoice/[id]" options={detailOptions('Invoice', t)} />
      <Stack.Screen name="invoice/add" options={modalOptions('New Invoice', t)} />
      <Stack.Screen name="invoice/edit/[id]" options={modalOptions('Edit Invoice', t)} />

      <Stack.Screen name="proforma/[id]" options={detailOptions('Proforma', t)} />
      <Stack.Screen name="proforma/add" options={modalOptions('New Proforma', t)} />
      <Stack.Screen name="proforma/edit/[id]" options={modalOptions('Edit Proforma', t)} />

      <Stack.Screen name="expense/[id]" options={detailOptions('Expense', t)} />
      <Stack.Screen name="expense/add" options={modalOptions('Add Expense', t)} />
      <Stack.Screen name="expense/edit/[id]" options={modalOptions('Edit Expense', t)} />

      <Stack.Screen name="project/[id]" options={detailOptions('Project', t)} />
      <Stack.Screen name="project/add" options={modalOptions('New Project', t)} />
      <Stack.Screen name="project/edit/[id]" options={modalOptions('Edit Project', t)} />

      <Stack.Screen name="subscription/[id]" options={detailOptions('Subscription', t)} />
      <Stack.Screen name="subscription/add" options={modalOptions('New Subscription', t)} />
      <Stack.Screen name="subscription/edit/[id]" options={modalOptions('Edit Subscription', t)} />

      <Stack.Screen name="transfer/[id]" options={detailOptions('Transfer', t)} />
      <Stack.Screen name="transfer/add" options={modalOptions('Upload file', t)} />
      <Stack.Screen
        name="transfer/preview/[id]"
        options={{ ...modalOptions('Preview', t), presentation: 'fullScreenModal' }}
      />

      <Stack.Screen name="post/[id]" options={detailOptions('Post', t)} />
      <Stack.Screen name="compose" options={detailOptions('Compose', t)} />
      <Stack.Screen name="settings" options={detailOptions('Settings', t)} />
    </Stack>
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
                <RootNavigator />
              </AuthGate>
            </ToastProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
