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
  Copy,
  ExternalLink,
  Mail,
  Printer,
  Share2,
  Settings,
  Handshake,
  FileText,
  Trash2,
  Loader2
} from "lucide-react";
import { useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { PremiumInvoice } from "@/components/PremiumInvoice";
import { formatDate, formatCurrency } from "@/lib/utils";
import { parseAmountNumber, sumItems } from "@/lib/money";
import { useState, useEffect } from "react";

const generateInvoiceId = () => `INV-${Math.floor(Math.random() * 9000 + 1000)}`;


export default function ProformaDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { proformas, clients, settings, addInvoice, updateProforma, getVerificationToken } = useAgencyStore();
  const { toast } = useToast();
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);


  const [isConverting, setIsConverting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const proforma = useMemo(() => proformas.find((p) => p.id === id), [proformas, id]);
  const client = useMemo(() => clients.find((c) => c.company === proforma?.client || c.name === proforma?.client), [clients, proforma]);

  useEffect(() => {
    // We need both proformas and clients to be loaded for conversion to work reliably (needs clientId matching)
    if (proformas.length > 0 && clients.length > 0) {
      setIsInitialLoading(false);
    } else {
      // If none, maybe it's still fetching or really empty. 
      // Set a timeout to stop loading if it's been empty for a bit.
      const timer = setTimeout(() => setIsInitialLoading(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [proformas.length]);

  useEffect(() => {
    if (proforma?.id) {
      setLoadingToken(true);
      getVerificationToken("proforma", proforma.id).then(token => {
        setVerificationToken(token);
        setLoadingToken(false);
      });
    }
  }, [proforma?.id, getVerificationToken]);

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!proforma) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display text-foreground">Proforma not found</h2>
        <Button onClick={() => navigate("/dashboard/proforma")}>Back to Proformas</Button>
      </div>
    );
  }

  const handleConvertToInvoice = async () => {
    if (!proforma) return;
    setIsConverting(true);
    try {
      const subtotal = proforma.items?.length
        ? sumItems(proforma.items)
        : parseAmountNumber(proforma.amount);
      
      const taxRate = proforma.taxRate ?? settings.taxRate ?? 0;
      const discount = proforma.discount ?? 0;
      const discountType = proforma.discountType || 'fixed';

      const taxAmount = (subtotal * taxRate) / 100;
      const discountAmount = discountType === 'percentage' 
        ? (subtotal * discount / 100) 
        : discount;
      
      const finalTotal = subtotal + taxAmount - discountAmount;

      const newInvoice = {
        client: proforma.client,
        clientId: proforma.clientId,
        clientEmail: proforma.clientEmail || client?.email,
        clientAddress: client?.address,
        amount: formatCurrency(finalTotal),
        status: 'Pending' as const,
        date: new Date().toISOString().split("T")[0],
        dueDate: proforma.dueDate,
        items: proforma.items?.length
          ? proforma.items
          : [{ description: "Services rendered", quantity: 1, unitPrice: subtotal }],
        notes: proforma.notes,
        taxRate,
        discount,
        discountType,
        deposit: proforma.deposit,
        createdAt: new Date().toISOString(),
      };

      const invoiceId = generateInvoiceId();
      await addInvoice({ ...newInvoice, id: invoiceId });
      await updateProforma(proforma.id, { status: 'Accepted' });

      toast({
        title: "Converted to Invoice",
        description: `Proforma ${proforma.id} has been moved to invoices.`,
      });

      navigate(`/dashboard/invoices/view/${invoiceId}`);
    } catch (error) {
      console.error("Conversion failed:", error);
      toast({
        title: "Error",
        description: "Failed to convert proforma to invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const statusColor = (s: string) =>
    s === 'Accepted' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === 'Draft' ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400" :
        s === 'Sent' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

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

  const handleShareQuote = async () => {
    if (!verificationUrl) return;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      toast({ title: "Link copied", description: "Verification link has been copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the verification URL manually from the browser address bar." });
    }
  };

  const handleSendToClient = () => {
    if (!verificationUrl) return;
    const email = proforma.clientEmail || client?.email;
    if (!email) {
      toast({ title: "Missing email", description: "Client email is not available for this proforma." });
      return;
    }

    const subject = `Proforma ${proforma.id}`;
    const body = `Hi ${proforma.client},\n\nHere is your proforma: ${verificationUrl}\n\nBest regards,\n${settings.agencyName}`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const statusAccent =
    proforma.status === "Accepted"
      ? "text-emerald-600"
      : proforma.status === "Sent"
        ? "text-blue-600"
        : proforma.status === "Expired"
          ? "text-red-600"
          : "text-foreground";

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
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">{proforma.id}</h1>
                <Badge className={`${statusColor(proforma.status)} border-0 px-3 py-1 text-[10px] font-black uppercase tracking-widest`} variant="outline">
                  {proforma.status}
                </Badge>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                  {proforma.client}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" /> Drafted {formatDate(proforma.date)}
                </span>
                <span className="opacity-20">|</span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Valid until <span className="text-foreground">{formatDate(proforma.dueDate)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            {proforma.status !== "Accepted" && (
              <Button
                variant="hero"
                onClick={handleConvertToInvoice}
                disabled={isConverting}
                className="h-10 px-4 gap-2 rounded-xl shadow-premium"
              >
                {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
                {isConverting ? "Converting..." : "Accept & bill"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setTimeout(() => window.print(), 50)}
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
              onClick={handleSendToClient}
              className="h-10 px-4 gap-2 rounded-xl"
            >
              <Mail className="h-4 w-4" /> Email client
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/proforma/edit/${proforma.id}`)}
              className="h-10 px-4 gap-2 rounded-xl"
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
            type="Proforma"
            data={{
              ...proforma,
              clientAddress: client?.address,
              taxRate: proforma.taxRate ?? settings.taxRate,
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
                <FileText className="h-4 w-4 text-primary" /> Proforma actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Status</p>
                <p className={`text-sm font-black uppercase tracking-widest ${statusAccent}`}>{proforma.status}</p>
              </div>
              <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
                <div
                  className={
                    proforma.status === "Accepted"
                      ? "h-full bg-emerald-500"
                      : proforma.status === "Sent"
                        ? "h-full bg-blue-500"
                        : proforma.status === "Expired"
                          ? "h-full bg-red-500"
                          : "h-full bg-zinc-400"
                  }
                  style={{ width: proforma.status === "Accepted" ? "100%" : proforma.status === "Sent" ? "55%" : proforma.status === "Expired" ? "85%" : "30%" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl"
                  onClick={() => verificationUrl && window.open(verificationUrl, "_blank", "noopener,noreferrer")}
                  disabled={!verificationUrl || loadingToken}
                >
                  {loadingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Verify
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl"
                  onClick={handleCopyLink}
                  disabled={!verificationUrl}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full h-10 gap-2 rounded-xl"
                onClick={handleSendToClient}
              >
                <Mail className="h-4 w-4" /> Email client
              </Button>
              <Button
                variant="outline"
                className="w-full h-10 gap-2 rounded-xl"
                onClick={handleShareQuote}
                disabled={!verificationUrl}
              >
                <Share2 className="h-4 w-4" /> Share link
              </Button>
            </CardContent>
          </Card>

          {/* Engagement Status */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-5 relative pl-6 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-border">
                {[
                  { label: "Draft created", date: formatDate(proforma.date), dot: "bg-primary" },
                  { label: "Sent to client", date: formatDate(proforma.date), dot: "bg-blue-500" },
                  proforma.status === "Accepted"
                    ? { label: "Accepted", date: "Ready to bill", dot: "bg-emerald-500" }
                    : proforma.status === "Expired"
                      ? { label: "Expired", date: formatDate(proforma.dueDate), dot: "bg-red-500" }
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
