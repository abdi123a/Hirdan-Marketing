import {
  Inbox, Star, Send, FileText, Clock, ArrowUpFromLine,
  ShieldAlert, Trash2, PenSquare, Mail, ChevronDown, Settings2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EmailFolder, Mailbox } from '@/lib/email/types';

const FOLDERS: { id: EmailFolder; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'scheduled', label: 'Scheduled', icon: Clock },
  { id: 'outbox', label: 'Outbox', icon: ArrowUpFromLine },
  { id: 'spam', label: 'Spam', icon: ShieldAlert },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

interface Props {
  folder: EmailFolder;
  onFolder: (f: EmailFolder) => void;
  mailboxId?: string;
  onMailbox: (id?: string) => void;
  mailboxes: Mailbox[];
  onCompose: () => void;
}

export function EmailSidebar({ folder, onFolder, mailboxId, onMailbox, mailboxes, onCompose }: Props) {
  const navigate = useNavigate();
  const totalUnread = mailboxes.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="p-3">
        <Button onClick={onCompose} className="w-full gap-2 rounded-xl shadow-sm" size="sm">
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <nav className="space-y-0.5 pb-2">
          {FOLDERS.map((f) => {
            const active = folder === f.id;
            const badge = f.id === 'inbox' ? totalUnread : 0;
            return (
              <button
                key={f.id}
                onClick={() => onFolder(f.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                )}
              >
                <f.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{f.label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-2 border-t pt-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ChevronDown className="h-3 w-3" />
            Mailboxes
            <button
              onClick={() => navigate('/dashboard/email/mailboxes')}
              className="ml-auto rounded p-1 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
              title="Manage mailboxes"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onMailbox(undefined)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                !mailboxId ? 'bg-accent font-medium' : 'text-foreground/70 hover:bg-accent'
              )}
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">All mailboxes</span>
            </button>

            {mailboxes.map((m) => {
              const active = mailboxId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onMailbox(m.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-accent font-medium' : 'text-foreground/70 hover:bg-accent'
                  )}
                  title={m.email}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: m.color || '#6366f1' }}
                  />
                  <span className="flex-1 truncate text-left">
                    {m.displayName}
                    {!m.isActive && <span className="ml-1 text-xs text-muted-foreground">(off)</span>}
                  </span>
                  {(m.unreadCount ?? 0) > 0 && (
                    <span className="text-[11px] font-semibold text-muted-foreground">{m.unreadCount}</span>
                  )}
                </button>
              );
            })}

            {mailboxes.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No mailboxes yet. An admin can add one in the Mailboxes settings.
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
