import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function EmailChipsInput({ value, onChange, placeholder, className }: Props) {
  const [input, setInput] = useState('');

  const commit = (raw: string) => {
    const parts = raw.split(/[,;\s]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    const valid = parts.filter((p) => EMAIL_RE.test(p) && !value.includes(p));
    if (valid.length) onChange([...value, ...valid]);
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ';', ' ', 'Tab'].includes(e.key)) {
      if (input.trim()) {
        e.preventDefault();
        commit(input);
      }
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1', className)}>
      {value.map((email) => (
        <span key={email} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
          {email}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== email))}>
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => input.trim() && commit(input)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
    </div>
  );
}
