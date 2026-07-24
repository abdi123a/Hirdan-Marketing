import { cn } from '@/lib/utils';
import { statusStyle } from '@/lib/email/status';
import type { EmailStatus } from '@/lib/email/types';

export function StatusBadge({ status, className }: { status: EmailStatus; className?: string }) {
  const s = statusStyle(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
        s.badge,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}
