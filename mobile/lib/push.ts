import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from './api-client';

type NotificationsModule = typeof import('expo-notifications');
type Subscription = { remove: () => void };

/**
 * Remote push was removed from Expo Go on Android in SDK 53.
 * Importing expo-notifications there throws (DevicePushTokenAutoRegistration side effect),
 * so we never load the module in that environment.
 */
export function arePushNotificationsAvailable(): boolean {
  return !(isRunningInExpoGo() && Platform.OS === 'android');
}

let notificationsPromise: Promise<NotificationsModule | null> | null = null;
let handlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (!arePushNotificationsAvailable()) return null;
  if (!notificationsPromise) {
    notificationsPromise = import('expo-notifications')
      .then((Notifications) => {
        if (!handlerConfigured) {
          handlerConfigured = true;
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
        }
        return Notifications;
      })
      .catch(() => null);
  }
  return notificationsPromise;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  await apiFetch(endpoints.devices.register, {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceName: Device.modelName || undefined,
    }),
  });

  return token;
}

export async function subscribeToNotificationResponses(
  onResponse: (data: Record<string, unknown>) => void,
): Promise<Subscription> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return { remove: () => undefined };
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    onResponse(data);
  });
}

export function getActionPathFromNotification(data: Record<string, unknown> | undefined): string | null {
  const actionUrl = typeof data?.actionUrl === 'string' ? data.actionUrl : null;
  if (!actionUrl) return null;
  // Map web dashboard paths to mobile routes where possible
  if (actionUrl.includes('/clients')) return '/(tabs)/clients';
  if (actionUrl.includes('/invoices') || actionUrl.includes('/proforma')) return '/(tabs)/money';
  if (actionUrl.includes('/social')) return '/(tabs)/social';
  if (actionUrl.includes('/notifications')) return '/(tabs)/home/notifications';
  return '/(tabs)/home';
}
