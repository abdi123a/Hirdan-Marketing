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
 * Also fires a OneSignal push notification if configured.
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

    // Fire-and-forget OneSignal push notification (for clients outside the system)
    sendPushNotification(data).catch(err => {
      console.warn('[OneSignal] Push notification failed:', err?.message);
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
