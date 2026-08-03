import { prisma } from './prisma.js';

export type NotificationCategory = 'ACTION_REQUIRED' | 'INFORMATION' | 'SUCCESS' | 'WARNING';

export interface CreateNotificationInput {
  title: string;
  message: string;
  type: string;
  category: NotificationCategory;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  userId?: string;
}

/**
 * Creates an internal notification in the database.
 * Also fires OneSignal (web) and Expo Push (native) notifications if configured.
 */
export async function createNotification(data: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        category: data.category,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      },
    });

    // Fire-and-forget push channels
    sendPushNotification(data).catch((err) => {
      console.warn('[OneSignal] Push notification failed:', err?.message);
    });
    sendExpoPushNotification(data).catch((err) => {
      console.warn('[ExpoPush] Push notification failed:', err?.message);
    });
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}

/**
 * Sends a push notification via OneSignal to all subscribers.
 * Requires oneSignalEnabled + oneSignalAppId + oneSignalApiKey in AgencySettings.
 */
async function sendPushNotification(data: CreateNotificationInput): Promise<void> {
  const settings = await prisma.agencySettings.findFirst({
    select: {
      oneSignalEnabled: true,
      oneSignalAppId: true,
      oneSignalApiKey: true,
    },
  });

  if (!settings?.oneSignalEnabled || !settings.oneSignalAppId || !settings.oneSignalApiKey) {
    return; // OneSignal not configured
  }

  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const payload = {
    app_id: settings.oneSignalAppId,
    included_segments: ['All'], // sends to all subscribed users
    headings: { en: data.title },
    contents: { en: data.message },
    url: data.actionUrl ? `${appUrl}${data.actionUrl}` : appUrl,
    web_push_topic: data.type,
    data: {
      type: data.type,
      category: data.category,
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl: data.actionUrl,
    },
  };

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${settings.oneSignalApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OneSignal API error ${response.status}: ${errorBody}`);
  }

  console.log(`[OneSignal] Push notification sent: ${data.type}`);
}

/**
 * Sends Expo Push notifications to registered native device tokens.
 * When userId is set, only that user's devices are targeted; otherwise all staff devices.
 */
async function sendExpoPushNotification(data: CreateNotificationInput): Promise<void> {
  const devices = await prisma.deviceToken.findMany({
    where: data.userId
      ? { userId: data.userId, platform: { in: ['ios', 'android'] } }
      : { platform: { in: ['ios', 'android'] } },
    select: { token: true, id: true },
  });

  if (devices.length === 0) return;

  const messages = devices.map((d) => ({
    to: d.token,
    sound: 'default' as const,
    title: data.title,
    body: data.message,
    data: {
      type: data.type,
      category: data.category,
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl: data.actionUrl,
    },
  }));

  // Expo Push API accepts batches of up to 100
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Expo Push API error ${response.status}: ${errorBody}`);
    }

    const result = (await response.json()) as {
      data?: Array<{ status: string; details?: { error?: string }; message?: string }>;
    };

    // Prune invalid tokens
    const toDelete: string[] = [];
    result.data?.forEach((ticket, idx) => {
      if (
        ticket.status === 'error' &&
        (ticket.details?.error === 'DeviceNotRegistered' ||
          ticket.message?.includes('DeviceNotRegistered'))
      ) {
        toDelete.push(devices[i + idx].token);
      }
    });
    if (toDelete.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: toDelete } } });
    }
  }

  console.log(`[ExpoPush] Sent to ${devices.length} device(s): ${data.type}`);
}
