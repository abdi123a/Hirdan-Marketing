import { useMemo, useState } from 'react';
import { Loader2, UserPlus, X, ShieldCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { initials, avatarColor } from '@/lib/email/format';
import { usePermissions, usePermissionMutations, useDirectoryUsers } from '@/lib/email/hooks';
import type { Mailbox } from '@/lib/email/types';

type Level = 'READ' | 'WRITE' | 'MANAGE';

const LEVEL_LABEL: Record<Level, string> = {
  READ: 'Read only',
  WRITE: 'Read & send',
  MANAGE: 'Manage',
};

interface Props {
  open: boolean;
  onClose: () => void;
  mailbox: Mailbox;
}

export function MailboxPermissionsDialog({ open, onClose, mailbox }: Props) {
  const { data: permissions = [], isLoading } = usePermissions(open ? mailbox.id : null);
  const { data: users = [] } = useDirectoryUsers(open);
  const { grant, revoke } = usePermissionMutations(mailbox.id);

  const [newUser, setNewUser] = useState('');
  const [newLevel, setNewLevel] = useState<Level>('WRITE');

  // Staff who can be granted: not clients, not admins (admins already have all), not already granted.
  const grantedIds = new Set(permissions.map((p) => p.userId));
  const grantable = useMemo(
    () => users.filter((u) => u.role !== 'CLIENT' && u.role !== 'ADMIN' && !grantedIds.has(u.id)),
    [users, permissions]
  );

  const add = async () => {
    if (!newUser) return;
    await grant.mutateAsync({ userId: newUser, accessLevel: newLevel });
    setNewUser('');
    setNewLevel('WRITE');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mailbox.color || '#6366f1' }} />
            Access · {mailbox.displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
          Admins automatically have full access to every mailbox. Grant access to specific managers or staff below.
        </div>

        {/* Current permissions */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : permissions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No staff granted yet.</p>
          ) : (
            permissions.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatarColor(p.user.email)}`}>
                  {initials(p.user.name, p.user.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.user.email} · {p.user.role}</p>
                </div>
                <Select
                  value={p.accessLevel}
                  onValueChange={(v) => grant.mutate({ userId: p.userId, accessLevel: v as Level })}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                      <SelectItem key={l} value={l} className="text-xs">{LEVEL_LABEL[l]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => revoke.mutate(p.userId)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add access */}
        <div className="flex items-center gap-2 border-t pt-3">
          <Select value={newUser} onValueChange={setNewUser}>
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue placeholder="Add a team member…" />
            </SelectTrigger>
            <SelectContent>
              {grantable.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No more staff to add</div>
              ) : (
                grantable.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-sm">
                    {u.name} <span className="text-muted-foreground">({u.role})</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={newLevel} onValueChange={(v) => setNewLevel(v as Level)}>
            <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <SelectItem key={l} value={l} className="text-sm">{LEVEL_LABEL[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={!newUser || grant.isPending} size="icon" className="h-9 w-9" title="Grant access">
            {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
