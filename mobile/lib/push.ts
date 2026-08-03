import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from './api-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

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
