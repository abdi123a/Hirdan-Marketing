import { apiFetch, apiUpload } from '@/lib/api-client';
import type {
  ActivityItem,
  AgentStat,
  AnalyticsOverview,
  Attachment,
  AttachmentVersion,
  ClientLite,
  ConversationDetail,
  ConversationNote,
  ConversationsResponse,
  CustomerContext,
  DepartmentStat,
  DirectoryUser,
  Draft,
  EmailEvent,
  EmailFolder,
  EmailLabel,
  EmailMessage,
  EmailStatus,
  EmailTemplate,
  Mailbox,
  MailboxPermission,
  MailboxStat,
  SearchFilters,
  SendPayload,
  TopSender,
  TrackingSummary,
  VolumePoint,
} from './types';

// ─── Mailboxes ───────────────────────────────────────────────────
export const emailApi = {
  listMailboxes: () => apiFetch<{ mailboxes: Mailbox[] }>('/email/mailboxes'),

  createMailbox: (data: Partial<Mailbox>) =>
    apiFetch<{ mailbox: Mailbox }>('/email/mailboxes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMailbox: (id: string, data: Partial<Mailbox>) =>
    apiFetch<{ mailbox: Mailbox }>(`/email/mailboxes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMailbox: (id: string) =>
    apiFetch<{ success: boolean }>(`/email/mailboxes/${id}`, { method: 'DELETE' }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<{ success: boolean; avatarUrl: string }>('/email/mailboxes/upload-avatar', formData);
  },

  // ─── Mailbox permissions (ADMIN) ───────────────────────────────
  listPermissions: (mailboxId: string) =>
    apiFetch<{ permissions: MailboxPermission[] }>(`/email/mailboxes/${mailboxId}/permissions`),

  grantPermission: (mailboxId: string, userId: string, accessLevel: 'READ' | 'WRITE' | 'MANAGE') =>
    apiFetch<{ permission: MailboxPermission }>(`/email/mailboxes/${mailboxId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ userId, accessLevel }),
    }),

  revokePermission: (mailboxId: string, userId: string) =>
    apiFetch<{ success: boolean }>(`/email/mailboxes/${mailboxId}/permissions/${userId}`, {
      method: 'DELETE',
    }),

  listUsers: () => apiFetch<{ users: DirectoryUser[] }>('/users?take=100'),

  // ─── Conversations ─────────────────────────────────────────────
  listConversations: (params: {
    folder: EmailFolder;
    mailboxId?: string;
    q?: string;
    labelId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    filters?: SearchFilters;
  }) => {
    const qs = new URLSearchParams();
    qs.set('folder', params.folder);
    if (params.mailboxId) qs.set('mailboxId', params.mailboxId);
    if (params.q) qs.set('q', params.q);
    if (params.labelId) qs.set('labelId', params.labelId);
    if (params.status) qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const f = params.filters;
    if (f?.hasAttachment) qs.set('hasAttachment', 'true');
    if (f?.unread) qs.set('unread', 'true');
    if (f?.direction) qs.set('direction', f.direction);
    if (f?.status) qs.set('status', f.status);
    if (f?.labelId) qs.set('labelId', f.labelId);
    if (f?.dateFrom) qs.set('dateFrom', f.dateFrom);
    if (f?.dateTo) qs.set('dateTo', f.dateTo);
    return apiFetch<ConversationsResponse>(`/email/conversations?${qs.toString()}`);
  },

  getConversation: (id: string) =>
    apiFetch<{ conversation: ConversationDetail }>(`/email/conversations/${id}`),

  markRead: (id: string) =>
    apiFetch<{ success: boolean }>(`/email/conversations/${id}/read`, { method: 'POST' }),

  markUnread: (id: string) =>
    apiFetch<{ success: boolean }>(`/email/conversations/${id}/unread`, { method: 'POST' }),

  patchConversation: (
    id: string,
    data: Partial<{
      isStarred: boolean;
      isImportant: boolean;
      isFlagged: boolean;
      status: string;
      assigneeId: string | null;
      clientId: string | null;
    }>
  ) =>
    apiFetch<{ conversation: ConversationDetail }>(`/email/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  conversationAction: (
    id: string,
    action: 'spam' | 'not-spam' | 'trash' | 'restore' | 'archive' | 'unarchive'
  ) =>
    apiFetch<{ success: boolean }>(`/email/conversations/${id}/${action}`, { method: 'POST' }),

  bulkAction: (ids: string[], action: string) =>
    apiFetch<{ success: boolean; count: number }>(`/email/conversations/bulk`, {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),

  getScheduled: () => apiFetch<{ emails: EmailMessage[] }>('/email/scheduled'),
  getOutbox: () => apiFetch<{ emails: EmailMessage[] }>('/email/outbox'),

  // ─── Send / reply / forward ────────────────────────────────────
  send: (payload: SendPayload) =>
    apiFetch<{ email: EmailMessage; conversation: ConversationDetail }>('/email/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reply: (
    conversationId: string,
    payload: {
      html: string;
      /** Optional From override — reply from another mailbox the user can send from. */
      mailboxId?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      replyAll?: boolean;
      priority?: string;
      scheduledAt?: string | null;
      attachments?: { filename: string; content: string; contentType?: string }[];
    }
  ) =>
    apiFetch<{ email: EmailMessage; conversation: ConversationDetail }>(
      `/email/conversations/${conversationId}/reply`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  forward: (
    emailId: string,
    payload: { mailboxId?: string; to: string[]; cc?: string[]; bcc?: string[]; note?: string }
  ) =>
    apiFetch<{ email: EmailMessage; conversation: ConversationDetail }>(
      `/email/messages/${emailId}/forward`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  // ─── Drafts ────────────────────────────────────────────────────
  listDrafts: () => apiFetch<{ drafts: Draft[] }>('/email/drafts'),
  createDraft: (data: Partial<Draft> & { to?: string[]; cc?: string[]; bcc?: string[] }) =>
    apiFetch<{ draft: Draft }>('/email/drafts', { method: 'POST', body: JSON.stringify(data) }),
  updateDraft: (id: string, data: Partial<Draft> & { to?: string[]; cc?: string[]; bcc?: string[] }) =>
    apiFetch<{ draft: Draft }>(`/email/drafts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDraft: (id: string) =>
    apiFetch<{ success: boolean }>(`/email/drafts/${id}`, { method: 'DELETE' }),

  // ─── Tracking ──────────────────────────────────────────────────
  getEmail: (id: string) => apiFetch<{ email: EmailMessage }>(`/email/emails/${id}`),
  getEmailEvents: (id: string) =>
    apiFetch<{ status: EmailStatus; events: EmailEvent[] }>(`/email/emails/${id}/events`),
  trackingSummary: (mailboxId?: string) => {
    const qs = mailboxId ? `?mailboxId=${mailboxId}` : '';
    return apiFetch<TrackingSummary>(`/email/tracking/summary${qs}`);
  },

  // ─── Templates ─────────────────────────────────────────────────
  listTemplates: (category?: string) =>
    apiFetch<{ templates: EmailTemplate[] }>(`/email/templates${category ? `?category=${category}` : ''}`),
  createTemplate: (data: Partial<EmailTemplate>) =>
    apiFetch<{ template: EmailTemplate }>('/email/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<EmailTemplate>) =>
    apiFetch<{ template: EmailTemplate }>(`/email/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    apiFetch<{ success: boolean }>(`/email/templates/${id}`, { method: 'DELETE' }),

  // ─── Labels ────────────────────────────────────────────────────
  listLabels: () => apiFetch<{ labels: EmailLabel[] }>('/email/labels'),
  createLabel: (data: { name: string; color: string }) =>
    apiFetch<{ label: EmailLabel }>('/email/labels', { method: 'POST', body: JSON.stringify(data) }),
  updateLabel: (id: string, data: { name?: string; color?: string }) =>
    apiFetch<{ label: EmailLabel }>(`/email/labels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLabel: (id: string) =>
    apiFetch<{ success: boolean }>(`/email/labels/${id}`, { method: 'DELETE' }),
  addLabel: (conversationId: string, labelId: string) =>
    apiFetch<{ success: boolean }>(`/email/conversations/${conversationId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    }),
  removeLabel: (conversationId: string, labelId: string) =>
    apiFetch<{ success: boolean }>(`/email/conversations/${conversationId}/labels/${labelId}`, {
      method: 'DELETE',
    }),

  // ─── Internal notes ────────────────────────────────────────────
  listNotes: (conversationId: string) =>
    apiFetch<{ notes: ConversationNote[] }>(`/email/conversations/${conversationId}/notes`),
  addNote: (conversationId: string, body: string, mentions: string[]) =>
    apiFetch<{ note: ConversationNote }>(`/email/conversations/${conversationId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body, mentions }),
    }),
  deleteNote: (conversationId: string, noteId: string) =>
    apiFetch<{ success: boolean }>(`/email/conversations/${conversationId}/notes/${noteId}`, {
      method: 'DELETE',
    }),
  listMentionable: () => apiFetch<{ users: DirectoryUser[] }>('/email/mentionable-users'),

  // ─── Outbox / scheduled ────────────────────────────────────────
  cancelScheduled: (emailId: string) =>
    apiFetch<{ email: EmailMessage }>(`/email/emails/${emailId}/cancel`, { method: 'POST' }),
  retryFailed: (emailId: string) =>
    apiFetch<{ email: EmailMessage }>(`/email/emails/${emailId}/retry`, { method: 'POST' }),

  // ─── Analytics ─────────────────────────────────────────────────
  analyticsOverview: (mailboxId?: string) =>
    apiFetch<AnalyticsOverview>(`/email/analytics/overview${mailboxId ? `?mailboxId=${mailboxId}` : ''}`),
  analyticsVolume: (days = 30, mailboxId?: string) => {
    const qs = new URLSearchParams({ days: String(days) });
    if (mailboxId) qs.set('mailboxId', mailboxId);
    return apiFetch<{ series: VolumePoint[] }>(`/email/analytics/volume?${qs.toString()}`);
  },
  analyticsByMailbox: () => apiFetch<{ mailboxes: MailboxStat[] }>('/email/analytics/by-mailbox'),
  analyticsTopSenders: (mailboxId?: string) =>
    apiFetch<{ senders: TopSender[] }>(`/email/analytics/top-senders${mailboxId ? `?mailboxId=${mailboxId}` : ''}`),
  analyticsByAgent: (mailboxId?: string) =>
    apiFetch<{ agents: AgentStat[] }>(`/email/analytics/by-agent${mailboxId ? `?mailboxId=${mailboxId}` : ''}`),
  analyticsByDepartment: () => apiFetch<{ departments: DepartmentStat[] }>('/email/analytics/by-department'),
  analyticsActivity: (mailboxId?: string) =>
    apiFetch<{ activity: ActivityItem[] }>(`/email/analytics/activity${mailboxId ? `?mailboxId=${mailboxId}` : ''}`),

  // ─── Attachment versions ───────────────────────────────────────
  attachmentVersions: (id: string) =>
    apiFetch<{ versions: AttachmentVersion[] }>(`/email/attachments/${id}/versions`),
  replaceAttachment: (id: string, data: { filename: string; content: string; contentType?: string }) =>
    apiFetch<{ attachment: Attachment }>(`/email/attachments/${id}/replace`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ─── Customer integration ──────────────────────────────────────
  getCustomer: (conversationId: string) =>
    apiFetch<{ customer: CustomerContext | null; suggested: boolean }>(`/email/conversations/${conversationId}/customer`),
  linkClient: (conversationId: string, clientId: string | null) =>
    apiFetch<{ success: boolean; clientId: string | null }>(`/email/conversations/${conversationId}/link-client`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    }),
  searchClients: (q: string) =>
    apiFetch<{ clients: ClientLite[] }>(`/email/clients/search?q=${encodeURIComponent(q)}`),

  // ─── SSE stream ticket ─────────────────────────────────────────
  streamTicket: () => apiFetch<{ ticket: string }>('/email/stream/ticket', { method: 'POST' }),
};
