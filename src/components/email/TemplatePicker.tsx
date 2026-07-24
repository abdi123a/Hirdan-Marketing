import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { useTemplates } from '@/lib/email/hooks';
import type { EmailTemplate, TemplateCategory } from '@/lib/email/types';

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  SUPPORT: 'Support',
  SALES: 'Sales',
  INVOICES: 'Invoices',
  MARKETING: 'Marketing',
  HR: 'HR',
  LEGAL: 'Legal',
  SAVED_REPLY: 'Saved replies',
};

interface Props {
  onSelect: (t: EmailTemplate) => void;
  compact?: boolean;
  className?: string;
}

export function TemplatePicker({ onSelect, compact, className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading } = useTemplates();

  const byCategory = templates.reduce<Record<string, EmailTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className={cn('h-8 w-8', className)} title="Insert template">
            <FileText className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
            <FileText className="h-4 w-4" /> Templates
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search templates…" />
          <CommandList>
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <CommandEmpty>No templates found.</CommandEmpty>
                {Object.entries(byCategory).map(([cat, items]) => (
                  <CommandGroup key={cat} heading={CATEGORY_LABEL[cat as TemplateCategory] ?? cat}>
                    {items.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.name} ${t.subject}`}
                        onSelect={() => { onSelect(t); setOpen(false); }}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="text-sm font-medium">{t.name}</span>
                        {t.subject && <span className="truncate text-xs text-muted-foreground">{t.subject}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
