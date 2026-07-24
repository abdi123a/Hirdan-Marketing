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
};

export function useMailboxes() {
  return useQuery({
    queryKey: emailKeys.mailboxes,
    queryFn: () => emailApi.listMailboxes().then((r) => r.mailboxes),
    staleTime: 60_000,
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
