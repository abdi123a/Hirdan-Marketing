import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Archive, ShieldAlert, Trash2, ArrowLeft, Forward, MoreVertical,
  ExternalLink, RotateCcw, Loader2, Mail, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConversation, useConversationActions, useConversationLabels } from '@/lib/email/hooks';
import { MessageItem } from './MessageItem';
import { ReplyBox } from './ReplyBox';
import { LabelPicker } from './LabelPicker';
import { NotesPanel } from './NotesPanel';
import { CustomerPanel } from './CustomerPanel';
import type { ConversationStatus, EmailMessage } from '@/lib/email/types';

const STATUS_LABELS: Record<ConversationStatus, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  WAITING_CUSTOMER: 'Waiting on customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

interface Props {
  conversationId: string;
  onBack?: () => void;
  onForward?: (email: EmailMessage) => void;
}

export function ConversationView({ conversationId, onBack, onForward }: Props) {
  const { data: conversation, isLoading, refetch } = useConversation(conversationId);
  const { markRead, patch, action } = useConversationActions();
  const [customerOpen, setCustomerOpen] = useState(false);

  // Auto mark-as-read when a thread with unread messages is opened.
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markRead.mutate(conversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Mail className="h-10 w-10 opacity-30" />
        <p className="text-sm">Select a conversation to read</p>
      </div>
    );
  }

  const lastEmail = conversation.emails[conversation.emails.length - 1];
  const inTrash = !!conversation.deletedAt;

  return (
    <div className="flex h-full min-w-0 flex-col bg-muted/20">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} title="Back to conversation list">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{conversation.subject || '(no subject)'}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="inline-flex items-center gap-1"
              style={{ color: conversation.mailbox.color || undefined }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: conversation.mailbox.color || '#6366f1' }} />
              {conversation.mailbox.displayName}
            </span>
            {conversation.client && (
              <>
                <span>·</span>
                <Link
                  to={`/dashboard/clients/view/${conversation.client.id}`}
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  {conversation.client.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            )}
            {conversation.labels.map((l) => (
              <span
                key={l.labelId}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: l.label.color + '22', color: l.label.color }}
              >
                {l.label.name}
              </span>
            ))}
          </div>
        </div>

        <Select
          value={conversation.status}
          onValueChange={(v) => patch.mutate({ id: conversation.id, data: { status: v } })}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as ConversationStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          title={conversation.isStarred ? 'Unstar' : 'Star'}
          onClick={() => patch.mutate({ id: conversation.id, data: { isStarred: !conversation.isStarred } })}
        >
          <Star className={cn('h-4 w-4', conversation.isStarred && 'fill-amber-400 text-amber-400')} />
        </Button>

        <LabelPicker
          conversationId={conversation.id}
          appliedLabelIds={conversation.labels.map((l) => l.labelId)}
        />

        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          title="Customer details"
          onClick={() => setCustomerOpen(true)}
        >
          <User className="h-4 w-4" />
        </Button>

        {lastEmail && onForward && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Forward" onClick={() => onForward(lastEmail)}>
            <Forward className="h-4 w-4" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {inTrash ? (
              <DropdownMenuItem onClick={() => action.mutate({ id: conversation.id, action: 'restore' })}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restore
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => action.mutate({ id: conversation.id, action: conversation.isArchived ? 'unarchive' : 'archive' })}>
                  <Archive className="mr-2 h-4 w-4" /> {conversation.isArchived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => action.mutate({ id: conversation.id, action: conversation.isSpam ? 'not-spam' : 'spam' })}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> {conversation.isSpam ? 'Not spam' : 'Mark as spam'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => { action.mutate({ id: conversation.id, action: 'trash' }); onBack?.(); }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Thread */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="space-y-3 p-4">
          {conversation.emails.map((email, i) => (
            <MessageItem key={email.id} email={email} defaultOpen={i === conversation.emails.length - 1} />
          ))}

          <NotesPanel conversationId={conversation.id} notes={conversation.notes} />

          {!inTrash && (
            <ReplyBox
              conversationId={conversation.id}
              signature={conversation.mailbox.signature}
              onSent={() => refetch()}
            />
          )}
        </div>
      </div>

      <CustomerPanel conversationId={conversation.id} open={customerOpen} onClose={() => setCustomerOpen(false)} />
    </div>
  );
}
