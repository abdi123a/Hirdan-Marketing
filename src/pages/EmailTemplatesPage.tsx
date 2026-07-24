import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowLeft, FileText, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTemplates, useTemplateMutations } from '@/lib/email/hooks';
import { applyTemplateVars } from '@/lib/email/templateVars';
import type { EmailTemplate, TemplateCategory } from '@/lib/email/types';

const CATEGORIES: TemplateCategory[] = ['SUPPORT', 'SALES', 'INVOICES', 'MARKETING', 'HR', 'LEGAL', 'SAVED_REPLY'];
const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  SUPPORT: 'Support', SALES: 'Sales', INVOICES: 'Invoices', MARKETING: 'Marketing',
  HR: 'HR', LEGAL: 'Legal', SAVED_REPLY: 'Saved reply',
};
const VARIABLES = ['{{customer}}', '{{company}}', '{{invoice}}', '{{employee}}', '{{today}}'];
const PREVIEW_CTX = { customer: 'Jane Doe', company: 'Acme Inc', invoice: 'INV-1024', employee: 'Ahmed' };

export default function EmailTemplatesPage() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useTemplates();
  const { remove } = useTemplateMutations();

  const [filter, setFilter] = useState<TemplateCategory | 'ALL'>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);

  const shown = useMemo(
    () => (filter === 'ALL' ? templates : templates.filter((t) => t.category === filter)),
    [templates, filter]
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/email')} title="Back to Email Center">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Email templates</h1>
          <p className="text-sm text-muted-foreground">Reusable replies with {'{{variables}}'} you can insert while composing.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button variant={filter === 'ALL' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('ALL')}>All</Button>
        {CATEGORIES.map((c) => (
          <Button key={c} variant={filter === c ? 'default' : 'outline'} size="sm" onClick={() => setFilter(c)}>
            {CATEGORY_LABEL[c]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">No templates here yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((t) => (
            <div key={t.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.subject || '(no subject)'}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{CATEGORY_LABEL[t.category]}</Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {t.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)}
              </p>
              {t.variables && t.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.variables.map((v) => (
                    <span key={v} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{`{{${v}}}`}</span>
                  ))}
                </div>
              )}
              <div className="mt-1 flex items-center gap-1 border-t pt-2">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditing(t); setFormOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-xs text-red-600 hover:text-red-600" onClick={() => setDeleting(t)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateFormDialog open={formOpen} onClose={() => setFormOpen(false)} template={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This template will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateFormDialog({ open, onClose, template }: { open: boolean; onClose: () => void; template: EmailTemplate | null }) {
  const editing = !!template;
  const { create, update } = useTemplateMutations();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('SUPPORT');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setCategory(template?.category ?? 'SUPPORT');
    setSubject(template?.subject ?? '');
    setBody(template?.body ?? '');
    setShowPreview(false);
  }, [open, template]);

  const submit = async () => {
    const data = { name: name.trim(), category, subject, body };
    if (editing) await update.mutateAsync({ id: template!.id, data });
    else await create.mutateAsync(data);
    onClose();
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[64vh] space-y-4 overflow-y-auto px-0.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quote follow-up" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Following up on {{invoice}}" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Body (HTML allowed)</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowPreview((v) => !v)}>
                <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {showPreview ? (
              <div
                className="prose prose-sm max-h-64 min-h-[160px] max-w-none overflow-auto rounded-md border bg-muted/30 p-3 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: applyTemplateVars(body, PREVIEW_CTX) }}
              />
            ) : (
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} placeholder="Hi {{customer}},&#10;&#10;Thanks for reaching out…" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setBody((b) => `${b}${v}`)}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim()} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save changes' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
