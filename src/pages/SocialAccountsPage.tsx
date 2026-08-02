import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { AccountsSkeleton } from "@/components/ui/PageSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Settings, RefreshCw, Trash2, CheckCircle2, AlertTriangle,
  Link as LinkIcon, Building2, Search, ChevronDown, ChevronUp,
  Activity, Users, Zap, ShieldAlert, Clock, BarChart3, ArrowRight,
  Globe, X, Check, ExternalLink, AlertCircle, Sparkles, Upload, FileText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SocialAccount {
  id: string; clientId: string; platform: string;
  platformUserId: string; platformUsername: string; displayName: string;
  avatarUrl: string | null; pageId: string | null; igAccountId: string | null;
  healthStatus: string; healthMessage: string | null;
  groupName: string | null; groupColor: string | null;
  isActive: boolean; tokenExpiresAt: string | null;
  createdAt: string; updatedAt: string;
  lastSync: string | null;
  capabilities?: Record<string, boolean>;
}

interface Workspace {
  clientId: string; clientName: string; clientCompany: string;
  healthStatus: "healthy" | "warning" | "critical" | "empty";
  accounts: SocialAccount[]; connectedPlatforms: string[];
  missingPlatforms: string[]; lastPublish: string | null;
  lastSync: string | null; totalFollowers: number; accountCount: number;
}

interface WorkspaceSummary {
  summary: { totalWorkspaces: number; totalAccounts: number; activePlatforms: number; needsAttention: number };
  workspaces: Workspace[];
}

interface Client { id: string; name: string; company: string; }
interface ActivityEvent { type: string; label: string; detail?: string; date: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "facebook",  label: "Facebook Page",      color: "#1877F2", bg: "bg-blue-50 text-blue-600" },
  { id: "instagram", label: "Instagram Business",  color: "#E1306C", bg: "bg-pink-50 text-pink-600" },
  { id: "linkedin",  label: "LinkedIn Company",    color: "#0A66C2", bg: "bg-blue-50 text-blue-700" },
  { id: "youtube",   label: "YouTube Channel",     color: "#FF0000", bg: "bg-red-50 text-red-600"  },
  { id: "tiktok",    label: "TikTok Profile",      color: "#000000", bg: "bg-slate-50 text-slate-800" },
  { id: "x",         label: "X / Twitter",         color: "#14171A", bg: "bg-zinc-50 text-zinc-800"  },
  { id: "threads",   label: "Meta Threads",        color: "#000000", bg: "bg-zinc-50 text-zinc-950"  },
  { id: "pinterest", label: "Pinterest Board",     color: "#BD081C", bg: "bg-red-50 text-red-700"   },
];

// Platforms whose analytics can be imported from an official XLSX export.
// TikTok Studio today; extend as we add Meta Business Suite / YouTube exporters.
const IMPORTABLE_PLATFORMS = ["tiktok"];

const CAPABILITIES: Record<string, Record<string, boolean>> = {
  facebook:  { Publishing: true, Analytics: true, Comments: true, Messages: true, Reels: true, Stories: true },
  instagram: { Publishing: true, Analytics: true, Comments: true, Messages: false, Reels: true, Stories: true },
  linkedin:  { Publishing: true, Analytics: true, Comments: false, Messages: false, Reels: false, Stories: false },
  tiktok:    { Publishing: true, Analytics: true, Comments: false, Messages: false, Reels: true, Stories: false },
  youtube:   { Publishing: true, Analytics: true, Comments: false, Messages: false, Reels: true, Stories: false },
  x:         { Publishing: true, Analytics: true, Comments: true, Messages: false, Reels: false, Stories: false },
  pinterest: { Publishing: true, Analytics: false, Comments: false, Messages: false, Reels: false, Stories: false },
  threads:   { Publishing: true, Analytics: false, Comments: false, Messages: false, Reels: false, Stories: false },
};

const PlatformIcon = ({ platform, cls = "h-5 w-5 object-contain" }: { platform: string; cls?: string }) => {
  const map: Record<string, string> = {
    facebook: "/social-icons/Facebook.png", instagram: "/social-icons/instagram.png",
    threads: "/social-icons/Threads.png", tiktok: "/social-icons/tiktok.png",
    linkedin: "/social-icons/linkedin.png", youtube: "/social-icons/youtube.png",
    x: "/social-icons/twitter.png", twitter: "/social-icons/twitter.png",
    pinterest: "/social-icons/pinterest.png",
  };
  const src = map[platform?.toLowerCase()];
  return src ? <img src={src} className={cls} alt={platform} /> : <Globe className={cls} />;
};

const timeAgo = (dateStr: string | null) => {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtDate = (dateStr: string | null) => {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const HealthBadge = ({ status }: { status: string }) => {
  const cfg = {
    healthy:  { label: "Healthy",         cls: "bg-emerald-50 text-emerald-700 border-emerald-100",  dot: "bg-emerald-500" },
    warning:  { label: "Warning",         cls: "bg-amber-50 text-amber-700 border-amber-100",        dot: "bg-amber-500"   },
    critical: { label: "Needs Attention", cls: "bg-red-50 text-red-700 border-red-100",              dot: "bg-red-500"     },
    empty:    { label: "No Accounts",     cls: "bg-muted text-muted-foreground border-border/50",    dot: "bg-muted-foreground" },
  }[status] || { label: status, cls: "bg-muted text-muted-foreground border-border/50", dot: "bg-muted-foreground" };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${status === "critical" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
};

const EventIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    connected:     <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center"><Zap className="h-3 w-3 text-emerald-600" /></div>,
    published:     <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center"><Check className="h-3 w-3 text-blue-600" /></div>,
    failed:        <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center"><AlertCircle className="h-3 w-3 text-red-600" /></div>,
    synced:        <div className="h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center"><BarChart3 className="h-3 w-3 text-violet-600" /></div>,
    token_refreshed:<div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center"><RefreshCw className="h-3 w-3 text-amber-600" /></div>,
  };
  return icons[type] || <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"><Activity className="h-3 w-3 text-muted-foreground" /></div>;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SocialAccountsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<WorkspaceSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [platformStatus, setPlatformStatus] = useState<Record<string, { configured: boolean; enabled: boolean }>>({});
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "connected" | "warning" | "critical">("all");
  const [sortBy, setSortBy] = useState<"alpha" | "recent_sync" | "recent_publish">("alpha");
  const [expandedWorkspace, setExpandedWorkspace] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Connect wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardClientId, setWizardClientId] = useState("");
  const [wizardPlatform, setWizardPlatform] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  // Import Analytics Data dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importClientId, setImportClientId] = useState("");
  const [importAccountId, setImportAccountId] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => { fetchData(); }, []);

  // Show toast for OAuth callbacks — and return to client profile Social tab when that flow started there.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    const warning = searchParams.get("warning");
    let returnTo: string | null = null;
    try { returnTo = sessionStorage.getItem("oauth_return"); sessionStorage.removeItem("oauth_return"); } catch { /* ignore */ }
    if (connected === "true") {
      toast({ title: "✅ Account Connected!", description: "Your social account has been successfully linked." });
      if (returnTo && returnTo.startsWith("/dashboard/")) {
        navigate(returnTo);
        return;
      }
    }
    if (warning) {
      toast({
        title: "Other clients may need reconnect",
        description: decodeURIComponent(warning),
        variant: "destructive",
      });
    }
    if (error) toast({ title: "OAuth Failed", description: decodeURIComponent(error), variant: "destructive" });
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [wsData, clientsData, statusData] = await Promise.all([
        apiFetch<WorkspaceSummary>("/social/accounts/workspace-summary"),
        apiFetch<{ clients: Client[] }>("/clients"),
        apiFetch<Record<string, { configured: boolean; enabled: boolean }>>("/social/platform-status"),
      ]);
      setData(wsData);
      setClients(clientsData.clients || []);
      setPlatformStatus(statusData || {});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivity = async (accountId: string) => {
    setLoadingActivity(true);
    try {
      const res = await apiFetch<{ events: ActivityEvent[] }>(`/social/accounts/${accountId}/activity`);
      setActivityEvents(res.events || []);
    } catch { setActivityEvents([]); }
    finally { setLoadingActivity(false); }
  };

  const handleSyncAccount = async (accountId: string, name: string) => {
    try {
      await apiFetch<any>(`/social/accounts/${accountId}/sync`, { method: "POST" });
      toast({ title: `Syncing ${name}`, description: "Sync initiated successfully." });
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDisconnect = async (accountId: string, name: string) => {
    if (!confirm(
      `Disconnect ${name}?\n\nScheduled posts to this account stop immediately. ` +
      `Its published posts and analytics history are kept — reconnecting restores syncing.`
    )) return;
    try {
      const res = await apiFetch<{ message?: string }>(`/social/accounts/${accountId}`, { method: "DELETE" });
      toast({
        title: "Disconnected",
        description: res?.message || `${name} disconnected. Post history and analytics are preserved.`,
      });
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleConnect = async () => {
    if (!wizardClientId || !wizardPlatform) return;
    setIsConnecting(true);
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/social/oauth/connect?platform=${wizardPlatform}&clientId=${wizardClientId}&groupId=${wizardClientId}`
      );
      if (url) window.location.href = url;
    } catch (err: any) {
      toast({ title: "OAuth Failed", description: err.message, variant: "destructive" });
      setIsConnecting(false);
    }
  };

  // Clients who have connected social media accounts only
  const clientsWithAccounts = useMemo(() => {
    if (!data?.workspaces) return [];
    const workspacesWithAccounts = data.workspaces.filter(w => (w.accounts && w.accounts.length > 0) || w.accountCount > 0);
    const clientIdsWithAccounts = new Set(workspacesWithAccounts.map(w => w.clientId));

    const list = clients.filter(c => clientIdsWithAccounts.has(c.id) || ((c as any)._count?.socialAccounts ?? 0) > 0);
    for (const ws of workspacesWithAccounts) {
      if (!list.some(c => c.id === ws.clientId)) {
        list.push({
          id: ws.clientId,
          name: ws.clientName,
          company: ws.clientCompany || ws.clientName,
        });
      }
    }
    return list;
  }, [clients, data]);

  // Clients to show in the Import Analytics Data dropdown.
  // Shows only clients who have connected social media accounts (or falls back to all clients if none connected yet).
  const importSelectClients = useMemo(() => {
    return clientsWithAccounts.length > 0 ? clientsWithAccounts : clients;
  }, [clientsWithAccounts, clients]);

  // Validates that importClientId is actually in the allowed clients list
  const activeImportClientId = useMemo(() => {
    return importSelectClients.some(c => c.id === importClientId) ? importClientId : "";
  }, [importSelectClients, importClientId]);

  // Accounts eligible for XLSX import within the chosen client
  const importWorkspace = data?.workspaces.find(w => w.clientId === importClientId);
  const importableAccounts = (importWorkspace?.accounts || []).filter(a => IMPORTABLE_PLATFORMS.includes(a.platform.toLowerCase()));
  const selectedImportAccount = importableAccounts.find(a => a.id === importAccountId);

  const openImport = (presetClientId?: string) => {
    setImportResult(null);
    setImportFiles([]);
    setImportAccountId("");
    setImportClientId(presetClientId || "");
    setImportOpen(true);
  };

  const handleImport = async () => {
    if (!importAccountId || importFiles.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      importFiles.forEach(f => formData.append("files", f));
      // 'SKIP' lets the browser set the multipart boundary; apiFetch attaches the
      // in-memory auth token (deliberately not stored in localStorage).
      const res = await apiFetch<any>(`/social/import/tiktok/${importAccountId}`, {
        method: "POST",
        headers: { "Content-Type": "SKIP" },
        body: formData,
      });
      setImportResult(res.summary);
      const okFiles = (res.summary?.files || []).filter((f: any) => f.rows > 0).length;
      toast({ title: "✅ Import Complete", description: `Imported ${okFiles} file(s) into ${selectedImportAccount?.platformUsername || "the account"}.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Filtered + sorted workspaces
  const filteredWorkspaces = useMemo(() => {
    if (!data) return [];
    let ws = data.workspaces;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      ws = ws.filter(w =>
        w.clientName.toLowerCase().includes(q) ||
        w.clientCompany.toLowerCase().includes(q) ||
        w.accounts.some(a => a.platformUsername.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q)) ||
        w.connectedPlatforms.some(p => p.toLowerCase().includes(q))
      );
    }

    if (filterTab === "connected") ws = ws.filter(w => w.accountCount > 0 && w.healthStatus === "healthy");
    else if (filterTab === "warning") ws = ws.filter(w => w.healthStatus === "warning");
    else if (filterTab === "critical") ws = ws.filter(w => w.healthStatus === "critical");

    return [...ws].sort((a, b) => {
      if (sortBy === "alpha") return a.clientCompany.localeCompare(b.clientCompany);
      if (sortBy === "recent_sync") {
        const da = a.lastSync ? new Date(a.lastSync).getTime() : 0;
        const db = b.lastSync ? new Date(b.lastSync).getTime() : 0;
        return db - da;
      }
      if (sortBy === "recent_publish") {
        const da = a.lastPublish ? new Date(a.lastPublish).getTime() : 0;
        const db = b.lastPublish ? new Date(b.lastPublish).getTime() : 0;
        return db - da;
      }
      return 0;
    });
  }, [data, searchQuery, filterTab, sortBy]);

  const enabledPlatforms = PLATFORMS.filter(p => platformStatus[p.id]?.enabled);
  const metaEnabled = platformStatus.facebook?.enabled || platformStatus.instagram?.enabled;

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-7 max-w-screen-2xl">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Social Account Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage brand workspaces, platform integrations, and connected accounts.</p>
        </div>
        {/* Wraps instead of pushing the primary action off-screen on a phone. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl gap-2 border-border">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => openImport()} className="rounded-xl gap-2 px-4 font-bold border-violet-200 text-violet-700 hover:bg-violet-50">
            <Upload className="h-4 w-4" /> Import Data
          </Button>
          <Button onClick={() => { setWizardStep(1); setWizardClientId(""); setWizardPlatform(""); setWizardOpen(true); }} className="w-full rounded-xl gap-2 px-5 shadow-md font-bold sm:w-auto">
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">Connect Account</span>
            <span className="hidden sm:inline">Connect Social Account</span>
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Brand Workspaces",   value: data.summary.totalWorkspaces, icon: Building2,     color: "text-violet-600 bg-violet-50 border-violet-100" },
            { label: "Connected Accounts", value: data.summary.totalAccounts,   icon: Users,         color: "text-blue-600 bg-blue-50 border-blue-100"       },
            { label: "Platforms Active",   value: data.summary.activePlatforms, icon: Globe,         color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { label: "Needs Attention",    value: data.summary.needsAttention,  icon: AlertTriangle, color: data.summary.needsAttention > 0 ? "text-red-600 bg-red-50 border-red-100" : "text-muted-foreground bg-muted border-border/50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="rounded-2xl border border-border/80 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground font-semibold">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── No API Keys Warning ── */}
      {!metaEnabled && !isLoading && (
        <Card className="border-amber-200 bg-amber-50/30 rounded-2xl">
          <CardContent className="pt-5 pb-5 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">API Integrations Not Configured</p>
              <p className="text-xs text-amber-700 mt-1">
                Go to{" "}
                <button onClick={() => navigate("/dashboard/plugins")} className="font-bold underline">
                  Settings → Plugins
                </button>{" "}
                to add API keys and enable platforms before connecting accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Layout ── */}
      {/* `min-w-0` on the columns: grid items default to `min-width: auto`, so
          without it the widest child (the filter strip) pushed both columns past
          the viewport and the page overflowed sideways on a phone. */}
      <div className="grid min-w-0 lg:grid-cols-12 gap-7 items-start">

        {/* ── LEFT: API Integrations Panel ── */}
        <div className="min-w-0 lg:col-span-4 xl:col-span-3 space-y-5 lg:sticky lg:top-6">
          <Card className="rounded-2xl border border-border/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/5 border-b border-border/40 py-4 px-5">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                API Integrations
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Global platform connection status</p>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {PLATFORMS.map(p => {
                const status = platformStatus[p.id] || { configured: false, enabled: false };
                const connectedAccounts = data?.workspaces.flatMap(w => w.accounts).filter(a => a.platform.toLowerCase() === p.id).length || 0;

                return (
                  <div key={p.id} className={`rounded-xl border p-3 transition-all ${status.enabled ? "border-border/50 bg-muted/5 hover:bg-muted/10" : "border-border/30 bg-background"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/40 bg-background flex items-center justify-center shadow-sm">
                          <PlatformIcon platform={p.id} cls="h-5 w-5 object-contain" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{p.label}</p>
                          {status.enabled && connectedAccounts > 0 && (
                            <p className="text-[10px] text-muted-foreground">{connectedAccounts} account{connectedAccounts !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        status.enabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-muted text-muted-foreground border-border/60"
                      }`}>
                        {status.enabled ? "Active" : status.configured ? "Disabled" : "Not Set"}
                      </span>
                    </div>

                    {status.enabled && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {Object.entries(CAPABILITIES[p.id] || {}).filter(([, v]) => v).map(([cap]) => (
                          <span key={cap} className="text-[9px] font-bold bg-primary/5 text-primary/80 border border-primary/10 px-1.5 py-0.5 rounded-full">
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard/plugins")}
                className="w-full rounded-xl gap-2 mt-2 border-border text-xs font-semibold"
              >
                <Settings className="h-3.5 w-3.5" /> Manage API Keys
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Brand Workspaces ── */}
        <div className="min-w-0 lg:col-span-8 xl:col-span-9 space-y-5">

          {/* Search + Filter + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients, usernames, platforms..."
                className="pl-9 rounded-xl h-10 border-border"
              />
            </div>
            {/* The four tabs plus the sort select overflow 375px, so the strip
                scrolls on its own and the select drops below when needed. */}
            <div className="flex min-w-0 items-center gap-2">
              {/* Filter tabs */}
              <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-0.5 sm:flex-none">
                {[
                  { key: "all", label: "All" },
                  { key: "connected", label: "Healthy" },
                  { key: "warning", label: "Warning" },
                  { key: "critical", label: "Critical" },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterTab(tab.key as any)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${filterTab === tab.key ? "bg-background shadow-sm text-foreground border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                <SelectTrigger size="xs" className="w-auto min-w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpha">A → Z</SelectItem>
                  <SelectItem value="recent_sync">Recent Sync</SelectItem>
                  <SelectItem value="recent_publish">Recent Publish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Workspace cards */}
          {isLoading ? (
            <AccountsSkeleton />
          ) : filteredWorkspaces.length === 0 ? (
            <Card className="border-dashed py-16 flex flex-col items-center justify-center text-center rounded-2xl">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4 border shadow-inner">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-base">
                {searchQuery ? "No matching workspaces" : "No Brand Workspaces"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1 mb-6">
                {searchQuery
                  ? "Try a different search term."
                  : "Connect a client's social accounts to create their brand workspace."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setWizardOpen(true)} className="rounded-xl px-5 font-bold shadow-md gap-2">
                  <Plus className="h-4 w-4" /> Connect Social Account
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredWorkspaces.map(ws => {
                const isExpanded = expandedWorkspace === ws.clientId;
                const hasAccounts = ws.accountCount > 0;
                const missingToShow = ws.missingPlatforms.slice(0, 4);

                return (
                  <Card key={ws.clientId} className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    ws.healthStatus === "critical" ? "border-red-200" :
                    ws.healthStatus === "warning" ? "border-amber-200" :
                    "border-border/80"
                  }`}>
                    {/* Workspace header */}
                    <div className={`px-4 py-4 border-b border-border/40 sm:px-6 ${
                      ws.healthStatus === "critical" ? "bg-red-50/40" :
                      ws.healthStatus === "warning" ? "bg-amber-50/30" :
                      "bg-muted/5"
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Client avatar */}
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-primary font-black text-lg">{ws.clientCompany.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Full width on phones so the badge wraps below
                                  rather than squeezing the name to "Tok…". */}
                              <h3 className="w-full truncate font-black text-base text-foreground sm:w-auto">{ws.clientCompany}</h3>
                              <HealthBadge status={ws.healthStatus} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{ws.clientName} · {ws.accountCount} account{ws.accountCount !== 1 ? "s" : ""}</p>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setWizardClientId(ws.clientId); setWizardStep(2); setWizardOpen(true); }}
                            className="rounded-xl text-xs gap-1.5 border-border h-8"
                          >
                            <Plus className="h-3.5 w-3.5" /> Connect
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedWorkspace(isExpanded ? null : ws.clientId)}
                            className="rounded-xl h-8 w-8 p-0"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Platform icons + stats */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        {/* Connected platform icons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {ws.connectedPlatforms.map(plat => (
                            <div key={plat} className="h-7 w-7 rounded-lg border border-border/60 bg-background shadow-sm overflow-hidden flex items-center justify-center" title={plat}>
                              <PlatformIcon platform={plat} cls="h-4 w-4 object-contain" />
                            </div>
                          ))}
                          {missingToShow.map(plat => (
                            <div key={plat} className="h-7 w-7 rounded-lg border border-dashed border-border/50 bg-muted/20 flex items-center justify-center opacity-40" title={`${plat} not connected`}>
                              <PlatformIcon platform={plat} cls="h-4 w-4 object-contain grayscale" />
                            </div>
                          ))}
                          {ws.missingPlatforms.length > 4 && (
                            <span className="text-[10px] font-bold text-muted-foreground">+{ws.missingPlatforms.length - 4} more</span>
                          )}
                        </div>

                        {/* Stats */}
                        {hasAccounts && (
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-semibold">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Sync: {timeAgo(ws.lastSync)}
                            </span>
                            {ws.lastPublish && (
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                Published: {timeAgo(ws.lastPublish)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Missing platforms recommendation */}
                      {ws.missingPlatforms.length > 0 && hasAccounts && (
                        <div className="mt-3 p-2.5 rounded-xl bg-primary/3 border border-primary/8">
                          <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wide mb-1.5">
                            <Sparkles className="h-3 w-3 inline mr-1" />
                            Recommended Platforms
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ws.missingPlatforms.slice(0, 5).map(plat => (
                              <button
                                key={plat}
                                onClick={() => { setWizardClientId(ws.clientId); setWizardPlatform(plat); setWizardStep(2); setWizardOpen(true); }}
                                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-primary/15 bg-background hover:bg-primary/5 transition-all"
                              >
                                <PlatformIcon platform={plat} cls="h-3 w-3 object-contain" />
                                <span className="text-primary/80">+ {plat.charAt(0).toUpperCase() + plat.slice(1)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded: Account list */}
                    {isExpanded && (
                      <CardContent className="p-0">
                        {!hasAccounts ? (
                          <div className="py-10 text-center">
                            <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
                            <Button
                              size="sm"
                              onClick={() => { setWizardClientId(ws.clientId); setWizardStep(2); setWizardOpen(true); }}
                              className="mt-3 rounded-xl gap-1.5 font-semibold"
                            >
                              <Plus className="h-3.5 w-3.5" /> Connect Platform
                            </Button>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/40">
                            {ws.accounts.map(acc => {
                              const caps = CAPABILITIES[acc.platform.toLowerCase()] || {};
                              const isActExpanded = expandedActivity === acc.id;
                              const tokenExpiry = acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt) : null;
                              const daysToExpiry = tokenExpiry ? Math.floor((tokenExpiry.getTime() - Date.now()) / 86400000) : null;
                              const isExpiringSoon = daysToExpiry !== null && daysToExpiry < 7;

                              return (
                                <div key={acc.id} className="p-5">
                                  <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                      <div className="h-11 w-11 rounded-full border-2 border-border/60 overflow-hidden shadow-sm bg-muted/20">
                                        {acc.avatarUrl ? (
                                          <img src={acc.avatarUrl} alt={acc.displayName} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary font-black text-base">
                                            {acc.displayName.charAt(0)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm overflow-hidden">
                                        <PlatformIcon platform={acc.platform} cls="h-3.5 w-3.5 object-contain" />
                                      </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-sm text-foreground truncate">{acc.displayName}</p>
                                        {acc.healthStatus === "healthy" ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        ) : (
                                          <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                        )}
                                        {isExpiringSoon && (
                                          <span className="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full">
                                            TOKEN EXPIRES {daysToExpiry}d
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground font-mono mt-0.5">@{acc.platformUsername}</p>

                                      {/* Capability pills */}
                                      <div className="flex flex-wrap gap-1 mt-2.5">
                                        {Object.entries(caps).map(([cap, enabled]) => (
                                          <span key={cap} className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                            enabled
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                              : "bg-muted/30 text-muted-foreground/50 border-border/30 line-through"
                                          }`}>
                                            {enabled ? <Check className="h-2 w-2" /> : <X className="h-2 w-2" />}
                                            {cap}
                                          </span>
                                        ))}
                                      </div>

                                      {/* Sync time */}
                                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-semibold">
                                        <span>Sync: {timeAgo(acc.lastSync)}</span>
                                        {acc.tokenExpiresAt && daysToExpiry !== null && daysToExpiry > 0 && (
                                          <span>Token: {daysToExpiry}d left</span>
                                        )}
                                      </div>

                                      {acc.healthStatus !== "healthy" && acc.healthMessage && (
                                        <div className="mt-2.5 text-[11px] text-red-600 bg-red-50/50 border border-red-100 px-2 py-1 rounded font-medium">
                                          ⚠️ {acc.healthMessage}
                                        </div>
                                      )}
                                    </div>

                                    {/* Account actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          if (isActExpanded) {
                                            setExpandedActivity(null);
                                          } else {
                                            setExpandedActivity(acc.id);
                                            await fetchActivity(acc.id);
                                          }
                                        }}
                                        className="rounded-xl h-8 text-xs gap-1.5 border-border"
                                      >
                                        <Activity className="h-3 w-3" /> Logs
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSyncAccount(acc.id, acc.displayName)}
                                        className="rounded-xl h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                        title="Sync"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDisconnect(acc.id, acc.displayName)}
                                        className="rounded-xl h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                        title="Disconnect"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Activity feed */}
                                  {isActExpanded && (
                                    <div className="mt-4 ml-15 pl-4 border-l-2 border-border/40 space-y-2">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Activity Log</p>
                                      {loadingActivity ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                          <RefreshCw className="h-3 w-3 animate-spin" /> Loading activity...
                                        </div>
                                      ) : activityEvents.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-2">No activity recorded yet.</p>
                                      ) : (
                                        activityEvents.map((evt, i) => (
                                          <div key={i} className="flex items-start gap-2.5">
                                            <EventIcon type={evt.type} />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold text-foreground">{evt.label}</p>
                                              {evt.detail && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{evt.detail}</p>}
                                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{fmtDate(evt.date)}</p>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Connect Wizard Dialog ── */}
      <Dialog open={wizardOpen} onOpenChange={open => { setWizardOpen(open); if (!open) setWizardStep(1); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="border-b border-border/40 bg-muted/5 px-7 py-5">
            <DialogTitle className="font-black text-lg">Connect Social Account</DialogTitle>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-3">
              {["Select Client", "Choose Platform", "Authenticate"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                    wizardStep === i + 1
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : wizardStep > i + 1
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-muted text-muted-foreground border-border/50"
                  }`}>
                    {wizardStep > i + 1 ? <CheckCircle2 className="h-3 w-3" /> : <span>{i + 1}</span>}
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6">
            {/* Step 1: Select Client */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Choose the client (brand workspace) to connect an account to.</p>
                <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setWizardClientId(c.id); setWizardStep(2); }}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:border-primary hover:bg-primary/3 ${
                        wizardClientId === c.id ? "border-primary bg-primary/5" : "border-border/60 bg-background"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-black text-base">{c.company.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{c.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard/clients/add")}
                  className="w-full rounded-xl gap-2 border-dashed"
                >
                  <Plus className="h-4 w-4" /> Create New Client
                </Button>
              </div>
            )}

            {/* Step 2: Choose Platform */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose the platform to connect for{" "}
                  <strong>{clients.find(c => c.id === wizardClientId)?.company || "this client"}</strong>.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PLATFORMS.map(p => {
                    const status = platformStatus[p.id] || { enabled: false };
                    const isEnabled = status.enabled;
                    return (
                      <button
                        key={p.id}
                        disabled={!isEnabled}
                        onClick={() => setWizardPlatform(p.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                          !isEnabled
                            ? "opacity-40 cursor-not-allowed border-border/30 bg-muted/20"
                            : wizardPlatform === p.id
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border/60 bg-background hover:border-primary/40 hover:bg-primary/3"
                        }`}
                      >
                        <div className="h-10 w-10 rounded-xl border border-border/40 bg-background overflow-hidden flex items-center justify-center shadow-sm">
                          <PlatformIcon platform={p.id} cls="h-6 w-6 object-contain" />
                        </div>
                        <span className="text-xs font-bold text-center leading-tight">{p.label.split(" ")[0]}</span>
                        {isEnabled ? (
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 rounded-full">Active</span>
                        ) : (
                          <span className="text-[9px] font-black text-muted-foreground bg-muted border border-border/50 px-1.5 rounded-full">Not set</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {enabledPlatforms.length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">No platforms are enabled. Go to Settings → Plugins to enable API integrations first.</p>
                  </div>
                )}
                {(wizardPlatform === "facebook" || wizardPlatform === "instagram") && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      On every Facebook screen — Pages, Businesses <em>and</em> Instagram accounts — choose{" "}
                      <strong>“Opt in to all current and future…”</strong>, the top radio button. Picking
                      “current … only” with one item checked makes Meta revoke every other client.
                      You still connect only <strong>this</strong> client’s account in our app.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setWizardStep(1)} className="rounded-xl gap-2">
                    ← Back
                  </Button>
                  <Button
                    onClick={handleConnect}
                    disabled={!wizardPlatform || !wizardClientId || isConnecting}
                    className="rounded-xl gap-2 px-6 font-bold shadow-md"
                  >
                    {isConnecting ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Redirecting...</>
                    ) : (
                      <><ExternalLink className="h-4 w-4" /> Authenticate with {wizardPlatform ? wizardPlatform.charAt(0).toUpperCase() + wizardPlatform.slice(1) : "Platform"}</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import Analytics Data Dialog ── */}
      <Dialog open={importOpen} onOpenChange={open => { setImportOpen(open); if (!open) { setImportResult(null); setImportFiles([]); } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="border-b border-border/40 bg-muted/5 px-7 py-5">
            <DialogTitle className="font-black text-lg flex items-center gap-2"><Upload className="h-5 w-5 text-violet-600" /> Import Analytics Data</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Upload an official analytics export (TikTok Studio) to enrich an account with reach, demographics, and per-video metrics the API can't provide.</p>
          </DialogHeader>

          <div className="space-y-5 p-4 sm:p-6">
            {importResult ? (
              /* ── Success summary ── */
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center gap-2 py-1">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
                  <h3 className="font-bold">Import Complete</h3>
                  <p className="text-xs text-muted-foreground">Added to <strong>{selectedImportAccount?.displayName || selectedImportAccount?.platformUsername}</strong>.</p>
                </div>
                <div className="rounded-xl border border-border/60 divide-y divide-border/40 text-sm overflow-hidden">
                  {(importResult.files || []).map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="truncate flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{f.filename}</span>
                      <span className={`text-xs font-bold shrink-0 ${f.type === 'unknown' ? 'text-amber-600' : 'text-emerald-600'}`}>{f.type === 'unknown' ? 'skipped' : `${f.rows} rows`}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[["Days", importResult.dailyDates], ["Demo", importResult.demographics], ["Activity", importResult.activityCells], ["Videos", importResult.videos]].map(([l, v]: any) => (
                    <div key={l} className="rounded-lg bg-muted/40 border border-border/50 p-2"><p className="text-lg font-black">{v ?? 0}</p><p className="text-[9px] uppercase font-bold text-muted-foreground">{l}</p></div>
                  ))}
                </div>
                {(importResult.warnings || []).length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-700">
                    {importResult.warnings.slice(0, 3).map((w: string, i: number) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setImportResult(null); setImportFiles([]); }}>Import More</Button>
                  <Button className="flex-1 rounded-xl" onClick={() => setImportOpen(false)}>Done</Button>
                </div>
              </div>
            ) : (
              /* ── Selection + upload ── */
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">1 · Business / Client</label>
                  <Select value={activeImportClientId || undefined} onValueChange={v => { setImportClientId(v); setImportAccountId(""); }}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select a Client" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {importSelectClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clientsWithAccounts.length === 0 && (
                    <p className="text-[11px] text-amber-600 font-medium mt-1">No clients have connected social media accounts.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">2 · Social Account</label>
                  <Select value={importAccountId || undefined} onValueChange={setImportAccountId} disabled={!activeImportClientId}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder={activeImportClientId ? "Select an account" : "Choose a client first"} /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {importableAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2"><PlatformIcon platform={a.platform} cls="h-4 w-4 object-contain" />{a.displayName || a.platformUsername}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeImportClientId && importableAccounts.length === 0 && (
                    <p className="text-[11px] text-amber-600">This client has no importable account. Only TikTok supports XLSX import today — connect a TikTok account first.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">3 · Upload TikTok Studio Files</label>
                  <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 transition-all ${importAccountId ? 'border-border/70 hover:border-violet-300 hover:bg-violet-50/40 cursor-pointer' : 'border-border/30 opacity-50 pointer-events-none'}`}>
                    <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" disabled={!importAccountId}
                      onChange={e => setImportFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center">Click to add XLSX files<br /><span className="text-[10px]">FollowerHistory · Overview · Viewers · Content · Gender · Territories · Activity</span></p>
                  </label>
                  {importFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {importFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-muted border border-border/50 rounded-full pl-2 pr-1 py-0.5">
                          <FileText className="h-3 w-3" />{f.name}
                          <button type="button" onClick={() => setImportFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleImport} disabled={!importAccountId || importFiles.length === 0 || importing} className="w-full rounded-xl gap-2 font-bold shadow-md">
                  {importing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Importing…</> : <><Upload className="h-4 w-4" /> Import {importFiles.length > 0 ? `${importFiles.length} File(s)` : 'Data'}</>}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
