import { useState } from 'react';
import { Plus, Trash2, Loader2, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLabels, useLabelMutations } from '@/lib/email/hooks';

const PRESET = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

export function LabelManagerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: labels = [], isLoading } = useLabels();
  const { create, update, remove } = useLabelMutations();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET[4]);

  const add = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), color });
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Labels</DialogTitle>
        </DialogHeader>

        {/* Existing labels */}
        <div className="space-y-1.5">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : labels.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">No labels yet.</p>
          ) : (
            labels.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
                <input
                  type="color"
                  value={l.color}
                  onChange={(e) => update.mutate({ id: l.id, data: { color: e.target.value } })}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Change color"
                />
                <Input
                  defaultValue={l.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && update.mutate({ id: l.id, data: { name: e.target.value.trim() } })}
                  className="h-8 flex-1 border-0 px-1 text-sm shadow-none focus-visible:ring-0"
                />
                {typeof l.count === 'number' && l.count > 0 && (
                  <span className="text-[11px] text-muted-foreground">{l.count}</span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => remove.mutate(l.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add new */}
        <div className="flex items-center gap-2 border-t pt-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border bg-background" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New label name"
            className="h-9 flex-1"
          />
          <Button onClick={add} disabled={!name.trim() || create.isPending} size="icon" className="h-9 w-9">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESET.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-full ring-offset-2" style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none' }} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
