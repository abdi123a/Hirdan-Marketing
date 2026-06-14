import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MoreHorizontal, Edit, Trash2, Search, FileText, Eye, FileDown, CheckCircle2, Clock, Send, Loader2 } from "lucide-react";
import { useAgencyStore, Proforma } from "@/lib/store";
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
import { parseAmountNumber, sumItems } from "@/lib/money";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PremiumInvoice } from "@/components/PremiumInvoice";
import { useRef } from "react";

const statusColor = (s: string) =>
  s === "Accepted" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" :
    s === "Sent" ? "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" :
      s === "Draft" ? "bg-muted text-muted-foreground hover:bg-muted" :
        "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400";

export default function ProformaPage() {
  const { proformas, clients, settings, deleteProforma, addInvoice, updateProforma, fetchProformas, fetchClients } = useAgencyStore();
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchProformas(), fetchClients()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchProformas, fetchClients]);
  const [isDownloading, setIsDownloading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [activeProforma, setActiveProforma] = useState<Proforma | null>(null);

  const filtered = proformas.filter((pro) =>
    pro.id.toLowerCase().includes(search.toLowerCase()) ||
    pro.client.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const taxRate = settings.taxRate ?? 0;
    const getTotalDue = (p: Proforma) => {
      const subtotal = p.items?.length ? sumItems(p.items) : parseAmountNumber(p.amount);
      return subtotal + (subtotal * taxRate) / 100;
    };

    const totalAccepted = proformas.filter(p => p.status === 'Accepted').reduce((sum, p) => sum + getTotalDue(p), 0);
    const totalSent = proformas.filter(p => p.status === 'Sent').reduce((sum, p) => sum + getTotalDue(p), 0);
    const totalDraft = proformas.filter(p => p.status === 'Draft').reduce((sum, p) => sum + getTotalDue(p), 0);
    return [
      { label: "Accepted", value: formatCurrency(totalAccepted), count: proformas.filter(p => p.status === 'Accepted').length, color: "text-emerald-600" },
      { label: "Sent", value: formatCurrency(totalSent), count: proformas.filter(p => p.status === 'Sent').length, color: "text-blue-600" },
      { label: "Draft", value: formatCurrency(totalDraft), count: proformas.filter(p => p.status === 'Draft').length, color: "text-foreground" },
    ];
  }, [proformas, settings.taxRate]);

  const handleDelete = async (id: string) => {
    try {
      await deleteProforma(id);
      toast({ title: "Proforma Deleted", description: `${id} has been removed.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete proforma.", variant: "destructive" });
    }
  };

  const getProformaTotalDue = (pro: Proforma) => {
    const taxRate = settings.taxRate ?? 0;
    const subtotal = pro.items?.length ? sumItems(pro.items) : parseAmountNumber(pro.amount);
    return subtotal + (subtotal * taxRate) / 100;
  };

  const getProformaSubtotal = (pro: Proforma) => {
    return pro.items?.length ? sumItems(pro.items) : parseAmountNumber(pro.amount);
  };

  const handleConvert = async (pro: Proforma) => {
    const subtotal = getProformaSubtotal(pro);
    const taxRate = settings.taxRate ?? 0;
    const totalDue = subtotal + (subtotal * taxRate) / 100;
    const client = clients.find((c) => c.company === pro.client || c.name === pro.client);

    try {
      await addInvoice({
        client: pro.client,
        clientEmail: pro.clientEmail || client?.email,
        clientAddress: client?.address,
        amount: formatCurrency(totalDue),
        status: "Pending",
        date: new Date().toISOString().split("T")[0],
        dueDate: pro.dueDate,
        items: pro.items?.length
          ? pro.items
          : [{ description: "Services rendered", quantity: 1, unitPrice: subtotal }],
        notes: pro.notes,
        taxRate,
      });
      await updateProforma(pro.id, { status: "Accepted" });
      toast({ title: "Converted to Invoice", description: `Proforma ${pro.id} has been converted to an invoice.` });
      navigate("/dashboard/invoices");
    } catch (e) {
      toast({ title: "Error", description: "Failed to convert proforma to invoice.", variant: "destructive" });
    }
  };

  const handleDownload = async (pro: Proforma) => {
    setActiveProforma(pro);
    setIsDownloading(true);

    toast({ title: "Processing PDF", description: "Generating your high-quality proforma..." });

    setTimeout(async () => {
      if (!pdfRef.current) return;

      try {
        const canvas = await html2canvas(pdfRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${pro.id}.pdf`);

        toast({ title: "PDF Downloaded", description: `${pro.id}.pdf has been saved.` });
      } catch (error) {
        console.error("PDF generation failed:", error);
        toast({
          title: "Download Failed",
          description: "There was an error generating the PDF.",
          variant: "destructive"
        });
      } finally {
        setIsDownloading(false);
        setActiveProforma(null);
      }
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Proforma</h1>
          <p className="text-muted-foreground mt-1">Manage your quotes and proposals</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/proforma/add")}>
          <Plus className="h-4 w-4" /> New Proforma
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.count} proformas</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Proformas ({filtered.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search proformas..."
                className="pl-9 w-56 bg-muted border-0"
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
                <TableHead>Proforma ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Valid Until</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                      <p className="text-sm">Loading proformas...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No proformas found. <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/proforma/add")}>Create your first proforma</button>
                  </TableCell>
                </TableRow>
              ) : filtered.map((pro) => (
                <TableRow
                  key={pro.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/dashboard/proforma/view/${pro.id}`)}
                >
                  <TableCell>
                    <p className="font-semibold text-primary">{pro.id}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-foreground">{pro.client}</p>
                    <p className="text-xs text-muted-foreground">{pro.clientEmail || '—'}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{pro.date}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{pro.dueDate}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {formatCurrency(getProformaTotalDue(pro))}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(pro.status)}>{pro.status}</Badge>
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
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/proforma/view/${pro.id}`); }}>
                          <Eye className="h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/proforma/edit/${pro.id}`); }}>
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {pro.status !== "Accepted" && (
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleConvert(pro); }}>
                            <FileText className="h-4 w-4" /> Convert to Invoice
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDownload(pro); }}>
                          <FileDown className="h-4 w-4" /> Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleDelete(pro.id); }}
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

      {/* Hidden Proforma Renderer for PDF Generation */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        {activeProforma && (
          <div ref={pdfRef}>
            <PremiumInvoice
              type="Proforma"
              data={{
                ...activeProforma,
                clientEmail: activeProforma.clientEmail || clients.find(c => c.company === activeProforma.client || c.name === activeProforma.client)?.email,
                clientAddress: clients.find(c => c.company === activeProforma.client || c.name === activeProforma.client)?.address,
                taxRate: settings.taxRate,
              }}
              settings={settings}
            />
          </div>
        )}
      </div>
    </div>
  );
}
