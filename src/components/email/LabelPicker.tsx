import { Check, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLabels, useConversationLabels } from '@/lib/email/hooks';

interface Props {
  conversationId: string;
  appliedLabelIds: string[];
}

export function LabelPicker({ conversationId, appliedLabelIds }: Props) {
  const { data: labels = [] } = useLabels();
  const { add, remove } = useConversationLabels(conversationId);
  const applied = new Set(appliedLabelIds);

  const toggle = (labelId: string) => {
    if (applied.has(labelId)) remove.mutate(labelId);
    else add.mutate(labelId);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Labels">
          <Tag className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Apply labels</p>
        {labels.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No labels defined yet.</p>
        ) : (
          labels.map((l) => (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="flex-1 truncate text-left">{l.name}</span>
              {applied.has(l.id) && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
