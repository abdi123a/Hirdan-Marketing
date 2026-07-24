import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useMailboxMutations } from '@/lib/email/hooks';
import type { Mailbox } from '@/lib/email/types';

interface Props {
  open: boolean;
  onClose: () => void;
  mailbox?: Mailbox | null;
}

const EMPTY = {
  email: '',
  displayName: '',
  department: '',
  replyTo: '',
  color: '#6366f1',
  avatarUrl: '',
  signature: '',
  isActive: true,
  isDefault: false,
};

export function MailboxFormDialog({ open, onClose, mailbox }: Props) {
  const editing = !!mailbox;
  const { create, update } = useMailboxMutations();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      mailbox
        ? {
            email: mailbox.email,
            displayName: mailbox.displayName,
            department: mailbox.department ?? '',
            replyTo: mailbox.replyTo ?? '',
            color: mailbox.color ?? '#6366f1',
            avatarUrl: mailbox.avatarUrl ?? '',
            signature: mailbox.signature ?? '',
            isActive: mailbox.isActive,
            isDefault: mailbox.isDefault,
          }
        : EMPTY
    );
  }, [open, mailbox]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const payload = {
      email: form.email.trim(),
      displayName: form.displayName.trim(),
      department: form.department.trim() || null,
      replyTo: form.replyTo.trim() || null,
      color: form.color || null,
      avatarUrl: form.avatarUrl.trim() || null,
      signature: form.signature || null,
      isActive: form.isActive,
      isDefault: form.isDefault,
    };
    if (editing) {
      await update.mutateAsync({ id: mailbox!.id, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  const busy = create.isPending || update.isPending;
  const valid = form.email.includes('@') && form.displayName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit mailbox' : 'New mailbox'}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-0.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Display name *</Label>
              <Input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Support" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Support" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email address *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="support@company.com"
            />
            <p className="text-xs text-muted-foreground">
              The From/To address. Must be on a domain verified in Resend to send &amp; receive.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reply-To</Label>
              <Input value={form.replyTo} onChange={(e) => set('replyTo', e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border bg-background"
                />
                <Input value={form.color} onChange={(e) => set('color', e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Avatar URL</Label>
            <Input value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} placeholder="Optional image URL" />
          </div>

          <div className="space-y-1.5">
            <Label>Signature (HTML allowed)</Label>
            <Textarea
              value={form.signature}
              onChange={(e) => set('signature', e.target.value)}
              placeholder="<p>Best regards,<br/>The Support Team</p>"
              rows={4}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive mailboxes cannot send.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Default mailbox</p>
              <p className="text-xs text-muted-foreground">Pre-selected in the composer.</p>
            </div>
            <Switch checked={form.isDefault} onCheckedChange={(v) => set('isDefault', v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save changes' : 'Create mailbox'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
