import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

const REMINDER_BADGE = "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400";
const OVERDUE_BADGE = "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400";

type PendingReminder = {
  invoiceId: string;
  invoiceNumber: string | null;
  kind: "reminder" | "overdue";
  clientName: string;
  clientEmail: string;
  amount: number; // cents
  dueDate: string;
};

// Reminder/overdue emails the daily job held back for clients that are not on
// "send automatically". Nothing goes out until the user picks Send here.
export function PendingRemindersCard() {
  const [items, setItems] = useState<PendingReminder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const key = (r: PendingReminder) => `${r.invoiceId}:${r.kind}`;

  const load = () =>
    apiFetch<{ reminders: PendingReminder[] }>("/invoices/reminders/pending")
      .then((res) => { setItems(res.reminders); setSelected(new Set()); })
      .catch(() => setItems([]));

  useEffect(() => { load(); }, []);

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Mail className="h-4 w-4 shrink-0" />
        No reminder emails waiting for approval. Reminders for clients without auto-send are held here until you approve them.
      </div>
    );
  }

  const decide = async (action: "send" | "skip") => {
    const chosen = items.filter((r) => selected.has(key(r)));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ done: number; requested: number }>("/invoices/reminders/decide", {
        method: "POST",
        body: JSON.stringify({ action, items: chosen.map(({ invoiceId, kind }) => ({ invoiceId, kind })) }),
      });
      toast({
        title: action === "send" ? `Sent ${res.done} of ${res.requested} emails` : `Skipped ${res.done} emails`,
        variant: action === "send" && res.done < res.requested ? "destructive" : undefined,
      });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
      load();
    }
  };

  const allSelected = selected.size === items.length;

  return (
    <Card className="shadow-card border-amber-300 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-600" /> Reminder emails waiting for approval ({items.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              These clients are not set to receive reminders automatically. Nothing is sent until you choose.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" disabled={busy || selected.size === 0} onClick={() => decide("skip")}>
              Don't send
            </Button>
            <Button variant="hero" disabled={busy || selected.size === 0} onClick={() => decide("send")}>
              Send selected ({selected.size})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? new Set(items.map(key)) : new Set())}
                />
              </TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={key(r)}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${r.invoiceNumber}`}
                    checked={selected.has(key(r))}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) next.add(key(r));
                      else next.delete(key(r));
                      setSelected(next);
                    }}
                  />
                </TableCell>
                <TableCell className="font-semibold text-primary">{r.invoiceNumber}</TableCell>
                <TableCell>
                  <p className="font-semibold text-foreground">{r.clientName}</p>
                  <p className="text-xs text-muted-foreground">{r.clientEmail}</p>
                </TableCell>
                <TableCell>
                  <Badge className={r.kind === "overdue" ? OVERDUE_BADGE : REMINDER_BADGE}>
                    {r.kind === "overdue" ? "Overdue notice" : "Payment reminder"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.dueDate.split("T")[0]}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(r.amount / 100)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
