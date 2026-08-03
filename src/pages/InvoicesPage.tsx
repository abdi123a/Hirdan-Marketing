import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileDown, MoreHorizontal, Edit, Trash2, Search, Eye, CreditCard, Clock, AlertCircle } from "lucide-react";
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
import { deriveSubtotalFromTotal, parseAmountNumber, sumItems } from "@/lib/money";
import { downloadInvoicePdf } from "@/lib/document-pdf";

const statusColor = (s: string) =>
  s === "Paid" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" :
    s === "Pending" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" :
      "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400";


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
    const getInvoiceTotal = (i: Invoice) => {
      let subtotal = 0;
      if (i.items?.length) {
        subtotal = sumItems(i.items);
      } else {
        return parseAmountNumber(i.amount);
      }
      const rate = i.taxRate ?? settings.taxRate ?? 0;
      const tax = (subtotal * rate) / 100;
      const discountAmount = i.discountType === 'percentage'
        ? (subtotal * (i.discount || 0) / 100)
        : (i.discount || 0);
      return subtotal + tax - discountAmount;
    };

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
                      (() => {
                        let subtotal = 0;
                        if (inv.items?.length) {
                          subtotal = sumItems(inv.items);
                        } else {
                          return parseAmountNumber(inv.amount) - (inv.deposit || 0);
                        }
                        const rate = inv.taxRate ?? settings.taxRate ?? 0;
                        const tax = (subtotal * rate) / 100;
                        const discountAmt = inv.discountType === 'percentage'
                          ? (subtotal * (inv.discount || 0) / 100)
                          : (inv.discount || 0);
                        const total = subtotal + tax - discountAmt;
                        return total - (inv.deposit || 0);
                      })()
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
