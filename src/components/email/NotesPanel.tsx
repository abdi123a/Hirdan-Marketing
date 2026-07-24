import { useMemo, useRef, useState } from 'react';
import { StickyNote, Send, Trash2, Loader2, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { initials, avatarColor, relativeTime } from '@/lib/email/format';
import { useMentionableUsers, useNoteMutations } from '@/lib/email/hooks';
import type { ConversationNote, DirectoryUser } from '@/lib/email/types';

/** Render a note body, emphasising @mentions. */
function renderBody(body: string) {
  const parts = body.split(/(@[\w][\w .'-]*)/g);
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} className="font-medium text-primary">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function NotesPanel({ conversationId, notes }: { conversationId: string; notes: ConversationNote[] }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<Record<string, string>>({}); // name → userId
  const [query, setQuery] = useState<string | null>(null);
  const { data: users = [] } = useMentionableUsers(true);
  const { add, remove } = useNoteMutations(conversationId);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, users]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const caret = e.target.selectionStart ?? val.length;
    const before = val.slice(0, caret);
    const m = before.match(/@(\w*)$/);
    setQuery(m ? m[1] : null);
  };

  const pickMention = (u: DirectoryUser) => {
    const el = taRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@(\w*)$/, `@${u.name} `);
    const after = text.slice(caret);
    const next = before + after;
    setText(next);
    setMentions((prev) => ({ ...prev, [u.name]: u.id }));
    setQuery(null);
    setTimeout(() => el?.focus(), 0);
  };

  const submit = async () => {
    if (!text.trim()) return;
    // Only keep ids for names still present in the text.
    const ids = Object.entries(mentions)
      .filter(([name]) => text.includes(`@${name}`))
      .map(([, id]) => id);
    await add.mutateAsync({ body: text.trim(), mentions: ids });
    setText('');
    setMentions({});
    setQuery(null);
  };

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 border-b border-amber-200/60 px-3 py-2 dark:border-amber-900/40">
        <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Internal notes</span>
        <span className="text-xs text-amber-700/70 dark:text-amber-500/70">— private, never sent to the customer</span>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2 px-3 py-2">
          {notes.map((n) => (
            <div key={n.id} className="group flex gap-2">
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(n.author.name)}`}>
                {initials(n.author.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{n.author.name}</span>
                  <span className="text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                  <button
                    onClick={() => remove.mutate(n.id)}
                    className="ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                    title="Delete note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{renderBody(n.body)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="relative px-3 pb-3 pt-1">
        <textarea
          ref={taRef}
          value={text}
          onChange={onChange}
          rows={2}
          placeholder="Add a private note… use @ to mention a teammate"
          className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        />

        {query !== null && suggestions.length > 0 && (
          <div className="absolute bottom-14 left-3 z-10 w-56 overflow-hidden rounded-lg border bg-popover shadow-md">
            {suggestions.map((u) => (
              <button
                key={u.id}
                onClick={() => pickMention(u)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              >
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{u.name}</span>
                <span className="text-[10px] text-muted-foreground">{u.role}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex justify-end">
          <Button size="sm" className="h-8 gap-1.5" onClick={submit} disabled={!text.trim() || add.isPending}>
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
