import { Star, Paperclip, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { initials, avatarColor, listTime, displayName } from '@/lib/email/format';
import type { ConversationSummary } from '@/lib/email/types';

function counterparty(convo: ConversationSummary): { name: string | null; email: string } {
  const mailboxEmail = convo.mailbox?.email?.toLowerCase();
  const from = convo.participants.find((p) => p.role === 'FROM' && p.email.toLowerCase() !== mailboxEmail);
  if (from) return { name: from.name, email: from.email };
  const to = convo.participants.find((p) => p.role === 'TO' && p.email.toLowerCase() !== mailboxEmail);
  if (to) return { name: to.name, email: to.email };
  const any = convo.participants.find((p) => p.email.toLowerCase() !== mailboxEmail) ?? convo.participants[0];
  return any ? { name: any.name, email: any.email } : { name: null, email: '' };
}

interface Props {
  conversation: ConversationSummary;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onToggleStar: () => void;
}

export function ConversationRow({ conversation: c, selected, checked, onSelect, onToggleCheck, onToggleStar }: Props) {
  const party = counterparty(c);
  const unread = c.unreadCount > 0;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex cursor-pointer gap-3 border-b border-border/60 px-3 py-2.5 transition-colors',
        selected ? 'bg-primary/5' : 'hover:bg-accent/50',
        unread && !selected && 'bg-background'
      )}
    >
      {/* unread accent bar */}
      {unread && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}

      <div className="flex items-start pt-0.5" onClick={(e) => e.stopPropagation()}>
        <div className={cn('transition-opacity', checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
          <Checkbox checked={checked} onCheckedChange={onToggleCheck} className="mt-0.5" />
        </div>
      </div>

      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', avatarColor(party.email || party.name || '?'))}>
        {initials(party.name, party.email)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-sm', unread ? 'font-semibold text-foreground' : 'text-foreground/80')}>
            {displayName(party.name, party.email)}
          </span>
          {c.messageCount > 1 && (
            <span className="text-xs text-muted-foreground">{c.messageCount}</span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{listTime(c.lastMessageAt)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={cn('truncate text-[13px]', unread ? 'font-medium text-foreground' : 'text-foreground/70')}>
            {c.subject || '(no subject)'}
          </span>
          {c.hasAttachment && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>

        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">{c.snippet || ' '}</span>
        </div>

        {(c.labels.length > 0 || c.mailbox) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              style={{ backgroundColor: (c.mailbox?.color || '#6366f1') + '22' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.mailbox?.color || '#6366f1' }} />
              {c.mailbox?.displayName}
            </span>
            {c.labels.map((l) => (
              <span
                key={l.labelId}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: l.label.color + '22', color: l.label.color }}
              >
                {l.label.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
        title={c.isStarred ? 'Unstar' : 'Star'}
      >
        <Star className={cn('h-4 w-4', c.isStarred ? 'fill-amber-400 text-amber-400 opacity-100' : 'text-muted-foreground')} />
      </button>
      {c.isStarred && (
        <Star className="absolute right-2 top-2 h-4 w-4 fill-amber-400 text-amber-400 group-hover:opacity-0" />
      )}
    </div>
  );
}
