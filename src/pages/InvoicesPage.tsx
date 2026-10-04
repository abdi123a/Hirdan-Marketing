import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileDown, MoreHorizontal, Edit, Trash2, Search, Eye, CreditCard, Clock, AlertCircle, Mail } from "lucide-react";
import { useAgencyStore, Invoice, type AgencySettings } from "@/lib/store";
import { useState, useMemo, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { computeDocTotals } from "@/lib/money";
import { downloadInvoicePdf } from "@/lib/document-pdf";
import { apiFetch } from "@/lib/api-client";
import { Checkbox } from "@/components/ui/checkbox";

const statusColor = (s: string) =>
  s === "Paid" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" :
    s === "Pending" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" :
      "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400";


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
function PendingRemindersCard() {
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

  if (items.length === 0) return null;

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
    } catch (error: any) {
      toast({ title: "Failed", description: error?.message, variant: "destructive" });
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
                      v ? next.add(key(r)) : next.delete(key(r));
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
                  <Badge className={r.kind === "overdue" ? statusColor("Overdue") : statusColor("Pending")}>
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

export default function InvoicesPage() {
  const { invoices, deleteInvoice, settings, clients, fetchInvoices, fetchClients } = useAgencyStore();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvoices();
    fetchClients();
  }, [fetchInvoices, fetchClients]);
  const [isDownloading, setIsDownloading] = useState(false);

  const filtered = invoices.filter((inv) =>
    inv.id.toLowerCase().includes(search.toLowerCase()) ||
    inv.client.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const getInvoiceTotal = (i: Invoice) =>
      computeDocTotals({
        items: i.items,
        amount: i.amount,
        taxRate: i.taxRate ?? settings.taxRate ?? 0,
        discount: i.discount,
        discountType: i.discountType,
      }).total;

    const totalPaidVal = invoices.reduce((sum, i) => {
      const total = getInvoiceTotal(i);
      if (i.status === 'Paid') return sum + total;
      if (i.status === 'Partially Paid') return sum + (i.deposit || 0);
      return sum;
    }, 0);

    const totalPendingVal = invoices
      .filter(i => i.status === 'Pending' || (i.status === 'Partially Paid' && !(new Date(i.dueDate) < new Date())))
      .reduce((sum, i) => {
        const total = getInvoiceTotal(i);
        const paid = i.status === 'Partially Paid' ? (i.deposit || 0) : 0;
        return sum + (total - paid);
      }, 0);

    const totalOverdueVal = invoices
      .filter(i => i.status === 'Overdue' || (i.status === 'Partially Paid' && new Date(i.dueDate) < new Date()))
      .reduce((sum, i) => {
        const total = getInvoiceTotal(i);
        const paid = i.status === 'Partially Paid' ? (i.deposit || 0) : 0;
        return sum + (total - paid);
      }, 0);

    return [
      { label: "Paid", value: formatCurrency(totalPaidVal), count: invoices.filter(i => i.status === 'Paid' || i.status === 'Partially Paid').length, color: "text-emerald-600" },
      { label: "Pending", value: formatCurrency(totalPendingVal), count: invoices.filter(i => i.status === 'Pending').length, color: "text-amber-600" },
      { label: "Overdue", value: formatCurrency(totalOverdueVal), count: invoices.filter(i => i.status === 'Overdue').length, color: "text-red-600" },
    ];
  }, [invoices, settings.taxRate]);

  const handleDelete = async (id: string) => {
    await deleteInvoice(id);
    toast({ title: "Invoice Deleted", description: `${id} has been removed.` });
  };

  const handleDownload = async (inv: Invoice) => {
    setIsDownloading(true);
    toast({ title: "Processing PDF", description: "Generating your invoice..." });
    try {
      const id = inv._dbId || inv.id;
      await downloadInvoicePdf(id, `${inv.id}.pdf`);
      toast({ title: "PDF Downloaded", description: `${inv.id}.pdf has been saved.` });
    } catch (error: any) {
      console.error("PDF generation failed:", error);
      toast({
        title: "Download Failed",
        description: error?.message || "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage your billing and payments</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/invoices/add")}>
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      <PendingRemindersCard />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.count} invoices</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold">All Invoices ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-9 w-full bg-muted border-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Due Date</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No invoices found. <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/invoices/add")}>Create your first invoice</button>
                  </TableCell>
                </TableRow>
              ) : filtered.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/dashboard/invoices/view/${inv.id}`)}
                >
                  <TableCell>
                    <p className="font-semibold text-primary">{inv.id}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-foreground">{inv.client}</p>
                    <p className="text-xs text-muted-foreground">{inv.clientEmail || '—'}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{inv.dueDate}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {formatCurrency(
                      computeDocTotals({
                        items: inv.items,
                        amount: inv.amount,
                        taxRate: inv.taxRate ?? settings.taxRate ?? 0,
                        discount: inv.discount,
                        discountType: inv.discountType,
                        deposit: inv.deposit,
                      }).balanceDue
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(inv.status)}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/invoices/view/${inv.id}`); }}>
                          <Eye className="h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/invoices/edit/${inv.id}`); }}>
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDownload(inv); }}>
                          <FileDown className="h-4 w-4" /> Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
