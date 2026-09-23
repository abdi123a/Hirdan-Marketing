import { prisma } from './prisma.js';
import {
  hasPermission,
  resolvePermissions,
  type AccessLevel,
  type ModuleKey,
  type PermissionMap,
} from './permissions.js';

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

    // Fire-and-forget push channels, both addressed to the same resolved users.
    void resolvePushRecipients(data)
      .then((recipients) => {
        if (recipients.length === 0) return;
        sendPushNotification(data, recipients).catch((err) => {
          console.warn('[OneSignal] Push notification failed:', err?.message);
        });
        sendExpoPushNotification(data, recipients).catch((err) => {
          console.warn('[ExpoPush] Push notification failed:', err?.message);
        });
      })
      .catch((err) => {
        console.warn('[Notifications] Failed to resolve push recipients:', err?.message);
      });
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}

// ─── Broadcast visibility (shared with GET /api/notifications) ──

/** Which permission module a broadcast notification's entity belongs to. */
export const NOTIFICATION_ENTITY_MODULE: Record<string, ModuleKey> = {
  INVOICE: 'invoices',
  PROFORMA: 'proforma',
  SUBSCRIPTION: 'subscriptions',
  CLIENT: 'clients',
  PROJECT: 'projects',
  EMPLOYEE: 'team',
  LEAD: 'leads',
  REPORT: 'monthly_reports',
};

/** Modules a staff member needs READ on to see a broadcast (userId = null) notification. */
export function broadcastModules(n: { type: string; entityType?: string | null }): ModuleKey[] {
  const modules: ModuleKey[] = [];
  const entityModule = n.entityType ? NOTIFICATION_ENTITY_MODULE[n.entityType] : undefined;
  if (entityModule) modules.push(entityModule);
  if (n.type.startsWith('HR_')) modules.push('hr');
  return modules;
}

/** Whether a staff member with these resolved permissions may see/receive the broadcast. */
export function canReceiveBroadcast(
  perms: Record<ModuleKey, AccessLevel>,
  n: { type: string; entityType?: string | null }
): boolean {
  return broadcastModules(n).every((mod) => hasPermission(perms, mod, 'READ'));
}

/**
 * User ids a push should go to. Targeted: that user, if still active.
 * Broadcast: active staff (never client logins) who can read the
 * notification's module — the same rule the in-app list applies.
 */
async function resolvePushRecipients(data: CreateNotificationInput): Promise<string[]> {
  if (data.userId) {
    const active = await prisma.user.count({ where: { id: data.userId, isActive: true } });
    return active > 0 ? [data.userId] : [];
  }
  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { not: 'CLIENT' } },
    select: { id: true, role: true, permissions: true },
  });
  return staff
    .filter((u) =>
      canReceiveBroadcast(resolvePermissions(u.role, (u.permissions as PermissionMap | null) ?? null), data)
    )
    .map((u) => u.id);
}

/**
 * Sends a web push via OneSignal to the notification's recipient(s).
 * Recipients are addressed by OneSignal external_id = our user id (the web app
 * calls OneSignal.login(user.id) after sign-in). A targeted notification goes
 * to that user only; a broadcast goes to active staff who can read its module —
 * never the "All" segment, which would include client-portal subscribers.
 * Requires oneSignalEnabled + oneSignalAppId + oneSignalApiKey in AgencySettings.
 */
async function sendPushNotification(data: CreateNotificationInput, recipients: string[]): Promise<void> {
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

  // OneSignal caps include_aliases at 2,000 ids per request.
  const chunkSize = 2000;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const payload = {
      app_id: settings.oneSignalAppId,
      include_aliases: { external_id: recipients.slice(i, i + chunkSize) },
      target_channel: 'push',
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
  }

  console.log(`[OneSignal] Push notification sent: ${data.type}`);
}

/**
 * Sends Expo Push notifications to the recipients' registered native devices
 * (see resolvePushRecipients: never client logins for broadcasts, never
 * disabled accounts, never staff without access to the module).
 */
async function sendExpoPushNotification(data: CreateNotificationInput, recipients: string[]): Promise<void> {
  const devices = await prisma.deviceToken.findMany({
    where: {
      userId: { in: recipients },
      platform: { in: ['ios', 'android'] },
      user: data.userId ? { isActive: true } : { isActive: true, role: { not: 'CLIENT' } },
    },
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
