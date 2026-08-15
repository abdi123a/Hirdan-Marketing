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
  Loader2,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";

import { PremiumInvoice } from "@/components/PremiumInvoice";
import { formatDate } from "@/lib/utils";
import { getShortVerificationUrl } from "@/lib/short-url";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { printInvoicePdf } from "@/lib/document-pdf";

export default function InvoiceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, clients, settings, getVerificationToken, fetchInvoiceById, fetchClients } = useAgencyStore();
  const { toast } = useToast();
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const invoice = useMemo(() => invoices.find((i) => i.id === id || (i as any)._dbId === id), [invoices, id]);
  const client = useMemo(() => clients.find((c) => c.company === invoice?.client || c.name === invoice?.client), [clients, invoice]);

  useEffect(() => {
    // Fetch this invoice directly — the paginated list may not contain it.
    Promise.all([
      id ? fetchInvoiceById(id) : Promise.resolve(null),
      fetchClients()
    ]).finally(() => {
      setIsInitialLoading(false);
    });
  }, [id, fetchInvoiceById, fetchClients]);

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

  const verificationUrl = verificationToken ? getShortVerificationUrl(verificationToken) : "";

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
    const email = invoice.clientEmail || client?.email || "";
    setEmailTo(email);
    setEmailCc("");
    setEmailSubject(`Invoice ${invoice.id} from ${settings.agencyName || "Hirdan Marketing"}`);
    setEmailBody(
      `Hi ${invoice.client},\n\n` +
      `Please find attached invoice ${invoice.id} due on ${formatDate(invoice.dueDate)} for your review.\n\n` +
      `You can also view and verify the invoice online at:\n${verificationUrl}\n\n` +
      `Best regards,\n${settings.agencyName || "Hirdan Marketing"}`
    );
    setIsEmailModalOpen(true);
  };

  const handleConfirmSendEmail = async () => {
    if (!emailTo) {
      toast({ title: "Recipient Email Required", description: "Please enter a recipient email address.", variant: "destructive" });
      return;
    }
    setIsSendingEmail(true);
    toast({ title: "Sending Email", description: "Generating PDF on the server and delivering..." });

    try {
      const dbId = invoice._dbId || invoice.id;

      const response = await apiFetch<{ success: boolean; message?: string }>(`/invoices/${dbId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          to: emailTo,
          cc: emailCc,
          subject: emailSubject,
          body: emailBody,
          filename: `Invoice_${invoice.id}.pdf`,
        }),
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to send email");
      }

      toast({ title: "Email Sent", description: `Successfully sent email to ${emailTo}.` });
      setIsEmailModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Send Failed",
        description: err?.message || "There was an error generating or sending the email.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
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
              onClick={async () => {
                if (!invoice?.id || isPrinting) return;
                setIsPrinting(true);
                try {
                  await printInvoicePdf(invoice.id);
                } catch (error) {
                  console.error(error);
                  toast({
                    title: "Print failed",
                    description: "Could not prepare the PDF for printing. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsPrinting(false);
                }
              }}
              disabled={isPrinting}
              className="h-10 px-4 gap-2 rounded-xl"
            >
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {isPrinting ? "Preparing…" : "Print / Save PDF"}
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
        <div className="lg:col-span-3 overflow-x-auto" ref={printRef}>
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

          {/* Notes & History */}
          {invoice.notes && (
            <Card className="shadow-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Notes &amp; History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Send Invoice via Email</DialogTitle>
            <DialogDescription>
              Confirm recipient details and email content. The invoice PDF will be attached automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">Client Email</Label>
              <Input
                id="email-to"
                placeholder="client@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-cc">CC (comma-separated)</Label>
              <Input
                id="email-cc"
                placeholder="info@yourcompany.com, team@yourcompany.com"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Email subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                rows={6}
                placeholder="Email message..."
                className="resize-none"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={isSendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
