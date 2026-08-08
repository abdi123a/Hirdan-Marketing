import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import {
  FileText, Download, Mail, RefreshCw, AlertTriangle, CheckCircle2, Sparkles,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The design's native slide size; the preview scales this down to fit.
const SLIDE_W = 1920;
const SLIDE_H = 1080;

interface ReportSummary {
  id: string;
  clientId: string;
  month: number;
  year: number;
  title: string;
  status: string;
  sectionCount: number;
}

interface Facts {
  hasAccounts: boolean;
  client: { id: string; name: string };
  period: { label: string };
  totals: { postCount: number; followers: number };
  kpis: Record<string, { current: number; previous: number | null; changePct: number | null }>;
  platforms: { platform: string; posts: number; reach: number | null }[];
  paid: { hasData: boolean };
  audience: { gender: unknown[]; age: unknown[]; country: unknown[]; city: unknown[] };
  bestTimesSource: "audience" | "posts" | null;
  trend: unknown[];
}

/**
 * Data-coverage warnings.
 *
 * The whole point of the preview is catching a thin report before a client
 * sees it, so gaps are surfaced explicitly rather than left to be noticed as a
 * blank slide.
 */
function coverageIssues(facts: Facts | null): string[] {
  if (!facts) return [];
  const out: string[] = [];
  if (!facts.hasAccounts) {
    out.push("This client has no connected social accounts — the report will be almost entirely empty.");
    return out;
  }
  if (facts.totals.postCount === 0) out.push("No posts recorded in this period.");
  if (!facts.paid.hasData) out.push("No ad spend entered for this month — the Paid and Organic slide will show an empty state.");
  const demo = facts.audience;
  if (demo.age.length === 0 && demo.gender.length === 0) {
    out.push("No audience demographics — upload an Instagram/Facebook/TikTok/YouTube analytics export to fill the Age & Gender slide.");
  }
  if (demo.country.length === 0 && demo.city.length === 0) {
    out.push("No location data — the Top Locations slide will show an empty state.");
  }
  if (facts.bestTimesSource === "posts") {
    out.push("Best-times heatmap is inferred from your own posting history, not real audience activity. Upload an analytics export for the true heatmap.");
  }
  if (facts.bestTimesSource === null) out.push("No data for the Best Times slide.");
  if (facts.trend.length === 0) out.push("No historical trend data.");
  return out;
}

export default function SocialPerformanceReportPage() {
  const { toast } = useToast();
  const { clients, fetchClients } = useAgencyStore();
  const now = new Date();

  // Default to last month — the month you'd actually be reporting on.
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.35);
  const [clientIdsWithAccounts, setClientIdsWithAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (clients.length === 0) fetchClients();
  }, [clients.length, fetchClients]);

  // Load clients with social accounts
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accounts = await apiFetch<any>("/social/accounts?limit=1000").catch(() => null);
        const accs = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
        const accountClientIds = new Set<string>();
        accs.forEach((acc: any) => {
          if (acc.clientId) accountClientIds.add(acc.clientId);
        });
        setClientIdsWithAccounts(accountClientIds);
      } catch {
        // If accounts fail to load, fall back to empty set
        setClientIdsWithAccounts(new Set());
      }
    };
    loadAccounts();
  }, []);

  // Scale the deck to the available width so the preview is what the PDF is.
  useEffect(() => {
    const measure = () => {
      const w = previewWrapRef.current?.clientWidth ?? 0;
      if (w > 0) setPreviewScale(Math.min(1, (w - 32) / SLIDE_W));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [previewHtml]);

  const issues = useMemo(() => coverageIssues(facts), [facts]);
  const selectedClient = clients.find((c) => c.id === clientId);
  const clientsWithAccounts = useMemo(
    () => clients.filter(c => {
      const hasInSet = clientIdsWithAccounts.has(c.id);
      const count = (c as any)._count?.socialAccounts;
      const hasInCount = typeof count === "number" && count > 0;
      return hasInSet || hasInCount;
    }),
    [clients, clientIdsWithAccounts]
  );

  const loadPreview = async (reportId: string) => {
    setLoadingPreview(true);
    try {
      const blob = await apiFetchBlob(`/social-performance-reports/${reportId}/preview`);
      setPreviewHtml(await blob.text());
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Load an already-generated report for this period, if one exists.
  useEffect(() => {
    if (!clientId) { setReport(null); setFacts(null); setPreviewHtml(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<any>(`/social-performance-reports/${clientId}/${month}/${year}`);
        if (cancelled || !res?.report) return;
        setReport({ ...res.report, sectionCount: res.sections?.length ?? 0 });
        setFacts(null); // facts only come back from a fresh generate
        loadPreview(res.report.id);
      } catch {
        if (!cancelled) { setReport(null); setPreviewHtml(""); setFacts(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, month, year]);

  const handleGenerate = async () => {
    if (!clientId) return;
    setGenerating(true);
    setPreviewHtml("");
    try {
      const res = await apiFetch<{ report: ReportSummary; facts: Facts }>(
        "/social-performance-reports/generate",
        { method: "POST", body: JSON.stringify({ clientId, month, year }) },
      );
      setReport(res.report);
      setFacts(res.facts);
      await loadPreview(res.report.id);
      toast({ title: "Report generated", description: res.report.title });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const blob = await apiFetchBlob(`/social-performance-reports/${report.id}/export-pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const openEmail = () => {
    if (!report) return;
    setEmailTo((selectedClient as any)?.email || "");
    setEmailSubject(report.title);
    setEmailBody(
      `Hello,\n\nPlease find attached your social media performance report for ${MONTHS[month - 1]} ${year}.\n\nBest regards,\nHirdan Marketing`,
    );
    setEmailOpen(true);
  };

  const handleSend = async () => {
    if (!report) return;
    setSending(true);
    try {
      await apiFetch(`/social-performance-reports/${report.id}/send-email`, {
        method: "POST",
        body: JSON.stringify({ to: emailTo, cc: emailCc, subject: emailSubject, body: emailBody }),
      });
      toast({ title: "Report sent", description: `Emailed to ${emailTo}` });
      setEmailOpen(false);
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <FileText className="h-6 w-6" /> Social Performance Report
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a client and month — the report builds itself from your analytics. Review it below before sending.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
          <CardDescription>Reports cover one calendar month.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs font-bold">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clientsWithAccounts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Year</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
              />
            </div>
            <Button onClick={handleGenerate} disabled={!clientId || generating} className="gap-2 font-bold">
              {generating
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
                : <><Sparkles className="h-4 w-4" /> {report ? "Regenerate" : "Generate"}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {facts && (
        <Card className={issues.length > 0 ? "border-amber-200" : "border-emerald-200"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {issues.length > 0
                ? <><AlertTriangle className="h-4 w-4 text-amber-600" /> Check before sending</>
                : <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> All sections have data</>}
            </CardTitle>
            <CardDescription>
              What the report could and couldn't fill from your data. Empty sections show an honest empty state — no invented numbers.
            </CardDescription>
          </CardHeader>
          {issues.length > 0 && (
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {issues.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-muted-foreground">
                    <span className="text-amber-600 font-bold">•</span>{issue}
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {report && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{report.title}</CardTitle>
              <CardDescription>
                {report.sectionCount || 21} slides · this preview is exactly what the PDF contains
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2">
                {downloading
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> Preparing…</>
                  : <><Download className="h-4 w-4" /> Download PDF</>}
              </Button>
              <Button onClick={openEmail} className="gap-2 font-bold">
                <Mail className="h-4 w-4" /> Send by email
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={previewWrapRef} className="bg-muted/40 rounded-lg p-4 overflow-hidden">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading preview…
                </div>
              ) : previewHtml ? (
                <div
                  style={{
                    width: SLIDE_W * previewScale,
                    height: (SLIDE_H + 24) * 21 * previewScale,
                    margin: "0 auto",
                  }}
                >
                  <iframe
                    // srcdoc (not src) so the authenticated fetch above supplies
                    // the markup; sandboxed because it is a rendered document,
                    // not part of the app.
                    srcDoc={previewHtml}
                    sandbox=""
                    title="Report preview"
                    style={{
                      width: SLIDE_W,
                      height: (SLIDE_H + 24) * 21,
                      border: "none",
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top left",
                    }}
                  />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  No preview yet — generate the report.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">To</Label>
              <Input className="mt-1.5" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@example.com" />
            </div>
            <div>
              <Label className="text-xs font-bold">CC (optional)</Label>
              <Input className="mt-1.5" value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="comma separated" />
            </div>
            <div>
              <Label className="text-xs font-bold">Subject</Label>
              <Input className="mt-1.5" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold">Message</Label>
              <Textarea className="mt-1.5 min-h-[120px]" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              The PDF is re-rendered on the server and attached automatically.
            </p>
            <Button onClick={handleSend} disabled={!emailTo || !emailSubject || sending} className="w-full gap-2 font-bold">
              {sending
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Mail className="h-4 w-4" /> Send report</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
