import { apiFetch, apiUpload } from '@/lib/api-client';
import type {
  ConversationDetail,
  ConversationsResponse,
  DirectoryUser,
  Draft,
  EmailFolder,
  EmailMessage,
  Mailbox,
  MailboxPermission,
  SendPayload,
  TrackingSummary,
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
  }) => {
    const qs = new URLSearchParams();
    qs.set('folder', params.folder);
    if (params.mailboxId) qs.set('mailboxId', params.mailboxId);
    if (params.q) qs.set('q', params.q);
    if (params.labelId) qs.set('labelId', params.labelId);
    if (params.status) qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
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
  trackingSummary: (mailboxId?: string) => {
    const qs = mailboxId ? `?mailboxId=${mailboxId}` : '';
    return apiFetch<TrackingSummary>(`/email/tracking/summary${qs}`);
  },

  // ─── SSE stream ticket ─────────────────────────────────────────
  streamTicket: () => apiFetch<{ ticket: string }>('/email/stream/ticket', { method: 'POST' }),
};
