import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Users, ArrowLeft, Mail, Star, Loader2, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/auth-store';
import { useMailboxes, useMailboxMutations } from '@/lib/email/hooks';
import { MailboxFormDialog } from '@/components/email/MailboxFormDialog';
import { MailboxPermissionsDialog } from '@/components/email/MailboxPermissionsDialog';
import type { Mailbox } from '@/lib/email/types';

export default function EmailMailboxesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { data: mailboxes = [], isLoading } = useMailboxes();
  const { remove } = useMailboxMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Mailbox | null>(null);
  const [permsFor, setPermsFor] = useState<Mailbox | null>(null);
  const [deleting, setDeleting] = useState<Mailbox | null>(null);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (m: Mailbox) => { setEditing(m); setFormOpen(true); };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/email')} title="Back to Email Center">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Mailboxes</h1>
          <p className="text-sm text-muted-foreground">Company mailboxes and who can access them.</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> New mailbox
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          Only administrators can create mailboxes or change access. You can edit mailboxes you manage.
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : mailboxes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-muted-foreground">
          <Mail className="h-10 w-10 opacity-30" />
          <p className="text-sm">No mailboxes yet.</p>
          {isAdmin && <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Create the first mailbox</Button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {mailboxes.map((m) => {
            const canEdit = isAdmin || m.accessLevel === 'MANAGE';
            return (
              <div key={m.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: m.color || '#6366f1' }}
                  >
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{m.displayName}</p>
                      {m.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {m.department && <Badge variant="secondary" className="text-[10px]">{m.department}</Badge>}
                      {!m.isActive && <Badge variant="outline" className="text-[10px] text-orange-500">Inactive</Badge>}
                      {(m.unreadCount ?? 0) > 0 && (
                        <Badge className="text-[10px]">{m.unreadCount} unread</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 border-t pt-2">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(m)} disabled={!canEdit}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPermsFor(m)}>
                        <Users className="h-3.5 w-3.5" /> Access
                      </Button>
                      <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-xs text-red-600 hover:text-red-600" onClick={() => setDeleting(m)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MailboxFormDialog open={formOpen} onClose={() => setFormOpen(false)} mailbox={editing} />
      {permsFor && (
        <MailboxPermissionsDialog open={!!permsFor} onClose={() => setPermsFor(null)} mailbox={permsFor} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.displayName}” mailbox?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the mailbox and all of its conversations, messages, and tracking history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}
            >
              Delete mailbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
