import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Search, Loader2, MailOpen, Star, Archive, ShieldAlert, Trash2, X, Inbox as InboxIcon,
  SlidersHorizontal, Paperclip, Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { emailApi } from '@/lib/email/api';
import { useConversationActions, useDrafts, useScheduled, useOutbox, useLabels, useOutboxActions } from '@/lib/email/hooks';
import { ConversationRow } from './ConversationRow';
import { StatusBadge } from './StatusBadge';
import { listTime, displayName } from '@/lib/email/format';
import type { Draft, EmailFolder, EmailMessage, SearchFilters } from '@/lib/email/types';

const CONVERSATION_FOLDERS: EmailFolder[] = ['inbox', 'sent', 'spam', 'trash', 'starred', 'archived'];

interface Props {
  folder: EmailFolder;
  mailboxId?: string;
  labelId?: string;
  onClearLabel?: () => void;
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenDraft: (draft: Draft) => void;
}

export function ConversationList({ folder, mailboxId, labelId, onClearLabel, selectedId, onSelectConversation, onOpenDraft }: Props) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const { bulk } = useConversationActions();
  const { data: labels = [] } = useLabels();
  const activeLabel = labels.find((l) => l.id === labelId);
  const filtersKey = JSON.stringify(filters);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // reset selection when switching folder/mailbox/filters
  useEffect(() => setChecked(new Set()), [folder, mailboxId, search, labelId, filtersKey]);

  const isConvMode = CONVERSATION_FOLDERS.includes(folder);

  const infinite = useInfiniteQuery({
    queryKey: ['email', 'conversations', 'infinite', folder, mailboxId ?? 'all', search, labelId ?? '', filtersKey],
    enabled: isConvMode,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      emailApi.listConversations({ folder, mailboxId, q: search, labelId, filters, limit: 30, offset: pageParam as number }),
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((n, p) => n + p.conversations.length, 0) : undefined,
  });

  const conversations = useMemo(
    () => infinite.data?.pages.flatMap((p) => p.conversations) ?? [],
    [infinite.data]
  );

  // infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isConvMode) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && infinite.hasNextPage && !infinite.isFetchingNextPage) {
        infinite.fetchNextPage();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [isConvMode, infinite.hasNextPage, infinite.isFetchingNextPage, infinite.fetchNextPage]);

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allChecked = conversations.length > 0 && conversations.every((c) => checked.has(c.id));
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(conversations.map((c) => c.id)));

  const runBulk = async (action: string) => {
    await bulk.mutateAsync({ ids: [...checked], action });
    setChecked(new Set());
    infinite.refetch();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search / bulk header */}
      <div className="border-b p-2">
        {checked.size > 0 ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChecked(new Set())}>
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{checked.size} selected</span>
            <div className="ml-auto flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark read" onClick={() => runBulk('read')}>
                <MailOpen className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Star" onClick={() => runBulk('star')}>
                <Star className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Archive" onClick={() => runBulk('archive')}>
                <Archive className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Spam" onClick={() => runBulk('spam')}>
                <ShieldAlert className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Trash" onClick={() => runBulk('trash')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isConvMode && (
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} className="ml-1" title="Select all" />
            )}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search mail"
                className="h-8 pl-8 text-sm"
              />
            </div>
            {isConvMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className={cn('relative h-8 w-8', activeFilterCount > 0 && 'text-primary')} title="Filters">
                    <SlidersHorizontal className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 space-y-1 p-2">
                  <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">Filters</p>
                  <FilterToggle label="Unread only" active={!!filters.unread} onToggle={() => setFilters((f) => ({ ...f, unread: f.unread ? undefined : true }))} icon={<MailOpen className="h-3.5 w-3.5" />} />
                  <FilterToggle label="Has attachment" active={!!filters.hasAttachment} onToggle={() => setFilters((f) => ({ ...f, hasAttachment: f.hasAttachment ? undefined : true }))} icon={<Paperclip className="h-3.5 w-3.5" />} />
                  <FilterToggle label="Received" active={filters.direction === 'INBOUND'} onToggle={() => setFilters((f) => ({ ...f, direction: f.direction === 'INBOUND' ? undefined : 'INBOUND' }))} />
                  <FilterToggle label="Sent by us" active={filters.direction === 'OUTBOUND'} onToggle={() => setFilters((f) => ({ ...f, direction: f.direction === 'OUTBOUND' ? undefined : 'OUTBOUND' }))} />
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="mt-1 h-7 w-full text-xs" onClick={() => setFilters({})}>
                      Clear filters
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* Active label chip */}
        {activeLabel && (
          <div className="mt-2 flex items-center gap-1">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: activeLabel.color + '22', color: activeLabel.color }}
            >
              <Tag className="h-3 w-3" /> {activeLabel.name}
              <button onClick={() => onClearLabel?.()} title="Clear label filter"><X className="h-3 w-3" /></button>
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        {isConvMode ? (
          <ConversationBody
            loading={infinite.isLoading}
            conversations={conversations}
            selectedId={selectedId}
            checked={checked}
            onSelect={onSelectConversation}
            onToggleCheck={toggleCheck}
            onToggleStar={async (id, next) => {
              await emailApi.patchConversation(id, { isStarred: next });
              infinite.refetch();
            }}
            sentinelRef={sentinelRef}
            fetchingMore={infinite.isFetchingNextPage}
            hasMore={!!infinite.hasNextPage}
          />
        ) : folder === 'drafts' ? (
          <DraftBody onOpenDraft={onOpenDraft} />
        ) : folder === 'scheduled' ? (
          <EmailFolderBody kind="scheduled" onSelectConversation={onSelectConversation} />
        ) : (
          <EmailFolderBody kind="outbox" onSelectConversation={onSelectConversation} />
        )}
      </ScrollArea>
    </div>
  );
}

function FilterToggle({ label, active, onToggle, icon }: { label: string; active: boolean; onToggle: () => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'
      )}
    >
      {icon ?? <span className="h-3.5 w-3.5" />}
      <span className="flex-1 text-left">{label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
      <InboxIcon className="h-8 w-8 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function ConversationBody({
  loading, conversations, selectedId, checked, onSelect, onToggleCheck, onToggleStar, sentinelRef, fetchingMore, hasMore,
}: {
  loading: boolean;
  conversations: import('@/lib/email/types').ConversationSummary[];
  selectedId: string | null;
  checked: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
  sentinelRef: React.RefObject<HTMLDivElement>;
  fetchingMore: boolean;
  hasMore: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!conversations.length) return <EmptyState label="Nothing here" />;

  return (
    <div>
      {conversations.map((c) => (
        <ConversationRow
          key={c.id}
          conversation={c}
          selected={selectedId === c.id}
          checked={checked.has(c.id)}
          onSelect={() => onSelect(c.id)}
          onToggleCheck={() => onToggleCheck(c.id)}
          onToggleStar={() => onToggleStar(c.id, !c.isStarred)}
        />
      ))}
      <div ref={sentinelRef} className="h-8" />
      {fetchingMore && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {!hasMore && conversations.length > 8 && (
        <p className="py-3 text-center text-xs text-muted-foreground">End of list</p>
      )}
    </div>
  );
}

function DraftBody({ onOpenDraft }: { onOpenDraft: (d: Draft) => void }) {
  const { data, isLoading } = useDrafts(true);
  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data?.length) return <EmptyState label="No drafts" />;
  return (
    <div>
      {data.map((d) => (
        <button
          key={d.id}
          onClick={() => onOpenDraft(d)}
          className="flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left hover:bg-accent/50"
        >
          <div className="flex w-full items-center gap-2">
            <span className="text-sm font-medium text-red-500">Draft</span>
            <span className="truncate text-sm">{d.subject || '(no subject)'}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{listTime(d.updatedAt)}</span>
          </div>
          <span className="truncate text-xs text-muted-foreground">
            To: {(d.toEmails ?? []).join(', ') || '—'}
          </span>
        </button>
      ))}
    </div>
  );
}

function EmailFolderBody({ kind, onSelectConversation }: { kind: 'scheduled' | 'outbox'; onSelectConversation: (id: string) => void }) {
  const scheduled = useScheduled(kind === 'scheduled');
  const outbox = useOutbox(kind === 'outbox');
  const query = kind === 'scheduled' ? scheduled : outbox;
  const emails: EmailMessage[] = query.data ?? [];
  const { cancel, retry } = useOutboxActions();

  if (query.isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!emails.length) return <EmptyState label={kind === 'scheduled' ? 'No scheduled emails' : 'Outbox is empty'} />;

  return (
    <div>
      {emails.map((e) => (
        <div key={e.id} className="group flex items-start gap-2 border-b px-4 py-3 hover:bg-accent/50">
          <button
            onClick={() => e.conversation && onSelectConversation(e.conversation.id)}
            className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
          >
            <div className="flex w-full items-center gap-2">
              <span className="truncate text-sm font-medium">{displayName(null, (e.toEmails ?? [])[0])}</span>
              <StatusBadge status={e.status} className="ml-auto" />
            </div>
            <span className="truncate text-[13px]">{e.subject || '(no subject)'}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {kind === 'scheduled'
                ? `Scheduled for ${listTime(e.scheduledAt)}`
                : e.errorMessage || 'Sending…'}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
            {kind === 'scheduled' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => cancel.mutate(e.id)} disabled={cancel.isPending}>
                Cancel
              </Button>
            )}
            {kind === 'outbox' && e.status === 'FAILED' && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => retry.mutate(e.id)} disabled={retry.isPending}>
                {retry.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Retry'}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
