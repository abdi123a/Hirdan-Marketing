import type { EmailStatus, EmailEventType, ConversationStatus } from './types';

export interface StatusStyle {
  label: string;
  /** Badge background. */
  bg: string;
  /** Badge text colour. */
  fg: string;
  /** Solid dot colour for timelines. */
  dot: string;
}

/**
 * Status → colour mapping following the same product spec as the web app:
 * Gray=Queued, Blue=Sent, Green=Delivered, Purple=Opened, Cyan=Clicked,
 * Orange=Deferred, Red=Bounced, Dark Red=Failed.
 */
export const STATUS_STYLES: Record<EmailStatus, StatusStyle> = {
  DRAFT: { label: 'Draft', bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  QUEUED: { label: 'Queued', bg: '#F3F4F6', fg: '#4B5563', dot: '#9CA3AF' },
  SCHEDULED: { label: 'Scheduled', bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  SENT: { label: 'Sent', bg: '#DBEAFE', fg: '#1D4ED8', dot: '#3B82F6' },
  DELIVERY_DELAYED: { label: 'Deferred', bg: '#FFEDD5', fg: '#C2410C', dot: '#F97316' },
  DELIVERED: { label: 'Delivered', bg: '#DCFCE7', fg: '#15803D', dot: '#22C55E' },
  OPENED: { label: 'Opened', bg: '#F3E8FF', fg: '#7E22CE', dot: '#A855F7' },
  CLICKED: { label: 'Clicked', bg: '#CFFAFE', fg: '#0E7490', dot: '#06B6D4' },
  BOUNCED: { label: 'Bounced', bg: '#FEE2E2', fg: '#B91C1C', dot: '#EF4444' },
  COMPLAINED: { label: 'Complained', bg: '#FFE4E6', fg: '#BE123C', dot: '#F43F5E' },
  FAILED: { label: 'Failed', bg: '#FECACA', fg: '#7F1D1D', dot: '#B91C1C' },
  CANCELED: { label: 'Canceled', bg: '#F3F4F6', fg: '#6B7280', dot: '#9CA3AF' },
  RECEIVED: { label: 'Received', bg: '#E0E7FF', fg: '#4338CA', dot: '#6366F1' },
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
    bg: mapped?.bg ?? STATUS_STYLES.QUEUED.bg,
    fg: mapped?.fg ?? STATUS_STYLES.QUEUED.fg,
    dot: type === 'REPLIED' ? '#10B981' : mapped?.dot ?? STATUS_STYLES.QUEUED.dot,
  };
}

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  WAITING_CUSTOMER: 'Waiting on customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const TEMPLATE_CATEGORY_LABELS = {
  SUPPORT: 'Support',
  SALES: 'Sales',
  INVOICES: 'Invoices',
  MARKETING: 'Marketing',
  HR: 'HR',
  LEGAL: 'Legal',
  SAVED_REPLY: 'Saved replies',
} as const;
