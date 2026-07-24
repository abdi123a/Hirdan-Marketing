// ─── Email Center — shared client types ──────────────────────────

export type EmailFolder =
  | 'inbox'
  | 'sent'
  | 'drafts'
  | 'scheduled'
  | 'outbox'
  | 'spam'
  | 'trash'
  | 'starred'
  | 'archived';

export type EmailDirection = 'INBOUND' | 'OUTBOUND';

export type EmailStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'SCHEDULED'
  | 'SENT'
  | 'DELIVERED'
  | 'DELIVERY_DELAYED'
  | 'OPENED'
  | 'CLICKED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'FAILED'
  | 'CANCELED'
  | 'RECEIVED';

export type EmailEventType =
  | 'QUEUED'
  | 'SCHEDULED'
  | 'SENT'
  | 'DELIVERED'
  | 'DELIVERY_DELAYED'
  | 'OPENED'
  | 'CLICKED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'FAILED'
  | 'CANCELED'
  | 'RECEIVED'
  | 'REPLIED';

export type ConversationStatus =
  | 'OPEN'
  | 'PENDING'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type MailboxAccessLevel = 'READ' | 'WRITE' | 'MANAGE' | 'ADMIN';
export type EmailPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type ParticipantRole = 'FROM' | 'TO' | 'CC' | 'BCC';

export interface Mailbox {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  signature: string | null;
  department: string | null;
  replyTo: string | null;
  color: string | null;
  isActive: boolean;
  isDefault: boolean;
  unreadCount?: number;
  accessLevel?: MailboxAccessLevel | null;
}

export interface EmailLabel {
  id: string;
  name: string;
  color: string;
}

export interface ConversationLabelLink {
  labelId: string;
  label: EmailLabel;
}

export interface Participant {
  id: string;
  conversationId: string;
  email: string;
  name: string | null;
  role: ParticipantRole;
}

export interface EmailEvent {
  id: string;
  emailId: string;
  type: EmailEventType;
  payload?: unknown;
  link: string | null;
  occurredAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

export interface EmailMessage {
  id: string;
  conversationId: string;
  mailboxId: string;
  direction: EmailDirection;
  status: EmailStatus;
  priority: EmailPriority;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails?: string[] | null;
  bccEmails?: string[] | null;
  subject: string;
  html: string | null;
  text: string | null;
  snippet: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  isRead: boolean;
  errorMessage: string | null;
  createdAt: string;
  events?: EmailEvent[];
  attachments?: Attachment[];
  conversation?: { id: string; subject: string };
  mailbox?: Pick<Mailbox, 'id' | 'email' | 'displayName'>;
}

export interface ConversationSummary {
  id: string;
  mailboxId: string;
  subject: string;
  clientId: string | null;
  assigneeId: string | null;
  status: ConversationStatus;
  snippet: string | null;
  messageCount: number;
  unreadCount: number;
  hasAttachment: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isFlagged: boolean;
  isSpam: boolean;
  isArchived: boolean;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  mailbox: Pick<Mailbox, 'id' | 'email' | 'displayName' | 'color'>;
  assignee: { id: string; name: string; email: string } | null;
  labels: ConversationLabelLink[];
  participants: Participant[];
}

export interface ConversationNote {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  mentions?: string[];
  createdAt: string;
  author: { id: string; name: string };
}

export interface ConversationDetail extends ConversationSummary {
  client: { id: string; name: string; email: string | null; company: string } | null;
  notes: ConversationNote[];
  emails: EmailMessage[];
  mailbox: Pick<Mailbox, 'id' | 'email' | 'displayName' | 'color'> & {
    signature?: string | null;
    replyTo?: string | null;
  };
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
  total: number;
  hasMore: boolean;
}

export interface Draft {
  id: string;
  mailboxId: string | null;
  conversationId: string | null;
  toEmails?: string[] | null;
  ccEmails?: string[] | null;
  bccEmails?: string[] | null;
  subject: string | null;
  html: string | null;
  priority: EmailPriority;
  scheduledAt: string | null;
  updatedAt: string;
}

export interface TrackingSummary {
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    complained: number;
    failed: number;
    scheduled: number;
    queued: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
    failureRate: number;
  };
  byStatus: Record<string, number>;
}

export interface SendPayload {
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  priority?: EmailPriority;
  scheduledAt?: string | null;
  clientId?: string | null;
  draftId?: string | null;
  attachments?: { filename: string; content: string; contentType?: string }[];
}
