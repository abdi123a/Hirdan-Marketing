import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { emailApi } from './api';
import type { EmailFolder } from './types';

export const emailKeys = {
  mailboxes: ['email', 'mailboxes'] as const,
  conversations: (folder: EmailFolder, mailboxId?: string, q?: string) =>
    ['email', 'conversations', folder, mailboxId ?? 'all', q ?? ''] as const,
  conversation: (id: string) => ['email', 'conversation', id] as const,
  scheduled: ['email', 'scheduled'] as const,
  outbox: ['email', 'outbox'] as const,
  drafts: ['email', 'drafts'] as const,
  tracking: (mailboxId?: string) => ['email', 'tracking', mailboxId ?? 'all'] as const,
  emailEvents: (id: string) => ['email', 'events', id] as const,
};

export function useMailboxes(enabled = true) {
  return useQuery({
    queryKey: emailKeys.mailboxes,
    queryFn: () => emailApi.listMailboxes().then((r) => r.mailboxes),
    staleTime: 60_000,
    enabled,
  });
}

export function useMailboxMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: emailKeys.mailboxes });

  const create = useMutation({
    mutationFn: (data: Parameters<typeof emailApi.createMailbox>[0]) => emailApi.createMailbox(data),
    onSuccess: () => { invalidate(); toast.success('Mailbox created'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to create mailbox'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof emailApi.updateMailbox>[1] }) =>
      emailApi.updateMailbox(id, data),
    onSuccess: () => { invalidate(); toast.success('Mailbox updated'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to update mailbox'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => emailApi.deleteMailbox(id),
    onSuccess: () => { invalidate(); toast.success('Mailbox deleted'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete mailbox'),
  });

  return { create, update, remove };
}

export function useDirectoryUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['email', 'directory-users'],
    queryFn: () => emailApi.listUsers().then((r) => r.users),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function usePermissions(mailboxId: string | null) {
  return useQuery({
    queryKey: ['email', 'permissions', mailboxId],
    queryFn: () => emailApi.listPermissions(mailboxId as string).then((r) => r.permissions),
    enabled: !!mailboxId,
  });
}

export function usePermissionMutations(mailboxId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['email', 'permissions', mailboxId] });
    qc.invalidateQueries({ queryKey: emailKeys.mailboxes });
  };

  const grant = useMutation({
    mutationFn: ({ userId, accessLevel }: { userId: string; accessLevel: 'READ' | 'WRITE' | 'MANAGE' }) =>
      emailApi.grantPermission(mailboxId, userId, accessLevel),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Failed to grant access'),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => emailApi.revokePermission(mailboxId, userId),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Failed to revoke access'),
  });

  return { grant, revoke };
}

export function useConversations(params: {
  folder: EmailFolder;
  mailboxId?: string;
  q?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: emailKeys.conversations(params.folder, params.mailboxId, params.q),
    queryFn: () =>
      emailApi.listConversations({
        folder: params.folder,
        mailboxId: params.mailboxId,
        q: params.q,
        limit: params.limit,
        offset: params.offset,
      }),
    enabled: params.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: id ? emailKeys.conversation(id) : ['email', 'conversation', 'none'],
    queryFn: () => emailApi.getConversation(id as string).then((r) => r.conversation),
    enabled: !!id,
  });
}

export function useScheduled(enabled: boolean) {
  return useQuery({
    queryKey: emailKeys.scheduled,
    queryFn: () => emailApi.getScheduled().then((r) => r.emails),
    enabled,
  });
}

export function useOutbox(enabled: boolean) {
  return useQuery({
    queryKey: emailKeys.outbox,
    queryFn: () => emailApi.getOutbox().then((r) => r.emails),
    enabled,
  });
}

export function useDrafts(enabled: boolean) {
  return useQuery({
    queryKey: emailKeys.drafts,
    queryFn: () => emailApi.listDrafts().then((r) => r.drafts),
    enabled,
  });
}

export function useTrackingSummary(mailboxId?: string) {
  return useQuery({
    queryKey: emailKeys.tracking(mailboxId),
    queryFn: () => emailApi.trackingSummary(mailboxId),
    staleTime: 30_000,
  });
}

/** Live event timeline for one outbound email (refetches while open). */
export function useEmailEvents(emailId: string | null, enabled = true) {
  return useQuery({
    queryKey: emailId ? emailKeys.emailEvents(emailId) : ['email', 'events', 'none'],
    queryFn: () => emailApi.getEmailEvents(emailId as string),
    enabled: !!emailId && enabled,
    refetchInterval: enabled ? 20_000 : false,
    staleTime: 5_000,
  });
}

/** Invalidate the conversation lists + mailbox counts after a mutation. */
export function useInvalidateEmail() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
    qc.invalidateQueries({ queryKey: emailKeys.mailboxes });
  };
}

export function useConversationActions() {
  const qc = useQueryClient();
  const invalidateLists = () => {
    qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
    qc.invalidateQueries({ queryKey: emailKeys.mailboxes });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => emailApi.markRead(id),
    onSuccess: invalidateLists,
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof emailApi.patchConversation>[1] }) =>
      emailApi.patchConversation(id, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: emailKeys.conversation(vars.id) });
      invalidateLists();
    },
  });

  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Parameters<typeof emailApi.conversationAction>[1] }) =>
      emailApi.conversationAction(id, action),
    onSuccess: invalidateLists,
  });

  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: string }) => emailApi.bulkAction(ids, action),
    onSuccess: (res) => {
      invalidateLists();
      toast.success(`Updated ${res.count} conversation${res.count === 1 ? '' : 's'}`);
    },
  });

  return { markRead, patch, action, bulk };
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emailApi.send,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
      qc.invalidateQueries({ queryKey: emailKeys.mailboxes });
      qc.invalidateQueries({ queryKey: emailKeys.drafts });
      toast.success('Message sent');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to send message'),
  });
}

export function useReply(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof emailApi.reply>[1]) =>
      emailApi.reply(conversationId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
      toast.success('Reply sent');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to send reply'),
  });
}

// ─── Templates ───────────────────────────────────────────────────
export function useTemplates(category?: string) {
  return useQuery({
    queryKey: ['email', 'templates', category ?? 'all'],
    queryFn: () => emailApi.listTemplates(category).then((r) => r.templates),
    staleTime: 60_000,
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['email', 'templates'] });
  const create = useMutation({
    mutationFn: (data: Parameters<typeof emailApi.createTemplate>[0]) => emailApi.createTemplate(data),
    onSuccess: () => { invalidate(); toast.success('Template saved'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to save template'),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof emailApi.updateTemplate>[1] }) =>
      emailApi.updateTemplate(id, data),
    onSuccess: () => { invalidate(); toast.success('Template updated'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to update template'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => emailApi.deleteTemplate(id),
    onSuccess: () => { invalidate(); toast.success('Template deleted'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete template'),
  });
  return { create, update, remove };
}

// ─── Labels ──────────────────────────────────────────────────────
export function useLabels() {
  return useQuery({
    queryKey: ['email', 'labels'],
    queryFn: () => emailApi.listLabels().then((r) => r.labels),
    staleTime: 60_000,
  });
}

export function useLabelMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['email', 'labels'] });
    qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
  };
  const create = useMutation({
    mutationFn: (data: { name: string; color: string }) => emailApi.createLabel(data),
    onSuccess: () => { invalidate(); toast.success('Label created'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to create label'),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      emailApi.updateLabel(id, data),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || 'Failed to update label'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => emailApi.deleteLabel(id),
    onSuccess: () => { invalidate(); toast.success('Label deleted'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete label'),
  });
  return { create, update, remove };
}

export function useConversationLabels(conversationId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
    qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
    qc.invalidateQueries({ queryKey: ['email', 'labels'] });
  };
  const add = useMutation({
    mutationFn: (labelId: string) => emailApi.addLabel(conversationId, labelId),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (labelId: string) => emailApi.removeLabel(conversationId, labelId),
    onSuccess: invalidate,
  });
  return { add, remove };
}

// ─── Internal notes ──────────────────────────────────────────────
export function useMentionableUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['email', 'mentionable-users'],
    queryFn: () => emailApi.listMentionable().then((r) => r.users),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useNoteMutations(conversationId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
  const add = useMutation({
    mutationFn: ({ body, mentions }: { body: string; mentions: string[] }) =>
      emailApi.addNote(conversationId, body, mentions),
    onSuccess: () => { invalidate(); toast.success('Note added'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to add note'),
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => emailApi.deleteNote(conversationId, noteId),
    onSuccess: invalidate,
  });
  return { add, remove };
}

// ─── Analytics ───────────────────────────────────────────────────
export function useAnalyticsOverview(mailboxId?: string) {
  return useQuery({
    queryKey: ['email', 'analytics', 'overview', mailboxId ?? 'all'],
    queryFn: () => emailApi.analyticsOverview(mailboxId),
    staleTime: 30_000,
  });
}

export function useAnalyticsVolume(days: number, mailboxId?: string) {
  return useQuery({
    queryKey: ['email', 'analytics', 'volume', days, mailboxId ?? 'all'],
    queryFn: () => emailApi.analyticsVolume(days, mailboxId).then((r) => r.series),
    staleTime: 30_000,
  });
}

export function useAnalyticsByMailbox() {
  return useQuery({
    queryKey: ['email', 'analytics', 'by-mailbox'],
    queryFn: () => emailApi.analyticsByMailbox().then((r) => r.mailboxes),
    staleTime: 30_000,
  });
}

export function useTopSenders(mailboxId?: string) {
  return useQuery({
    queryKey: ['email', 'analytics', 'top-senders', mailboxId ?? 'all'],
    queryFn: () => emailApi.analyticsTopSenders(mailboxId).then((r) => r.senders),
    staleTime: 30_000,
  });
}

export function useAgents(mailboxId?: string) {
  return useQuery({
    queryKey: ['email', 'analytics', 'by-agent', mailboxId ?? 'all'],
    queryFn: () => emailApi.analyticsByAgent(mailboxId).then((r) => r.agents),
    staleTime: 30_000,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['email', 'analytics', 'by-department'],
    queryFn: () => emailApi.analyticsByDepartment().then((r) => r.departments),
    staleTime: 30_000,
  });
}

export function useActivity(mailboxId?: string) {
  return useQuery({
    queryKey: ['email', 'analytics', 'activity', mailboxId ?? 'all'],
    queryFn: () => emailApi.analyticsActivity(mailboxId).then((r) => r.activity),
    staleTime: 20_000,
  });
}

// ─── Customer integration ────────────────────────────────────────
export function useCustomer(conversationId: string | null) {
  return useQuery({
    queryKey: ['email', 'customer', conversationId],
    queryFn: () => emailApi.getCustomer(conversationId as string),
    enabled: !!conversationId,
  });
}

export function useLinkClient(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string | null) => emailApi.linkClient(conversationId, clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email', 'customer', conversationId] });
      qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
      toast.success('Customer link updated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to link customer'),
  });
}

// ─── Outbox / scheduled actions ──────────────────────────────────
export function useOutboxActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: emailKeys.scheduled });
    qc.invalidateQueries({ queryKey: emailKeys.outbox });
    qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
  };
  const cancel = useMutation({
    mutationFn: (emailId: string) => emailApi.cancelScheduled(emailId),
    onSuccess: () => { invalidate(); toast.success('Scheduled send canceled'); },
    onError: (e: Error) => toast.error(e.message || 'Failed to cancel'),
  });
  const retry = useMutation({
    mutationFn: (emailId: string) => emailApi.retryFailed(emailId),
    onSuccess: () => { invalidate(); toast.success('Message re-sent'); },
    onError: (e: Error) => toast.error(e.message || 'Retry failed'),
  });
  return { cancel, retry };
}
