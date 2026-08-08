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
  Loader2,
  BellRing,
  Send,
  Sparkles
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { PremiumInvoice } from "@/components/PremiumInvoice";
import { formatDate } from "@/lib/utils";
import { getShortVerificationUrl } from "@/lib/short-url";
import { parseAmountNumber, sumItems } from "@/lib/money";
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
import { printProformaPdf } from "@/lib/document-pdf";
import RichTextEditor from "@/components/RichTextEditor";

export default function ProformaDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { proformas, clients, settings, updateProforma, getVerificationToken, fetchProformas, fetchClients } = useAgencyStore();
  const { toast } = useToast();
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const richTextRef = useRef<HTMLDivElement>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [emailMode, setEmailMode] = useState<"standard" | "followup">("standard");
  const [followUpPreset, setFollowUpPreset] = useState<"GENTLE_REMINDER" | "EXPIRING_SOON" | "DEPOSIT_REQUIRED" | "FINAL_NOTICE">("GENTLE_REMINDER");


  const [isConverting, setIsConverting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchProformas(),
      fetchClients()
    ]).finally(() => {
      setIsInitialLoading(false);
    });
  }, [fetchProformas, fetchClients]);

  const proforma = useMemo(() => proformas.find((p) => p.id === id || (p as any)._dbId === id || p.proformaNumber === id), [proformas, id]);
  const client = useMemo(() => clients.find((c) => c.company === proforma?.client || c.name === proforma?.client), [clients, proforma]);

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
      const res = await updateProforma(proforma.id, { status: 'Accepted' });
      const invoiceId = res?.invoiceId || res?.invoiceNumber;

      toast({
        title: "Converted to Invoice",
        description: `Proforma ${proforma.id} has been moved to invoices.`,
      });

      if (invoiceId) {
        navigate(`/dashboard/invoices/view/${invoiceId}`);
      } else {
        navigate('/dashboard/invoices');
      }
    } catch (error) {
      console.error("Conversion failed:", error);
      const errMsg = error instanceof Error ? error.message : "Failed to convert proforma to invoice.";
      toast({
        title: "Conversion Error",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const statusColor = (s: string) =>
    s === 'Accepted' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === 'Partially Paid' ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" :
      s === 'Draft' ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400" :
        s === 'Sent' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

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

  const handleShareQuote = async () => {
    if (!verificationUrl) return;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      toast({ title: "Link copied", description: "Verification link has been copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the verification URL manually from the browser address bar." });
    }
  };

  const getFollowUpContent = (
    type: "GENTLE_REMINDER" | "EXPIRING_SOON" | "DEPOSIT_REQUIRED" | "FINAL_NOTICE",
    pNumber: string,
    cName: string,
    aName: string,
    dueDate?: string
  ) => {
    switch (type) {
      case "GENTLE_REMINDER":
        return {
          subject: `Friendly Reminder: Proforma Estimate ${pNumber} — ${aName}`,
          body: `Hi ${cName},\n\nJust checking in to see if you had a chance to review Proforma Estimate ${pNumber}.\n\nPlease let us know if you have any questions or if you'd like any adjustments to the scope.\n\nBest regards,\n${aName}`
        };
      case "EXPIRING_SOON":
        return {
          subject: `Expiring Soon: Proforma Estimate ${pNumber} — ${aName}`,
          body: `Hi ${cName},\n\nThis is a gentle reminder that Proforma Estimate ${pNumber}${dueDate ? ` is set to expire on ${dueDate}` : ' is expiring soon'}.\n\nTo lock in these project terms and timeline, please review and accept the estimate online.\n\nBest regards,\n${aName}`
        };
      case "DEPOSIT_REQUIRED":
        return {
          subject: `Deposit Required for Proforma Estimate ${pNumber} — ${aName}`,
          body: `Hi ${cName},\n\nWe're excited to get started on your project! To kick off work on Proforma Estimate ${pNumber}, please review and accept the estimate so we can process your initial deposit.\n\nBest regards,\n${aName}`
        };
      case "FINAL_NOTICE":
        return {
          subject: `Final Follow-Up: Proforma Estimate ${pNumber} — ${aName}`,
          body: `Hi ${cName},\n\nThis is our final follow-up regarding Proforma Estimate ${pNumber}.\n\nIf you'd still like to move forward with this project, please approve the estimate online or let us know how we can assist.\n\nBest regards,\n${aName}`
        };
    }
  };

  const handleOpenEmailModal = (mode: "standard" | "followup" = "standard", preset: "GENTLE_REMINDER" | "EXPIRING_SOON" | "DEPOSIT_REQUIRED" | "FINAL_NOTICE" = "GENTLE_REMINDER") => {
    const email = proforma?.clientEmail || client?.email || "";
    setEmailTo(email);
    setEmailCc("");
    setEmailMode(mode);
    setFollowUpPreset(preset);

    const aName = settings.agencyName || "Hirdan Marketing";
    const cName = proforma?.client || "Client";
    const pNumber = proforma?.id || "";

    let bodyContent = "";
    if (mode === "followup") {
      const content = getFollowUpContent(preset, pNumber, cName, aName, proforma?.dueDate ? formatDate(proforma.dueDate) : undefined);
      setEmailSubject(content.subject);
      bodyContent = content.body;
      setEmailBody(content.body);
    } else {
      setEmailSubject(`Proforma Estimate ${pNumber} from ${aName}`);
      bodyContent = `Hi ${cName},\n\nPlease find attached proforma ${pNumber} for your review.\n\nYou can also view and verify the document online at:\n${verificationUrl}\n\nBest regards,\n${aName}`;
      setEmailBody(bodyContent);
    }
    setIsEmailModalOpen(true);
    setTimeout(() => {
      if (richTextRef.current) {
        richTextRef.current.innerHTML = bodyContent.replace(/\n/g, "<br>");
      }
    }, 150);
  };

  const handleSelectPreset = (preset: "GENTLE_REMINDER" | "EXPIRING_SOON" | "DEPOSIT_REQUIRED" | "FINAL_NOTICE") => {
    setFollowUpPreset(preset);
    const aName = settings.agencyName || "Hirdan Marketing";
    const cName = proforma?.client || "Client";
    const pNumber = proforma?.id || "";
    const content = getFollowUpContent(preset, pNumber, cName, aName, proforma?.dueDate ? formatDate(proforma.dueDate) : undefined);
    setEmailSubject(content.subject);
    setEmailBody(content.body);
    if (richTextRef.current) {
      richTextRef.current.innerHTML = content.body.replace(/\n/g, "<br>");
    }
  };

  const handleSendToClient = () => {
    handleOpenEmailModal("standard");
  };

  const handleConfirmSendEmail = async () => {
    if (!emailTo) {
      toast({ title: "Recipient Email Required", description: "Please enter a recipient email address.", variant: "destructive" });
      return;
    }
    setIsSendingEmail(true);
    toast({ title: emailMode === "followup" ? "Sending Follow-Up Email" : "Sending Email", description: "Generating PDF on the server and delivering..." });

    try {
      const dbId = proforma._dbId || proforma.id;

      const currentBody = richTextRef.current?.innerHTML || emailBody;
      const response = await apiFetch<{ success: boolean; message?: string }>(`/proformas/${dbId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          to: emailTo,
          cc: emailCc,
          subject: emailSubject,
          body: currentBody,
          filename: `Proforma_${proforma.id}.pdf`,
          isFollowUp: emailMode === "followup",
          followUpType: followUpPreset,
          customNote: currentBody,
          verificationUrl,
        }),
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to send email");
      }

      toast({
        title: emailMode === "followup" ? "Follow-Up Sent 🎉" : "Email Sent",
        description: `Successfully sent ${emailMode === "followup" ? "follow-up" : "email"} to ${emailTo}.`
      });
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

  const statusAccent =
    proforma.status === "Accepted"
      ? "text-emerald-600"
      : proforma.status === "Partially Paid"
        ? "text-teal-600"
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
              onClick={async () => {
                if (!proforma?.id || isPrinting) return;
                setIsPrinting(true);
                try {
                  await printProformaPdf(proforma.id);
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
              onClick={() => handleOpenEmailModal("standard")}
              className="h-10 px-4 gap-2 rounded-xl"
            >
              <Mail className="h-4 w-4" /> Email client
            </Button>
            <Button
              variant="hero"
              onClick={() => handleOpenEmailModal("followup", "GENTLE_REMINDER")}
              className="h-10 px-4 gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md"
            >
              <BellRing className="h-4 w-4" /> Follow-up
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
        <div className="lg:col-span-3 overflow-x-auto" ref={printRef}>
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
                onClick={() => handleOpenEmailModal("standard")}
              >
                <Mail className="h-4 w-4" /> Email client
              </Button>
              <Button
                variant="outline"
                className="w-full h-10 gap-2 rounded-xl border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => handleOpenEmailModal("followup", "GENTLE_REMINDER")}
              >
                <BellRing className="h-4 w-4 text-amber-500" /> Send Follow-up Email
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

          {/* Notes & History */}
          {proforma.notes && (
            <Card className="shadow-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Notes &amp; History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                  {proforma.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg">
                {emailMode === "followup" ? (
                  <>
                    <BellRing className="h-5 w-5 text-amber-500" /> Proforma Follow-Up Email
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 text-primary" /> Send Proforma Document
                  </>
                )}
              </span>
            </DialogTitle>
            <DialogDescription>
              {emailMode === "followup"
                ? "Send a high-converting, styled follow-up email to remind client about this proforma."
                : "Confirm recipient details and email content. The proforma PDF will be attached automatically."}
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-border mb-2">
            <button
              type="button"
              onClick={() => handleOpenEmailModal("standard")}
              className={`flex-1 py-2 px-3 text-xs font-bold transition-colors border-b-2 ${
                emailMode === "standard"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Standard Email
            </button>
            <button
              type="button"
              onClick={() => handleOpenEmailModal("followup", followUpPreset)}
              className={`flex-1 py-2 px-3 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                emailMode === "followup"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Follow-Up Template
            </button>
          </div>

          {emailMode === "followup" && (
            <div className="space-y-2 bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <Label className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Follow-Up Strategy & Presets
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: "GENTLE_REMINDER", label: "Friendly Reminder", desc: "Polite check-in" },
                  { key: "EXPIRING_SOON", label: "Expiring Soon", desc: "Urgency alert" },
                  { key: "DEPOSIT_REQUIRED", label: "Deposit Request", desc: "Kickoff payment" },
                  { key: "FINAL_NOTICE", label: "Final Follow-Up", desc: "Last notice" },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelectPreset(p.key as any)}
                    className={`p-2 text-left rounded-lg border text-xs transition-all ${
                      followUpPreset === p.key
                        ? "bg-amber-500 text-white border-amber-600 font-bold shadow-sm"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <div>{p.label}</div>
                    <div className={`text-[10px] font-normal ${followUpPreset === p.key ? "text-amber-100" : "text-muted-foreground"}`}>
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-to" className="text-xs">Client Email</Label>
                <Input
                  id="email-to"
                  placeholder="client@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-cc" className="text-xs">CC (optional)</Label>
                <Input
                  id="email-cc"
                  placeholder="team@yourcompany.com"
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs">Subject Line</Label>
              <Input
                id="email-subject"
                placeholder="Email subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-9 text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body" className="text-xs">
                {emailMode === "followup" ? "Custom Message / Personal Note" : "Message Body"}
              </Label>
              <RichTextEditor
                editorRef={richTextRef}
                minHeight="110px"
                maxHeight="220px"
                placeholder="Write a message..."
                onChange={(html) => setEmailBody(html)}
              />
            </div>

            {emailMode === "followup" && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
                ✨ <strong>Note:</strong> This follow-up will render a branded email card featuring proforma details, itemized breakdown, interactive review button, and the PDF attachment.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={isSendingEmail}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSendEmail}
              disabled={isSendingEmail}
              className={emailMode === "followup" ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white" : ""}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : emailMode === "followup" ? (
                <>
                  <Send className="mr-2 h-4 w-4" /> Send Follow-Up
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
