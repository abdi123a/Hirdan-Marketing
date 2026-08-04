import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, FileDown, Loader2, Sparkles, Upload } from "lucide-react";
import { useAgencyStore } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { exportHtmlPagesPdf, serializeElementForPdf } from "@/lib/document-pdf";
import { QRCodeSVG } from "qrcode.react";
import { getShortVerificationUrl } from "@/lib/short-url";

const PDF_PAGE_WIDTH = 1520;
const PDF_PAGE_HEIGHT = 1080;
const PDF_HEADER_HEIGHT = 170;
const PDF_FOOTER_HEIGHT = 120;

type ReportSection = {
  key: string;
  order: number;
  content: Record<string, any>;
};

type ReportAsset = {
  id: string;
  sectionKey: string;
  slotKey: string;
  url: string;
  caption: string | null;
};

type MonthlyReport = {
  id: string;
  title: string;
  month: number;
  year: number;
  sourceText: string;
  sections: ReportSection[];
  assets?: ReportAsset[];
};

type ReportListItem = {
  id: string;
  clientId: string;
  month: number;
  year: number;
  title: string;
  status: "DRAFT" | "FINALIZED";
  updatedAt: string;
  client: { name: string; company: string | null };
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FIXED_SECTIONS = [
  "cover",
  "tableOfContents",
  "overview",
  "objectives",
  "targetAudience",
  "instagramInsights",
  "instagramTopPost",
  "facebookInsights",
  "facebookTopPost",
  "tiktokInsights",
  "tiktokTopPost",
  "swotAnalysis",
  "competitors",
  "nextSteps",
  "thankYou",
];

const HUMAN_LABELS: Record<string, string> = {
  cover: "Cover",
  tableOfContents: "Table of Contents",
  overview: "Overview",
  objectives: "Objectives",
  targetAudience: "Target Audience",
  instagramInsights: "Instagram Insights",
  instagramTopPost: "Instagram Top Post",
  facebookInsights: "Facebook Insights",
  facebookTopPost: "Facebook Top Post",
  tiktokInsights: "TikTok Insights",
  tiktokTopPost: "TikTok Top Post",
  swotAnalysis: "SWOT Analysis",
  competitors: "Competitors",
  nextSteps: "Next Steps",
  thankYou: "Thank You",
};

type PreflightResult = {
  errors: string[];
  warnings: string[];
  autofixSuggestions: string[];
  completenessScore: number;
  canGenerate: boolean;
};

const defaultPreflight: PreflightResult = {
  errors: [],
  warnings: [],
  autofixSuggestions: [],
  completenessScore: 0,
  canGenerate: false,
};

export default function MonthlyReportStudioPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [clientId, setClientId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [selectedSection, setSelectedSection] = useState(FIXED_SECTIONS[0]);
  const [preflight, setPreflight] = useState<PreflightResult>(defaultPreflight);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportList, setReportList] = useState<ReportListItem[]>([]);
  const [bulletsDraft, setBulletsDraft] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const pdfPagesRef = useRef<Record<string, HTMLDivElement | null>>({});

  const { clients, fetchClients, settings, getVerificationToken } = useAgencyStore();
  const { toast } = useToast();

  useEffect(() => {
    if (clients.length === 0) {
      fetchClients();
    }
  }, [clients.length, fetchClients]);

  useEffect(() => {
    if (report?.id) {
      getVerificationToken("monthly_report", report.id).then(setVerificationToken);
    } else {
      setVerificationToken("");
    }
  }, [report?.id, getVerificationToken]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  const selectedSectionData = useMemo(
    () => report?.sections.find((s) => s.key === selectedSection) ?? null,
    [report, selectedSection]
  );
  const brandPrimary = settings.primaryColor || "#5A428A";
  const brandAccent = "#f6b317";
  const brandDark = "#0f172a";
  const brandMuted = "#64748b";
  const brandLight = "#f8fafc";
  const brandBorder = "#e2e8f0";

  const renderFooter = () => (
    <div style={{
      marginTop: "auto",
      background: brandPrimary,
      color: "#ffffff",
      padding: "24px 80px",
      height: PDF_FOOTER_HEIGHT,
      minHeight: PDF_FOOTER_HEIGHT,
      maxHeight: PDF_FOOTER_HEIGHT,
      boxSizing: "border-box",
      flexShrink: 0,
      zIndex: 1,
      position: "relative",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      {/* Floating Accent Line */}
      <div style={{
        width: "70%",
        height: "5px",
        background: brandAccent,
        borderRadius: "40px",
        position: "absolute",
        top: 0,
        left: "15%",
      }} />

      <div>
        <div style={{ fontSize: "11px", fontWeight: 800, color: brandAccent, textTransform: "uppercase", letterSpacing: "1.5px" }}>
          {settings.agencyName?.toUpperCase() || "HIRDAN MARKETING"}
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 600, marginTop: 4 }}>
          Empowering your brand's future through strategic digital growth
        </div>
      </div>

      <div style={{ display: "flex", gap: "32px", alignItems: "center", opacity: 0.9 }}>
        {settings.phone && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700 }}>{settings.phone}</span>
          </div>
        )}
        {settings.adminEmail && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700 }}>{settings.adminEmail}</span>
          </div>
        )}
        {settings.website && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: brandAccent }}>
            <span style={{ fontSize: "11px", fontWeight: 900 }}>{settings.website.replace('https://', '').replace('http://', '')}</span>
          </div>
        )}
      </div>

      {verificationToken && (
        <div style={{
          marginLeft: "32px",
          padding: "6px",
          background: "#ffffff",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          <QRCodeSVG
            value={getShortVerificationUrl(verificationToken)}
            size={48}
            level="H"
            fgColor={brandPrimary}
            bgColor="transparent"
          />
        </div>
      )}
    </div>
  );

  const renderReportHeader = (opts: { title: string; subtitle?: string }) => (
    <div style={{ padding: "0 100px 22px", height: PDF_HEADER_HEIGHT, minHeight: PDF_HEADER_HEIGHT, maxHeight: PDF_HEADER_HEIGHT, boxSizing: "border-box", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 12 }}>
        <div style={{ minWidth: 280 }}>
          {settings.logo ? (
            <img src={settings.logo} alt="" style={{ height: 62, width: "auto", objectFit: "contain", marginBottom: 4 }} />
          ) : (
            <div style={{ fontSize: 24, fontWeight: 900, color: brandPrimary, letterSpacing: -0.4, marginBottom: 8 }}>
              {settings.agencyName || "AGENCY"}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 50, fontWeight: 900, color: brandDark, letterSpacing: -2, lineHeight: 1 }}>
            {opts.title}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: brandPrimary, marginTop: 16 }}>
            {opts.subtitle || `${MONTHS[month - 1]} ${year}`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", height: 8, width: "100%", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ flex: 1, background: brandPrimary }} />
        <div style={{ width: "24%", background: brandAccent }} />
      </div>
    </div>
  );

  const renderMobileMockup = useCallback(
    (imageUrl?: string, opts?: { maxWidth?: number; caption?: string; variant?: "default" | "iphone17promax"; isVideo?: boolean }) => {
      if (!imageUrl) return null;
      const maxWidth = opts?.maxWidth ?? 320;
      const isIphone17 = opts?.variant === "iphone17promax";
      const isVideo = opts?.isVideo ?? false;

      return (
        <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "9 / 19.5",
              borderRadius: isIphone17 ? 54 : 44,
              background: "#000000",
              border: isIphone17 ? "7px solid #1a1a1a" : `4px solid #1a1a1a`,
              boxShadow: "0 50px 100px -20px rgba(0,0,0,0.3), 0 30px 60px -30px rgba(0,0,0,0.1)",
              padding: isIphone17 ? 12 : 10,
              overflow: "hidden"
            }}
          >
            {/* Dynamic Island */}
            <div
              style={{
                position: "absolute",
                top: 14,
                left: "50%",
                transform: "translateX(-50%)",
                width: "30%",
                height: 22,
                borderRadius: 999,
                background: "#000000",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            />
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: isIphone17 ? 44 : 34,
                overflow: "hidden",
                background: "#f1f5f9",
                position: "relative"
              }}
            >
              <img
                src={imageUrl}
                alt={opts?.caption || "Report screenshot"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />

              {/* Video Overlay Elements */}
              {isVideo && (
                <>
                  {/* Central Play Button */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 5
                  }}>
                    <div style={{ 
                      width: 0, 
                      height: 0, 
                      borderTop: "10px solid transparent",
                      borderBottom: "10px solid transparent",
                      borderLeft: "16px solid white",
                      marginLeft: 4
                    }} />
                  </div>

                  {/* Social Icons Sidebar (Reels/TikTok Style) */}
                  <div style={{
                    position: "absolute",
                    bottom: 80,
                    right: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    alignItems: "center",
                    zIndex: 5
                  }}>
                    {["like", "comment", "share"].map((action, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.92)",
                          border: "1px solid rgba(0,0,0,0.08)"
                        }} />
                        <div style={{ fontSize: 10, fontWeight: 700, color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                          {action === "like" ? "1.2K" : action === "comment" ? "42" : ""}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Caption Overlay */}
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "40px 20px 20px",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    zIndex: 4
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 6 }}>@hirdanmarketing</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      Scaling impact with strategic growth. #Agencylife #Marketing
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {opts?.caption && !isVideo && (
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: brandMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
              {opts.caption}
            </div>
          )}
        </div>
      );
    },
    [brandMuted]
  );

  const updateCurrentSection = (patch: Record<string, any>) => {
    if (!report || !selectedSectionData) return;
    setReport({
      ...report,
      sections: report.sections.map((section) =>
        section.key === selectedSection
          ? { ...section, content: { ...section.content, ...patch } }
          : section
      ),
    });
  };

  const parseBulletLines = useCallback((text: string) => {
    return text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
      .filter(Boolean);
  }, []);

  useEffect(() => {
    const currentBullets = Array.isArray(selectedSectionData?.content?.bullets)
      ? selectedSectionData?.content?.bullets
      : [];
    setBulletsDraft(currentBullets.join("\n"));
  }, [selectedSection, report?.id]);

  const runPreflight = useCallback(async () => {
    if (!clientId || !sourceText.trim()) {
      toast({ title: "Client and context required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<PreflightResult & { month: number; year: number }>(
        "/reports/monthly/preflight",
        {
          method: "POST",
          body: JSON.stringify({ clientId, month, year, sourceText }),
        }
      );
      setPreflight({
        errors: res.errors || [],
        warnings: res.warnings || [],
        autofixSuggestions: res.autofixSuggestions || [],
        completenessScore: res.completenessScore || 0,
        canGenerate: res.canGenerate || false,
      });
      toast({ title: "Preflight complete", description: "Data quality checks are ready." });
    } catch (err: any) {
      toast({ title: "Preflight failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [clientId, month, year, sourceText, toast]);

  const generateReport = useCallback(async () => {
    if (!clientId || !sourceText.trim()) {
      toast({ title: "Client and context required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ report: MonthlyReport; preflight: PreflightResult }>(
        "/reports/monthly/generate",
        {
          method: "POST",
          body: JSON.stringify({
            clientId,
            month,
            year,
            sourceText,
            title: `${selectedClient?.company || selectedClient?.name || "Client"} - ${MONTHS[month - 1]} ${year} Report`,
            forceGenerate: preflight.errors.length === 0 ? false : true,
          }),
        }
      );
      setReport(res.report);
      setPreflight(res.preflight);
      setSelectedSection("cover");
      toast({ title: "Report generated", description: "You can now edit and export." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [clientId, month, year, sourceText, selectedClient, preflight.errors.length, toast]);

  const loadExisting = useCallback(async () => {
    if (!clientId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ report: MonthlyReport }>(`/reports/monthly/${clientId}/${month}/${year}`);
      setReport(res.report);
      setSourceText(res.report.sourceText || "");
      toast({ title: "Loaded saved report" });
    } catch {
      setReport(null);
    } finally {
      setBusy(false);
    }
  }, [clientId, month, year, toast]);

  const fetchReportList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "80");
      if (clientId) params.set("clientId", clientId);
      if (month) params.set("month", String(month));
      if (year) params.set("year", String(year));
      const res = await apiFetch<{ reports: ReportListItem[] }>(`/reports/monthly?${params.toString()}`);
      setReportList(res.reports || []);
    } catch {
      setReportList([]);
    }
  }, [clientId, month, year]);

  useEffect(() => {
    fetchReportList();
  }, [fetchReportList]);

  const saveReport = useCallback(async () => {
    if (!report) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ report: MonthlyReport }>(`/reports/monthly/${report.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: report.title,
          sourceText,
          sections: report.sections.map((s) => ({ key: s.key, order: s.order, content: s.content })),
        }),
      });
      setReport(res.report);
      toast({ title: "Report saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [report, sourceText, toast]);

  const uploadPlaceholder = async (file: File) => {
    if (!report || !selectedSection) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    try {
      const slotKey = "heroImage";
      const res = await apiFetch<{ asset: ReportAsset }>(`/reports/monthly/${report.id}/images`, {
        method: "POST",
        body: JSON.stringify({
          sectionKey: selectedSection,
          slotKey,
          url: dataUrl,
          caption: file.name,
        }),
      });

      const asset = res.asset;
      const assets = report.assets || [];
      const nextAssets = assets.filter(
        (a) => !(a.sectionKey === asset.sectionKey && a.slotKey === asset.slotKey)
      );
      nextAssets.push(asset);
      setReport({ ...report, assets: nextAssets });
      updateCurrentSection({ imageUrl: asset.url, imageCaption: asset.caption || "" });
      toast({ title: "Image placeholder updated" });
    } catch (err: any) {
      toast({ title: "Image upload failed", description: err.message, variant: "destructive" });
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const docWithFonts = document as Document & { fonts?: { ready: Promise<unknown> } };
      if (docWithFonts.fonts?.ready) await docWithFonts.fonts.ready;
      const pageNodes = report.sections
        .map((section) => pdfPagesRef.current[section.key])
        .filter(Boolean) as HTMLDivElement[];
      if (pageNodes.length === 0) throw new Error("Nothing to export yet.");

      const waitForImagesToLoad = async (nodes: HTMLDivElement[]) => {
        const imageNodes = nodes.flatMap((node) => Array.from(node.querySelectorAll("img")));
        await Promise.all(
          imageNodes.map(async (img) => {
            if (img.decode) {
              try {
                await img.decode();
                return;
              } catch {
                // fallback to load listeners
              }
            }
            await new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              setTimeout(done, 8000);
            });
          })
        );
      };

      await waitForImagesToLoad(pageNodes);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 300));

      const pages = pageNodes.map((node) => serializeElementForPdf(node));
      const filename = `${selectedClient?.company || selectedClient?.name || "Client"}-${MONTHS[month - 1]}-${year}-Monthly-Report.pdf`;
      await exportHtmlPagesPdf({
        pages,
        widthPx: PDF_PAGE_WIDTH,
        heightPx: PDF_PAGE_HEIGHT,
        filename,
      });
      toast({ title: "PDF exported", description: "Download started." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Monthly Report Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fixed design template with AI-generated content, inline edits, and PDF export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={runPreflight} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <AlertCircle className="h-4 w-4 mr-1" />}
            Preflight
          </Button>
          <Button onClick={generateReport} disabled={busy || !clientId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generate
          </Button>
          <Button variant="hero" onClick={saveReport} disabled={busy || !report}>Save</Button>
          <Button variant="outline" onClick={exportPdf} disabled={exporting || !report}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
            Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input Context</CardTitle>
          <CardDescription>Paste your monthly report raw text, metrics, links, and highlights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-bold">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
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
              <Input className="mt-1.5" type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={loadExisting} disabled={!clientId || busy}>Load Existing</Button>
            </div>
          </div>
          <Textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            className="min-h-[180px]"
            placeholder="Paste full monthly context here: content published, videos, links, followers, views, likes, comments, shares, top posts, wins, misses, next actions..."
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant={preflight.canGenerate ? "default" : "secondary"}>
              Completeness: {preflight.completenessScore}%
            </Badge>
            {preflight.errors.length > 0 && <Badge variant="destructive">{preflight.errors.length} Errors</Badge>}
            {preflight.warnings.length > 0 && <Badge variant="outline">{preflight.warnings.length} Warnings</Badge>}
          </div>
          {(preflight.errors.length > 0 || preflight.warnings.length > 0) && (
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <Card className="border-red-200">
                <CardHeader><CardTitle className="text-sm text-red-600">Errors</CardTitle></CardHeader>
                <CardContent className="space-y-1">{preflight.errors.length ? preflight.errors.map((e, i) => <p key={i}>- {e}</p>) : <p>None</p>}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Warnings</CardTitle></CardHeader>
                <CardContent className="space-y-1">{preflight.warnings.length ? preflight.warnings.map((w, i) => <p key={i}>- {w}</p>) : <p>None</p>}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Auto-fix Suggestions</CardTitle></CardHeader>
                <CardContent className="space-y-1">{preflight.autofixSuggestions.length ? preflight.autofixSuggestions.map((s, i) => <p key={i}>- {s}</p>) : <p>None</p>}</CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>
            Click any saved report to open it instantly in the editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generated reports found for current filters.</p>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
              {reportList.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                  onClick={async () => {
                    setClientId(item.clientId);
                    setMonth(item.month);
                    setYear(item.year);
                    try {
                      setBusy(true);
                      const res = await apiFetch<{ report: MonthlyReport }>(
                        `/reports/monthly/${item.clientId}/${item.month}/${item.year}`
                      );
                      setReport(res.report);
                      setSourceText(res.report.sourceText || "");
                      setSelectedSection("cover");
                      toast({ title: "Report opened", description: item.title });
                    } catch (err: any) {
                      toast({ title: "Open failed", description: err.message, variant: "destructive" });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.client.company || item.client.name} • {MONTHS[item.month - 1]} {item.year}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.status === "FINALIZED" ? "default" : "secondary"}>
                        {item.status}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <div className="grid lg:grid-cols-[240px_1fr_320px] gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Sections</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {FIXED_SECTIONS.map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedSection(key)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs ${selectedSection === key ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"}`}
                >
                  {HUMAN_LABELS[key] || key}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="col-span-1 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: brandAccent }} />
                Live Preview - {HUMAN_LABELS[selectedSection]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="border rounded-2xl bg-white min-h-[600px] relative overflow-hidden shadow-2xl transition-all duration-500 font-sans"
                style={{
                  color: selectedSection === "thankYou" ? "#ffffff" : "#0f172a",
                  background: selectedSection === "thankYou" ? "#0f172a" : "#ffffff",
                }}
              >
                {/* Lexpose Decorative Shapes - Live Preview Version */}
                <div style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  border: `8px solid ${settings.primaryColor || "#5A428A"}`,
                  borderRadius: "50%",
                  opacity: 0.6,
                  zIndex: 0
                }} />
                <div style={{
                  position: "absolute",
                  bottom: -40,
                  left: -40,
                  width: 180,
                  height: 180,
                  border: "1px solid #e2e8f0",
                  borderRadius: "50%",
                  zIndex: 0
                }} />

                <div className="relative z-10 p-10 h-full flex flex-col gap-6">
                  {selectedSection === "cover" ? (
                    <div className="flex flex-col justify-between h-full min-h-[500px] relative px-4 py-2">
                      <div style={{ position: "absolute", inset: -40, zIndex: -1, background: `linear-gradient(140deg, ${brandPrimary}1f 0%, ${brandPrimary}10 38%, #ffffff 100%)` }} />

                      <div className="flex items-center justify-between">
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: brandPrimary, textTransform: "uppercase" }}>
                          Performance Report
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: brandMuted }}>
                          {MONTHS[month - 1]} {year}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div style={{ width: 56, height: 4, background: brandAccent, borderRadius: 999 }} />
                        <h1 className="text-6xl font-[800] tracking-tighter leading-[0.92] text-slate-900">
                          SOCIAL MEDIA<br />
                          <span style={{ color: brandPrimary }}>MONTHLY REPORT</span>
                        </h1>
                        <p className="text-sm font-semibold text-slate-500 max-w-[520px]">
                          Strategy, performance and growth insights tailored to your brand.
                        </p>
                      </div>

                      <div className="flex items-end justify-between gap-4">
                        <div
                          className="px-6 py-4 rounded-2xl inline-flex items-center gap-3 text-lg font-bold shadow-xl"
                          style={{ background: brandPrimary, color: "#fff", width: "fit-content" }}
                        >
                          {selectedClient?.company || selectedClient?.name || "CLIENT NAME"}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: brandAccent, textTransform: "uppercase" }}>
                          Powered by {settings.agencyName || "Your Agency"}
                        </div>
                      </div>
                    </div>
                  ) : selectedSection === "thankYou" ? (
                    <div
                      className="flex flex-col items-center justify-center h-full min-h-[500px] text-center relative overflow-hidden px-6"
                      style={{ color: "#ffffff" }}
                    >
                      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 28% 18%, ${brandPrimary}80 0%, transparent 55%), radial-gradient(circle at 78% 80%, ${brandPrimary}45 0%, transparent 45%), ${brandPrimary}` }} />
                      <div style={{ position: "relative", zIndex: 2, maxWidth: 680 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 6, color: "#ffffff", textTransform: "uppercase", marginBottom: 18, opacity: 0.9 }}>
                          Thank You
                        </div>
                        <h2 style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.9, letterSpacing: -2, marginBottom: 16 }}>
                          LET'S KEEP<br />GROWING.
                        </h2>
                        <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                          {selectedSectionData?.content?.body || selectedSectionData?.content?.summary || "Thank you for trusting our team with your brand journey."}
                        </p>
                        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 28, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                          {settings.website && <span>{settings.website.replace("https://", "").replace("http://", "")}</span>}
                          {settings.adminEmail && <span>{settings.adminEmail}</span>}
                        </div>
                      </div>
                    </div>
                  ) : selectedSection === "tableOfContents" ? (
                    <div className="flex flex-col h-full min-h-[500px] py-2">
                      <div className="mb-4">
                        <div style={{ fontSize: 10, fontWeight: 800, color: brandPrimary, textTransform: "uppercase", letterSpacing: 4, marginBottom: 8 }}>
                          Report Structure
                        </div>
                        <h2 className="text-4xl font-[800] tracking-tight leading-none text-slate-900">
                          TABLE OF CONTENTS
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3 flex-1 content-start">
                        {FIXED_SECTIONS
                          .filter((key) => key !== "cover" && key !== "tableOfContents")
                          .map((key, i) => (
                            <div
                              key={key}
                              className="rounded-2xl border bg-white p-3.5 flex items-center gap-3"
                              style={{ borderColor: brandBorder }}
                            >
                              <div
                                className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0"
                                style={{ background: brandPrimary }}
                              >
                                {(i + 1).toString().padStart(2, "0")}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: brandAccent }}>
                                  Section
                                </div>
                                <div className="text-xs font-bold text-slate-800 truncate">
                                  {HUMAN_LABELS[key] || key}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      <div
                        className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between"
                        style={{ background: brandPrimary, color: "#fff" }}
                      >
                        <div className="text-[10px] font-bold tracking-wide uppercase">
                          {settings.agencyName || "Agency"}
                        </div>
                        <div className="text-[10px] font-semibold opacity-90">
                          {MONTHS[month - 1]} {year}
                        </div>
                      </div>
                    </div>
                  ) : selectedSection === "swotAnalysis" ? (
                    <div className="flex flex-col gap-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { title: "Strengths", key: "strengths", bg: `${brandPrimary}08`, accent: brandPrimary },
                          { title: "Weaknesses", key: "weakness", bg: `${brandAccent}08`, accent: brandAccent },
                          { title: "Opportunities", key: "opportunities", bg: `${brandPrimary}05`, accent: brandPrimary },
                          { title: "Threats", key: "threats", bg: `${brandDark}05`, accent: brandDark },
                        ].map((item) => (
                           <div key={item.key} style={{ background: item.bg, border: `1px solid ${item.accent}15` }} className="p-5 rounded-3xl flex flex-col gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ background: item.accent }} />
                                <div className="text-sm font-bold text-slate-900">{item.title}</div>
                              </div>
                              <div className="flex flex-col gap-1">
                                {(Array.isArray(selectedSectionData?.content?.[item.key])
                                  ? selectedSectionData.content[item.key]
                                  : item.key === "weakness" && Array.isArray(selectedSectionData?.content?.weaknesses)
                                  ? selectedSectionData.content.weaknesses
                                  : ["Click to add"]).slice(0, 3).map((v: string, j: number) => (
                                  <div key={j} className="flex gap-2 items-start text-[11px] font-medium text-slate-600">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                                    {v}
                                  </div>
                                ))}
                              </div>
                           </div>
                        ))}
                      </div>
                    </div>
                  ) : selectedSection === "nextSteps" ? (
                    <div className="flex flex-col gap-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { title: "Content", img: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop" },
                          { title: "Market", img: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1974&auto=format&fit=crop" },
                        ].map((item, i) => (
                          <div key={i} className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
                             <img src={item.img} className="h-24 w-full object-cover" alt="" />
                             <div className="p-4">
                               <div className="text-xs font-bold text-slate-900 mb-1">{item.title}</div>
                               <p className="text-[10px] text-slate-500 font-medium">Strategize and scale.</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <div style={{ 
                          fontSize: 10, 
                          fontWeight: 800, 
                          color: brandPrimary,
                          textTransform: "uppercase", 
                          letterSpacing: 4,
                          marginBottom: 8
                        }}>
                          {HUMAN_LABELS[selectedSection] || "Analysis Section"}
                        </div>
                        <h2 className="text-4xl font-[800] tracking-tighter leading-none">
                          {(selectedSectionData?.content?.title || HUMAN_LABELS[selectedSection]).toUpperCase()}
                        </h2>
                      </div>

                      <div className="grid md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                            {selectedSectionData?.content?.body || selectedSectionData?.content?.summary || "Add content in the editor to see it here."}
                          </p>
                          
                          {Array.isArray(selectedSectionData?.content?.bullets) && selectedSectionData.content.bullets.length > 0 && (
                            <div className="space-y-2 pt-4">
                              {selectedSectionData.content.bullets.map((b: string, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: brandPrimary }} />
                                  {b}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-8">
                          {["instagramInsights", "facebookInsights", "tiktokInsights"].includes(selectedSection) && (
                            <div className="grid grid-cols-2 gap-4">
                               {["Followers", "Views", "Likes", "Comments", "Shares", "Saves"].map((m, idx) => (
                                <div key={m} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col gap-1">
                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m}</div>
                                  <div className="text-2xl font-[800] tracking-tighter text-slate-900 leading-none">
                                    {selectedSectionData?.content?.[m.toLowerCase()] || "0"}
                                  </div>
                                  <div className="text-[9px] font-bold mt-1 flex items-center gap-1" style={{ color: brandAccent }}>
                                    <Sparkles className="h-2 w-2" /> +{Math.floor(Math.random() * 12) + 3}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {selectedSectionData?.content?.imageUrl &&
                            renderMobileMockup(selectedSectionData.content.imageUrl, {
                              maxWidth: selectedSection.includes("TopPost") ? 220 : 200,
                              caption: selectedSectionData?.content?.imageCaption || undefined,
                              variant: selectedSection.includes("TopPost") ? "iphone17promax" : "default",
                              isVideo: ["tiktokTopPost", "instagramTopPost"].includes(selectedSection)
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Content Editor</span>
                <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                  {HUMAN_LABELS[selectedSection] || selectedSection}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4 p-3 rounded-lg border bg-muted/20">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Section Title</Label>
                  <Input
                    className="bg-background font-semibold"
                    value={selectedSectionData?.content?.title || ""}
                    onChange={(e) => updateCurrentSection({ title: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Main Content / Summary</Label>
                  <Textarea
                    className="min-h-[180px] bg-background leading-relaxed"
                    value={selectedSectionData?.content?.body || selectedSectionData?.content?.summary || ""}
                    onChange={(e) => updateCurrentSection({ body: e.target.value })}
                  />
                </div>
              </div>

              {["instagramInsights", "facebookInsights", "tiktokInsights", "instagramTopPost", "facebookTopPost", "tiktokTopPost"].includes(selectedSection) && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  {["Followers", "Views", "Likes", "Comments", "Shares", "Saves"].map((m) => {
                    if (selectedSection.includes("TopPost") && ["Followers"].includes(m)) return null;
                    return (
                      <div key={m} className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-tight opacity-70">{m}</Label>
                        <Input
                          className="h-8 text-xs bg-background"
                          value={selectedSectionData?.content?.[m.toLowerCase()] || ""}
                          onChange={(e) => updateCurrentSection({ [m.toLowerCase()]: e.target.value })}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Key Bullets (one per line)</Label>
                <Textarea
                  className="min-h-[130px] bg-background text-xs leading-5"
                  placeholder="• Highlight 1\n• Highlight 2\n• Highlight 3"
                  value={bulletsDraft}
                  onChange={(e) => {
                    const nextText = e.target.value;
                    setBulletsDraft(nextText);
                    updateCurrentSection({ bullets: parseBulletLines(nextText) });
                  }}
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Feature Image</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      className="pr-10 bg-background cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPlaceholder(file);
                      }}
                    />
                    <Upload className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <Button type="button" variant="outline" size="icon" className="shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {report && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden>
          <style>{`
            .pdf-page, .pdf-page * { box-sizing: border-box; }
            .pdf-page * { max-width: 100%; }
            .pdf-page img { display: block; object-fit: cover; }
          `}</style>
          <div style={{ display: "grid", gap: 24 }}>
            {report.sections.map((section, index) => {
              const isCover = section.key === "cover";
              const isToc = section.key === "tableOfContents";
              const isInsight = ["instagramInsights", "facebookInsights", "tiktokInsights"].includes(section.key);
              const isTopPost = ["instagramTopPost", "facebookTopPost", "tiktokTopPost"].includes(section.key);
              const isVideo = section.key === "tiktokTopPost" || section.key === "instagramTopPost";
              const isSwot = section.key === "swotAnalysis";
              const isNextSteps = section.key === "nextSteps";
              const isThankYou = section.key === "thankYou";
              const pageTitle = section.content?.title || HUMAN_LABELS[section.key] || section.key;
              const sectionBody = section.content?.body || section.content?.summary || "Not provided";
              const bullets: string[] = Array.isArray(section.content?.bullets) ? section.content.bullets : [];
              const platformColor =
                section.key.startsWith("instagram") ? "#E1306C" :
                section.key.startsWith("facebook") ? "#1877F2" :
                section.key.startsWith("tiktok") ? "#111827" :
                settings.primaryColor || "#5A428A";

              return (
                <div
                  key={section.key}
                  ref={(node) => { pdfPagesRef.current[section.key] = node; }}
                  className="pdf-page"
                  style={{
                    width: PDF_PAGE_WIDTH,
                    height: PDF_PAGE_HEIGHT,
                    fontFamily: "'Inter', sans-serif",
                    position: "relative",
                    overflow: "hidden",
                    background: "#ffffff",
                    color: "#0f172a",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* ════════════════════════════════════════════════════════════
                      COVER PAGE — Cinematic Split
                  ════════════════════════════════════════════════════════════ */}
                  {isCover && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, position: "relative", overflow: "hidden", background: "#ffffff", display: "flex", flexDirection: "column", padding: "90px 100px 80px" }}>
                      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(140deg, ${brandPrimary}20 0%, ${brandPrimary}12 40%, #ffffff 100%)` }} />
                      <div style={{ position: "absolute", top: -220, right: -140, width: 540, height: 540, borderRadius: "50%", background: `${brandPrimary}24` }} />
                      <div style={{ position: "absolute", bottom: -200, left: -100, width: 480, height: 480, borderRadius: "50%", background: `${brandPrimary}14` }} />

                      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 80 }}>
                        {settings.logo ? (
                          <img src={settings.logo} alt="" style={{ height: 58, objectFit: "contain" }} />
                        ) : (
                          <div style={{ fontSize: 28, fontWeight: 900, color: brandDark, letterSpacing: -0.8 }}>
                            {settings.agencyName || "AGENCY"}
                          </div>
                        )}
                        <div style={{ padding: "10px 22px", borderRadius: 999, border: `1px solid ${brandBorder}`, color: brandPrimary, fontSize: 14, fontWeight: 800, letterSpacing: 1.2 }}>
                          {MONTHS[month - 1].toUpperCase()} {year}
                        </div>
                      </div>

                      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 980 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26 }}>
                          <div style={{ width: 56, height: 4, borderRadius: 999, background: brandAccent }} />
                          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 5, color: brandPrimary, textTransform: "uppercase" }}>
                            Monthly Performance Brief
                          </div>
                        </div>
                        <h1 style={{ fontSize: 112, fontWeight: 900, color: brandDark, lineHeight: 0.9, letterSpacing: -5, marginBottom: 18 }}>
                          SOCIAL MEDIA<br /><span style={{ color: brandPrimary }}>REPORT</span>
                        </h1>
                        <p style={{ fontSize: 26, lineHeight: 1.45, color: "#475569", fontWeight: 500, maxWidth: 850 }}>
                          Performance highlights, strategic direction, and growth opportunities for your digital channels.
                        </p>
                      </div>

                      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "end", marginTop: 56 }}>
                        <div style={{ padding: "20px 36px", borderRadius: 18, background: brandPrimary, color: "#ffffff", fontSize: 32, fontWeight: 800, letterSpacing: -0.5, boxShadow: `0 20px 40px ${brandPrimary}33` }}>
                          {selectedClient?.company || selectedClient?.name || "CLIENT NAME"}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.4, color: brandAccent, textTransform: "uppercase", marginBottom: 8 }}>
                            Prepared by
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: brandDark }}>
                            {settings.agencyName || "Your Agency"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════════
                      TABLE OF CONTENTS
                  ════════════════════════════════════════════════════════════ */}
                  {isToc && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, display: "flex", flexDirection: "column", background: "#ffffff" }}>
                      <div style={{ paddingTop: 20, flexShrink: 0 }}>
                        {renderReportHeader({
                          title: "Table of Contents",
                          subtitle: `${MONTHS[month - 1]} ${year}`,
                        })}
                      </div>
                      <div style={{ flex: 1, padding: "6px 100px 42px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignContent: "start" }}>
                        {report.sections.filter(s => s.key !== "cover" && s.key !== "tableOfContents").map((s, i) => (
                           <div key={s.key} style={{ 
                             display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                             background: "#ffffff", borderRadius: 12, border: `1px solid ${brandBorder}` 
                           }}>
                             <div style={{ 
                               width: 32, height: 32, borderRadius: "50%", background: brandPrimary, color: "#fff",
                               display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 
                             }}>
                               {(i + 1).toString().padStart(2, "0")}
                             </div>
                             <div>
                               <div style={{ fontSize: 9, fontWeight: 800, color: brandPrimary, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 2 }}>Section</div>
                               <div style={{ fontSize: 15, fontWeight: 800, color: brandDark, letterSpacing: -0.2 }}>{s.content?.title || HUMAN_LABELS[s.key]}</div>
                             </div>
                           </div>
                        ))}
                      </div>
                      {renderFooter()}
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════════
                      PLATFORM INSIGHTS (Instagram / Facebook / TikTok)
                  ════════════════════════════════════════════════════════════ */}
                  {isInsight && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, display: "flex", flexDirection: "column", background: "#ffffff" }}>
                      <div style={{ paddingTop: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
                        {renderReportHeader({
                          title: pageTitle.toUpperCase(),
                          subtitle: `${MONTHS[month - 1]} ${year}`,
                        })}
                        <div style={{ width: 80, height: 80, borderRadius: 24, background: platformColor + "15", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 100, marginTop: 26 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: platformColor }} />
                        </div>
                      </div>

                      <div style={{ flex: 1, padding: "18px 100px 8px", display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 34 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div style={{ padding: "28px", borderRadius: 18, background: brandLight, border: `1px solid ${brandBorder}` }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: brandMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
                              Followers Increased
                            </div>
                            <div style={{ fontSize: 54, fontWeight: 900, color: brandPrimary, letterSpacing: -2, lineHeight: 1 }}>
                              {section.content?.growth || "0"}%
                            </div>
                          </div>
                          <div style={{ padding: "24px 28px", borderRadius: 18, border: `1px solid ${brandBorder}` }}>
                            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#475569", fontWeight: 500 }}>
                              {sectionBody}
                            </p>
                          </div>
                        </div>

                        <div style={{ border: `1px solid ${brandBorder}`, borderRadius: 18, overflow: "hidden", background: "#fff" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: brandLight, borderBottom: `1px solid ${brandBorder}` }}>
                            <div style={{ padding: "14px 16px", fontSize: 11, fontWeight: 800, color: brandMuted, textTransform: "uppercase", letterSpacing: 1 }}>Metric</div>
                            <div style={{ padding: "14px 16px", fontSize: 11, fontWeight: 800, color: brandMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                              {MONTHS[(month + 10) % 12]} {month === 1 ? year - 1 : year}
                            </div>
                            <div style={{ padding: "14px 16px", fontSize: 11, fontWeight: 800, color: brandPrimary, textTransform: "uppercase", letterSpacing: 1 }}>
                              {MONTHS[month - 1]} {year}
                            </div>
                          </div>

                          {[
                            { label: "Followers", key: "followers" },
                            { label: "Reels Views", key: "views" },
                            { label: "Likes", key: "likes" },
                            { label: "Comments", key: "comments" },
                            { label: "Saves", key: "saves" },
                            { label: "Shares", key: "shares" },
                          ].map((m, i) => (
                            <div key={m.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: i === 5 ? "none" : `1px solid ${brandBorder}` }}>
                              <div style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: brandDark }}>{m.label}</div>
                              <div style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                                {section.content?.[`prev${m.key[0].toUpperCase()}${m.key.slice(1)}`] || "--"}
                              </div>
                              <div style={{ padding: "14px 16px", fontSize: 15, fontWeight: 800, color: brandDark }}>
                                {section.content?.[m.key] || "0"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {renderFooter()}
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════════
                      TOP POST SHOWCASE
                  ════════════════════════════════════════════════════════════ */}
                  {isTopPost && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, display: "flex", flexDirection: "column", background: brandLight }}>
                      <div style={{ paddingTop: 20, flexShrink: 0 }}>
                        {renderReportHeader({
                          title: pageTitle.toUpperCase(),
                          subtitle: `${MONTHS[month - 1]} ${year}`,
                        })}
                      </div>
                      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 28, padding: "8px 100px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", borderRadius: 20, border: `1px solid ${brandBorder}` }}>
                          {renderMobileMockup(section.content?.imageUrl, {
                            maxWidth: 340,
                            caption: section.content?.imageCaption,
                            variant: "iphone17promax",
                            isVideo: isVideo
                          })}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: brandPrimary, textTransform: "uppercase", letterSpacing: 1.6 }}>
                            {MONTHS[month - 1]} {year}
                          </div>
                          <h2 style={{ fontSize: 64, fontWeight: 900, color: brandDark, letterSpacing: -2, lineHeight: 0.95 }}>
                            {(section.key.startsWith("instagram") ? "INSTAGRAM" : section.key.startsWith("facebook") ? "FACEBOOK" : "TIKTOK")}<br />
                            TOP POST
                          </h2>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            {[
                              { label: "Likes", key: "likes" },
                              { label: "Comments", key: "comments" },
                              { label: "Shares", key: "shares" },
                              { label: "Views", key: "views" },
                            ].map((stat) => (
                              <div key={stat.key} style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: `1px solid ${brandBorder}` }}>
                                <div style={{ fontSize: 32, fontWeight: 900, color: brandDark, letterSpacing: -1, lineHeight: 1 }}>
                                  {section.content?.[stat.key] || "0"}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: brandMuted, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 4 }}>
                                  {stat.label}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div style={{ padding: "18px 20px", borderRadius: 14, border: `1px solid ${brandBorder}`, background: "#fff" }}>
                            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#475569", fontWeight: 500 }}>
                              {sectionBody}
                            </p>
                          </div>
                        </div>
                      </div>
                      {renderFooter()}
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════════
                      SWOT ANALYSIS — Premium 2x2
                  ════════════════════════════════════════════════════════════ */}
                  {isSwot && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, display: "flex", flexDirection: "column", background: "#ffffff" }}>
                      <div style={{ paddingTop: 20 }}>
                        {renderReportHeader({
                          title: "SWOT ANALYSIS",
                          subtitle: `${MONTHS[month - 1]} ${year}`,
                        })}
                      </div>

                      <div style={{ flex: 1, padding: "12px 100px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 20 }}>
                        {[
                          { title: "Strength", key: "strengths", bg: `${brandPrimary}06`, accent: brandPrimary },
                          { title: "Weakness", key: "weakness", bg: `${brandAccent}08`, accent: brandAccent },
                          { title: "Opportunity", key: "opportunities", bg: `${brandPrimary}06`, accent: brandPrimary },
                          { title: "Threats", key: "threats", bg: `${brandDark}05`, accent: brandDark },
                        ].map((item) => (
                           <div key={item.key} style={{ background: item.bg, padding: "24px 26px", borderRadius: 14, border: `1px solid ${item.accent}24`, display: "flex", flexDirection: "column", gap: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.accent }} />
                                <div style={{ fontSize: 21, fontWeight: 900, color: brandDark, letterSpacing: -0.5 }}>{item.title}</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                {(Array.isArray(section.content?.[item.key])
                                  ? section.content[item.key]
                                  : item.key === "weakness" && Array.isArray(section.content?.weaknesses)
                                  ? section.content.weaknesses
                                  : ["To be defined"]).map((v: string, j: number) => (
                                  <div key={j} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.accent, marginTop: 7, flexShrink: 0 }} />
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#334155", lineHeight: 1.45 }}>{v}</div>
                                  </div>
                                ))}
                              </div>
                           </div>
                        ))}
                      </div>
                      {renderFooter()}
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════════
                      NEXT STEPS
                  ════════════════════════════════════════════════════════════ */}
                  {isNextSteps && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, display: "flex", flexDirection: "column", background: "#ffffff" }}>
                      <div style={{ paddingTop: 20 }}>
                        {renderReportHeader({
                          title: "NEXT STEPS",
                          subtitle: "Upcoming Strategy",
                        })}
                      </div>

                      <div style={{ flex: 1, padding: "12px 100px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 16 }}>
                        {[
                          { title: "Content Creation" },
                          { title: "Engagement Strategy" },
                          { title: "Ad Strategy" },
                          { title: "Performance Tracking" },
                        ].map((item, i) => (
                           <div key={i} style={{ display: "flex", gap: 18, padding: "24px", borderRadius: 14, background: "#fff", border: `1px solid ${brandBorder}`, alignItems: "flex-start" }}>
                             <div style={{ width: 46, height: 46, borderRadius: "50%", background: brandPrimary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, flexShrink: 0 }}>
                                {(i + 1).toString().padStart(2, "0")}
                             </div>
                             <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: brandAccent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 4 }}>Phase 0{i+1}</div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: brandDark, marginBottom: 8, letterSpacing: -0.4 }}>{item.title}</div>
                                <p style={{ fontSize: 14, lineHeight: 1.65, color: brandMuted, fontWeight: 500 }}>
                                  {bullets[i] || "Strategic scaling and optimization for maximum impact."}
                                </p>
                             </div>
                           </div>
                        ))}
                      </div>
                      {renderFooter()}
                    </div>
                  )}
                  {/* ════════════════════════════════════════════════════════════
                      THANK YOU — Premium Finale
                  ════════════════════════════════════════════════════════════ */}
                  {isThankYou && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, background: brandPrimary, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "90px 100px 80px" }}>
                      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 20% 15%, ${brandPrimary}9a 0%, transparent 50%), radial-gradient(circle at 85% 80%, ${brandPrimary}5e 0%, transparent 45%), ${brandPrimary}` }} />

                      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {settings.logo ? (
                          <img src={settings.logo} alt="" style={{ height: 64, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                        ) : (
                          <div style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: -0.6 }}>
                            {(settings.agencyName || "AGENCY").toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "#ffffff", textTransform: "uppercase", opacity: 0.9 }}>
                          Thank You Page
                        </div>
                      </div>

                      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ maxWidth: 920 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                            <div style={{ width: 56, height: 3, borderRadius: 999, background: "#ffffff" }} />
                            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 6, color: "#ffffff", textTransform: "uppercase", opacity: 0.9 }}>
                              Partnership
                            </div>
                          </div>

                          <h2 style={{ fontSize: 124, fontWeight: 900, color: "#fff", lineHeight: 0.86, letterSpacing: -7, marginBottom: 28 }}>
                            THANK<br />YOU
                          </h2>

                          <p style={{ fontSize: 26, fontWeight: 500, color: "rgba(255,255,255,0.78)", lineHeight: 1.55, maxWidth: 860 }}>
                            {sectionBody || "Thank you for your trust. We are committed to driving the next stage of your brand's growth."}
                          </p>
                        </div>
                      </div>

                      <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28 }}>
                        {[
                          { label: "Website", val: settings.website || "youragency.com" },
                          { label: "Email", val: settings.adminEmail || "hello@youragency.com" },
                          { label: "Phone", val: settings.phone || "+000 000 0000" },
                        ].map((item) => (
                          <div key={item.label} style={{ padding: "22px 24px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#ffffff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, opacity: 0.95 }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: "#ffffff", wordBreak: "break-word" }}>
                              {item.val}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════════
                      DEFAULT CONTENT SECTION (overview / objectives / etc.)
                  ════════════════════════════════════════════════════════════ */}
                  {!isCover && !isToc && !isInsight && !isTopPost && !isSwot && !isNextSteps && !isThankYou && (
                    <div style={{ width: "100%", height: PDF_PAGE_HEIGHT, display: "flex", flexDirection: "column", background: "#ffffff" }}>
                      {/* Section Header */}
                      <div style={{ paddingTop: 20 }}>
                        {renderReportHeader({
                          title: pageTitle.toUpperCase(),
                          subtitle: `${MONTHS[month - 1]} Report`,
                        })}
                      </div>

                      {/* Content Area */}
                      <div style={{ flex: 1, padding: "20px 100px 40px" }}>
                        {section.key === "objectives" ? (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                            {[
                              "Increase Brand Visibility and Awareness",
                              "Drive Customer Engagement",
                              "Boost Conversion Rates and Sales",
                            ].map((goal, i) => (
                              <div key={goal} style={{ border: `1px solid ${brandBorder}`, borderRadius: 14, padding: "22px 20px", background: "#fff" }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: brandAccent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8 }}>
                                  Objective 0{i + 1}
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: brandDark, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 10 }}>
                                  {goal}
                                </div>
                                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
                                  {bullets[i] || "Focus execution and consistency to improve performance this month."}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : section.key === "targetAudience" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#475569", fontWeight: 500 }}>
                              {sectionBody}
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                              {["Demographics", "Psychographics", "Engagement Behavior"].map((label, idx) => (
                                <div key={label} style={{ border: `1px solid ${brandBorder}`, borderRadius: 14, padding: "18px", background: "#fff" }}>
                                  <div style={{ fontSize: 12, fontWeight: 900, color: brandPrimary, marginBottom: 10 }}>{label}</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {(bullets.slice(idx * 2, idx * 2 + 3).length ? bullets.slice(idx * 2, idx * 2 + 3) : ["Data point pending"]).map((b, i) => (
                                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: brandAccent, marginTop: 7 }} />
                                        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#475569", fontWeight: 600 }}>{b}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : section.key === "competitors" ? (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                            {(bullets.length ? bullets.slice(0, 3) : ["Te'Amo", "Competitor A", "Competitor B"]).map((name, i) => (
                              <div key={i} style={{ border: `1px solid ${brandBorder}`, borderRadius: 16, padding: "24px", background: brandLight }}>
                                <div style={{ fontSize: 26, fontWeight: 900, color: brandDark, letterSpacing: -0.5, marginBottom: 10 }}>{name}</div>
                                <div style={{ width: "100%", height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 8 }}>
                                  <div style={{ width: `${70 - i * 15}%`, height: "100%", background: i === 0 ? brandPrimary : brandAccent }} />
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: brandMuted }}>Relative social traction benchmark</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 34 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                              <p style={{ fontSize: 17, lineHeight: 1.75, color: "#475569", fontWeight: 500 }}>
                                {sectionBody}
                              </p>
                              {section.content?.imageUrl && (
                                <div style={{ marginTop: 8 }}>
                                  {renderMobileMockup(section.content.imageUrl, { maxWidth: 260, caption: section.content?.imageCaption })}
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, color: brandPrimary, textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 10 }}>
                                Key Highlights
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {(bullets.length ? bullets : ["Insight point one", "Insight point two"]).map((b, i) => (
                                  <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: `1px solid ${brandBorder}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: brandPrimary, marginTop: 7, flexShrink: 0 }} />
                                    <div style={{ fontSize: 14, fontWeight: 700, color: brandDark, lineHeight: 1.45 }}>{b}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {renderFooter()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
