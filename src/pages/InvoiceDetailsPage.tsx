import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Clock4,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  Printer,
  Settings,
  Share2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import { PremiumInvoice } from "@/components/PremiumInvoice";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function InvoiceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, clients, settings, getVerificationToken, fetchInvoices, fetchClients } = useAgencyStore();
  const { toast } = useToast();
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const invoice = useMemo(() => invoices.find((i) => i.id === id), [invoices, id]);
  const client = useMemo(() => clients.find((c) => c.company === invoice?.client || c.name === invoice?.client), [clients, invoice]);

  useEffect(() => {
    Promise.all([
      fetchInvoices(),
      fetchClients()
    ]).finally(() => {
      setIsInitialLoading(false);
    });
  }, [fetchInvoices, fetchClients]);

  useEffect(() => {
    if (invoice?.id) {
      setLoadingToken(true);
      getVerificationToken("invoice", invoice.id).then(token => {
        setVerificationToken(token);
        setLoadingToken(false);
      });
    }
  }, [invoice?.id, getVerificationToken]);

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Clock4 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display text-foreground">Invoice not found</h2>
        <Button onClick={() => navigate("/dashboard/invoices")}>Back to Invoices</Button>
      </div>
    );
  }

  const verificationUrl = verificationToken ? `${window.location.origin}/verify/${verificationToken}` : "";

  const handleCopyLink = async () => {
    if (!verificationUrl) return;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      toast({ title: "Link copied", description: "Verification link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Couldn’t copy automatically. Please copy the URL from the address bar." });
    }
  };

  const handleSendReminder = () => {
    const email = invoice.clientEmail || client?.email;
    if (!email) {
      toast({ title: "Missing email", description: "Client email is not available for this invoice." });
      return;
    }
    if (!verificationUrl) {
      toast({ title: "Verification URL unavailable", description: "Please try again in a moment." });
      return;
    }

    const subject = `Reminder: Invoice ${invoice.id}`;
    const body =
      `Hi ${invoice.client},\n\n` +
      `This is a friendly reminder that invoice ${invoice.id} is due on ${formatDate(invoice.dueDate)}.\n\n` +
      `You can verify the document here:\n${verificationUrl}\n\n` +
      `Best regards,\n${settings.agencyName}`;

    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const statusColor = (s: string) =>
    s === 'Paid' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === 'Partially Paid' ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" :
      s === 'Overdue' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";

  const statusAccent =
    invoice.status === "Paid"
      ? "text-emerald-600"
      : invoice.status === "Partially Paid"
        ? "text-teal-600"
        : invoice.status === "Overdue"
          ? "text-red-600"
          : "text-amber-600";

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-500 mx-auto">
      {/* Header */}
      <div className="print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-2xl h-12 w-12 hover:bg-muted border border-border/40"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">{invoice.id}</h1>
                <Badge className={`${statusColor(invoice.status)} border-0 px-3 py-1 text-[10px] font-black uppercase tracking-widest`} variant="outline">
                  {invoice.status}
                </Badge>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                  {invoice.client}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" /> Issued {formatDate(invoice.date)}
                </span>
                <span className="opacity-20">|</span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Due <span className="text-foreground">{formatDate(invoice.dueDate)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                // #region agent log
                fetch('http://127.0.0.1:7891/ingest/c6d26856-ebcd-4639-9d6e-816efcb76a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b217a'},body:JSON.stringify({sessionId:'1b217a',runId:'pre-fix',hypothesisId:'H7',location:'src/pages/InvoiceDetailsPage.tsx:166',message:'Print invoice initiated',data:{invoiceId:invoice.id,route:window.location.pathname},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                setTimeout(() => window.print(), 50);
              }}
              className="h-10 px-4 gap-2 rounded-xl"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="h-10 px-4 gap-2 rounded-xl"
              disabled={!verificationUrl || loadingToken}
            >
              <Copy className="h-4 w-4" /> Copy link
            </Button>

            <Button
              variant="outline"
              onClick={handleSendReminder}
              className="h-10 px-4 gap-2 rounded-xl"
            >
              <Mail className="h-4 w-4" /> Email reminder
            </Button>
            <Button
              variant="hero"
              onClick={() => navigate(`/dashboard/invoices/edit/${invoice.id}`)}
              className="h-10 px-4 gap-2 rounded-xl shadow-premium"
            >
              <Settings className="h-4 w-4" /> Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Main Document Section */}
        <div className="lg:col-span-3">
          <PremiumInvoice
            type="Invoice"
            data={{
              ...invoice,
              clientEmail: invoice.clientEmail || client?.email,
              clientAddress: client?.address || invoice.clientAddress,
              taxRate: invoice.taxRate ?? settings.taxRate,
            }}
            settings={{
              ...settings,
              website: settings.website,
              primaryColor: settings.primaryColor,
            }}
          />
        </div>

        {/* Action/Info Sidebar */}
        <div className="space-y-6 print:hidden">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Billing status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Status</p>
                <p className={`text-sm font-black uppercase tracking-widest ${statusAccent}`}>{invoice.status}</p>
              </div>
              <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
                <div
                  className={
                    invoice.status === "Paid"
                      ? "h-full bg-emerald-500"
                      : invoice.status === "Overdue"
                        ? "h-full bg-red-500"
                        : "h-full bg-amber-500"
                  }
                  style={{ width: invoice.status === "Paid" ? "100%" : invoice.status === "Overdue" ? "70%" : "35%" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl"
                  onClick={() => verificationUrl && window.open(verificationUrl, "_blank", "noopener,noreferrer")}
                  disabled={!verificationUrl || loadingToken}
                >
                  {loadingToken ? <Clock4 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Verify
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl"
                  onClick={handleCopyLink}
                  disabled={!verificationUrl || loadingToken}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>


              <Button
                variant="outline"
                className="w-full h-10 gap-2 rounded-xl"
                onClick={handleSendReminder}
              >
                <Mail className="h-4 w-4" /> Email reminder
              </Button>
            </CardContent>
          </Card>

          {/* Activity/History Log */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-5 relative pl-6 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-border">
                {[
                  { label: "Draft created", date: formatDate(invoice.date), icon: FileText, dot: "bg-primary" },
                  { label: "Sent to client", date: formatDate(invoice.date), icon: Mail, dot: "bg-amber-500" },
                  invoice.status === "Paid"
                    ? { label: "Payment recorded", date: "Paid", icon: CheckCircle2, dot: "bg-emerald-500" }
                    : invoice.status === "Overdue"
                      ? { label: "Payment overdue", date: formatDate(invoice.dueDate), icon: Clock, dot: "bg-red-500" }
                      : null,
                ].filter(Boolean).map((act, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[18px] top-1.5 h-3.5 w-3.5 rounded-full ${act?.dot} ring-4 ring-background`} />
                    <p className="text-sm font-semibold text-foreground">{act?.label}</p>
                    <p className="text-xs text-muted-foreground">{act?.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
