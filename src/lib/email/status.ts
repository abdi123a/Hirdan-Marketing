import type { EmailStatus, EmailEventType } from './types';

export interface StatusStyle {
  label: string;
  /** Tailwind classes for a badge (bg + text + border). */
  badge: string;
  /** Solid dot color class for timelines. */
  dot: string;
}

/**
 * Status → color mapping following the product spec:
 * Gray=Queued, Blue=Sent, Green=Delivered, Purple=Opened, Cyan=Clicked,
 * Orange=Deferred, Red=Bounced, Dark Red=Failed.
 */
export const STATUS_STYLES: Record<EmailStatus, StatusStyle> = {
  DRAFT: {
    label: 'Draft',
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  QUEUED: {
    label: 'Queued',
    badge: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  SENT: {
    label: 'Sent',
    badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    dot: 'bg-blue-500',
  },
  DELIVERY_DELAYED: {
    label: 'Deferred',
    badge: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
    dot: 'bg-orange-500',
  },
  DELIVERED: {
    label: 'Delivered',
    badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    dot: 'bg-green-500',
  },
  OPENED: {
    label: 'Opened',
    badge: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
    dot: 'bg-purple-500',
  },
  CLICKED: {
    label: 'Clicked',
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900',
    dot: 'bg-cyan-500',
  },
  BOUNCED: {
    label: 'Bounced',
    badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    dot: 'bg-red-500',
  },
  COMPLAINED: {
    label: 'Complained',
    badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900',
    dot: 'bg-rose-500',
  },
  FAILED: {
    label: 'Failed',
    badge: 'bg-red-200 text-red-900 border-red-300 dark:bg-red-900/60 dark:text-red-200 dark:border-red-800',
    dot: 'bg-red-700',
  },
  CANCELED: {
    label: 'Canceled',
    badge: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
  RECEIVED: {
    label: 'Received',
    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900',
    dot: 'bg-indigo-500',
  },
};

export function statusStyle(status: EmailStatus): StatusStyle {
  return STATUS_STYLES[status] ?? STATUS_STYLES.QUEUED;
}

const EVENT_LABELS: Record<EmailEventType, string> = {
  QUEUED: 'Queued',
  SCHEDULED: 'Scheduled',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  DELIVERY_DELAYED: 'Deferred',
  OPENED: 'Opened',
  CLICKED: 'Clicked',
  BOUNCED: 'Bounced',
  COMPLAINED: 'Complained',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
  RECEIVED: 'Received',
  REPLIED: 'Replied',
};

export function eventStyle(type: EmailEventType): StatusStyle {
  const mapped = (STATUS_STYLES as Record<string, StatusStyle>)[type];
  return {
    label: EVENT_LABELS[type] ?? type,
    badge: mapped?.badge ?? STATUS_STYLES.QUEUED.badge,
    dot: type === 'REPLIED' ? 'bg-emerald-500' : mapped?.dot ?? STATUS_STYLES.QUEUED.dot,
  };
}
