import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch, getFullUrl } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { capStatus, capAvailable, capOf, type Capabilities, type MetricKey, type EffectiveStatus } from "@/lib/platform-capabilities";
import { PostDetailDialog, openExternal } from "@/components/social/PostDetailDialog";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell,
  LineChart, Line, ComposedChart,
} from "recharts";
import {
  Users, Eye, TrendingUp, UserPlus, RefreshCw, BarChart2, Heart, MessageSquare,
  Share2, Search, Calendar, Filter, Download, Bookmark, Play, ThumbsUp, ThumbsDown,
  ArrowUp, ArrowDown, Minus, ChevronLeft, ChevronRight, Activity, Zap, Target, Upload, Lock, Info,
  Globe, Clock, CheckCircle2, XCircle, AlertCircle, FileText, Repeat2, LayoutGrid,
  Image, Video, Film, BookOpen, Layers, List, BarChart3, Cpu, Sparkles, Send,
  MapPin, Hash, MousePointer, TrendingDown, SortDesc, ExternalLink,
} from "lucide-react";

// ─────────────────────────── Types ───────────────────────────────────────────
interface NullableKPI {
  current: number;
  previous: number | null;
  change: number | null;
  growth: number | null;
  isNew?: boolean;
}

interface FullAnalytics {
  capabilities: Capabilities;
  provenance: { imported: string[]; lastImportedAt: string | null };
  kpis: {
    followers: NullableKPI | null;
    reach: NullableKPI | null;
    impressions: NullableKPI | null;
    profileVisits: NullableKPI | null;
    videoViews: NullableKPI | null;
    engagementRate: { current: number; previous: number; change: number } | null;
    engagement: { likes: number | null; comments: number | null; shares: number | null; saved: number | null; views: number | null; total: number };
    viewers: { new: number; returning: number } | null;
    publishing: { published: number; scheduled: number; draft: number; failed: number; pendingApproval: number };
  };
  chartData: any[];
  engagementTrend: any[];
  contentTypePerformance: any[];
  bestTimes: any[];
  activityHeatmap: { weekday: number; hour: number; activeFollowers: number }[];
  demographics: { gender: any[]; country: any[]; age: any[] };
  platformComparison: any[];
  platformBreakdown: any[];
  topPosts: TopPost[];
  publishing: { published: number; scheduled: number; draft: number; failed: number; pendingApproval: number; successRate: number; weeklyActivity: any[] };
  accounts: AccountRow[];
  monthlyComparison: { current: any; previous: any };
  aiInsights: string[];
}

interface TopPost {
  id: string; caption: string; mediaUrls: any; mediaType: string | null;
  thumbnailUrl?: string | null; isVerified?: boolean; verificationSource?: string | null;
  publishedAt: string | null; destinations: any[]; imported?: boolean; link?: string | null;
  // 'scheduled' = published from here, 'imported' = found only in an export,
  // 'both' = we published it and the export confirmed its real numbers.
  source?: "scheduled" | "imported" | "both";
  likes: number; comments: number; shares: number; saved: number;
  views: number; reach: number; impressions: number; engagement: number; engagementRate: number;
}

interface AccountRow {
  id: string; platform: string; displayName: string; platformUsername: string;
  avatarUrl: string | null; healthStatus: string; healthMessage: string | null; updatedAt: string;
  lastImportedAt?: string | null; source?: string;
  metricStatus?: { reach: string; impressions: string; videoViews: string };
  latestMetrics: { followers: number | null; reach: number | null; impressions: number | null; profileVisits: number | null; videoViews: number | null; engagementRate: number | null; date: string } | null;
}

interface Client { id: string; name: string; company: string }

// ─────────────────────────── Constants ───────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2", instagram: "#E1306C", tiktok: "#010101",
  youtube: "#FF0000", linkedin: "#0A66C2", x: "#14171A",
  twitter: "#1DA1F2", threads: "#313131",
};

const PIE_PALETTE = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const CONTENT_TYPE_ICONS: Record<string,any> = {
  image: Image, video: Video, reel: Film, short: Film, story: BookOpen,
  carousel: Layers, text: FileText,
};

// ── Engagement Trend: focus-metric area + composition (validated palette) ────
// The 4 interaction types (composition strip). Colour follows the entity.
type EngSeriesKey = "likes" | "comments" | "shares" | "saved";
const ENG_SERIES: { key: EngSeriesKey; label: string; color: string }[] = [
  { key: "likes",    label: "Likes",    color: "#ef4444" },
  { key: "comments", label: "Comments", color: "#3b82f6" },
  { key: "shares",   label: "Shares",   color: "#10b981" },
  { key: "saved",    label: "Saves",    color: "#f59e0b" },
];
// The metric the headline area focuses on. `total` and `score` are DERIVED in
// the dashboard from the API's raw counts (score = likes×1 + comments×2 +
// shares×3 + saves×2). One metric shows at a time → always a single y-axis.
type EngFocus = "total" | "likes" | "comments" | "shares" | "saved" | "score";
const ENG_FOCUS: { key: EngFocus; label: string; color: string; derived?: boolean }[] = [
  { key: "total",    label: "Total (All Metrics)", color: "#6366f1" },
  { key: "likes",    label: "Likes",              color: "#ef4444" },
  { key: "comments", label: "Comments",           color: "#3b82f6" },
  { key: "shares",   label: "Shares",             color: "#10b981" },
  { key: "saved",    label: "Saves",              color: "#f59e0b" },
  { key: "score",    label: "Weighted Score",     color: "#7c3aed", derived: true },
];
const ENG_VIEW_KEY = "social-eng-trend-v2";

const TABS = [
  { id: "overview",    label: "Overview",     icon: LayoutGrid },
  { id: "engagement",  label: "Engagement",   icon: Activity },
  { id: "followers",   label: "Followers",    icon: Users },
  { id: "reach",       label: "Reach",        icon: Eye },
  { id: "content",     label: "Content",      icon: BarChart3 },
  { id: "video",       label: "Video & Story",icon: Play },
  { id: "audience",    label: "Audience",     icon: Globe },
  { id: "besttime",    label: "Best Time",    icon: Clock },
  { id: "platforms",   label: "Platforms",    icon: BarChart2 },
  { id: "publishing",  label: "Publishing",   icon: Send },
  { id: "accounts",    label: "Accounts",     icon: List },
  { id: "ai",          label: "AI Insights",  icon: Sparkles },
  { id: "export",      label: "Export",       icon: Download },
];

// ─────────────────────────── Utilities ───────────────────────────────────────
const fmtN = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
};

const getPlatformIcon = (platform: string, cls = "h-4 w-4 rounded-sm object-contain") => {
  const map: Record<string, string> = {
    facebook: "/social-icons/Facebook.png", instagram: "/social-icons/instagram.png",
    threads: "/social-icons/Threads.png", tiktok: "/social-icons/tiktok.png",
    linkedin: "/social-icons/linkedin.png", youtube: "/social-icons/youtube.png",
    x: "/social-icons/twitter.png", twitter: "/social-icons/twitter.png",
    pinterest: "/social-icons/pinterest.png",
  };
  const src = map[platform?.toLowerCase()];
  return src ? <img src={src} className={cls} alt={platform} /> : <BarChart2 className={cls} />;
};

const Delta = ({ value, suffix = "%" }: { value: number | null | undefined; suffix?: string }) => {
  if (value == null) return null;
  if (value > 0) return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full"><ArrowUp size={9}/>{Math.abs(value).toFixed(1)}{suffix}</span>;
  if (value < 0) return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full"><ArrowDown size={9}/>{Math.abs(value).toFixed(1)}{suffix}</span>;
  return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-neutral-400 bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 rounded-full"><Minus size={9}/>0{suffix}</span>;
};

const NoData = ({ msg = "Sync metrics to see data" }: { msg?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
    <BarChart2 className="h-10 w-10 opacity-30" />
    <p className="text-sm font-medium">{msg}</p>
  </div>
);

const SectionLock = ({ title, desc }: { title: string; desc: string }) => (
  <Card className="rounded-2xl border-dashed border-2 border-border/50">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
        <AlertCircle className="h-5 w-5 text-amber-500" />
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
    </CardContent>
  </Card>
);

// ─────────────────────────── KPI Card ────────────────────────────────────────
const KPICard = ({ label, value, growth, icon: Icon, color, isRate = false, suffix = "", status, note, platforms }: any) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    teal: "bg-teal-50 text-teal-600 border-teal-100",
  };
  const isUnavailable = status === 'locked' || status === 'importable';
  return (
    <Card className={`rounded-2xl shadow-sm border border-border/80 hover:shadow-md transition-all duration-200 cursor-default group ${isUnavailable ? 'opacity-55 grayscale-[30%]' : ''}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center border shadow-sm shrink-0 ${isUnavailable ? 'bg-muted text-muted-foreground border-border' : (colors[color] || colors.blue)}`}>
            {isUnavailable ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
          </div>
        </div>
        {isUnavailable ? (
          <>
            <h3 className="text-lg font-bold text-muted-foreground/50 tracking-tight leading-none">—</h3>
            {note && <p className="text-[9px] text-muted-foreground leading-tight">{note}</p>}
          </>
        ) : (
          <>
            <h3 className="text-2xl font-black text-foreground tracking-tight leading-none">
              {isRate ? `${Number(value ?? 0).toFixed(1)}%` : fmtN(value)}{suffix}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {growth != null && <Delta value={growth} />}
              {platforms && platforms.length > 0 && platforms.length < 5 && (
                <div className="flex items-center gap-1 bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-full shadow-2xs">
                  {platforms.map((p: string) => (
                    <span key={p} title={p.charAt(0).toUpperCase() + p.slice(1)} className="inline-flex items-center">
                      {getPlatformIcon(p, "h-3.5 w-3.5 object-contain")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ─────────────────────────── Chart tooltip ───────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  let formattedDate = label;
  try {
    const d = new Date(label);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
  } catch {}

  const totalSum = payload.reduce((acc: number, p: any) => acc + (Number(p.value) || 0), 0);

  return (
    <div className="bg-card/95 backdrop-blur border border-border/80 rounded-xl shadow-xl p-3 text-xs min-w-[160px] space-y-1.5">
      <div className="flex items-center justify-between border-b border-border/40 pb-1.5 mb-1 gap-2">
        <span className="font-bold text-foreground">{formattedDate}</span>
        {payload.length > 1 && (
          <span className="text-[11px] font-extrabold text-primary font-mono">{fmtN(totalSum)} total</span>
        )}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey || p.name} className="flex items-center justify-between gap-3 text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: p.color || p.stroke }} />
            <span className="font-medium text-foreground/90 capitalize truncate">{p.name}:</span>
          </div>
          <span className="font-bold text-foreground font-mono">{fmtN(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────── Monthly comparison row ──────────────────────────
const CompareRow = ({ label, curr, prev }: { label: string; curr: number; prev: number }) => {
  const diff = curr - prev;
  const g = prev > 0 ? (diff / prev) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 gap-4">
      <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{fmtN(prev)}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary/30 rounded-full" style={{ width: `${prev > 0 ? Math.min((curr / Math.max(curr, prev)) * 100, 100) : 0}%` }} />
        </div>
        <span className="text-sm font-bold text-foreground tabular-nums w-20">{fmtN(curr)}</span>
      </div>
      <Delta value={parseFloat(g.toFixed(1))} />
    </div>
  );
};
// ─────────────────────────── Post Thumbnail Helper ─────────────────────────────
const getFirstMediaUrl = (mediaUrls: any): string | null => {
  if (!mediaUrls) return null;
  if (Array.isArray(mediaUrls)) {
    return mediaUrls.length > 0 && typeof mediaUrls[0] === 'string' ? mediaUrls[0] : null;
  }
  if (typeof mediaUrls === 'string') {
    if (mediaUrls.startsWith('[')) {
      try {
        const parsed = JSON.parse(mediaUrls);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      } catch (e) {}
    }
    return mediaUrls;
  }
  return null;
};

const PostThumbnail = ({ mediaUrls, mediaType, thumbnailUrl }: { mediaUrls: any; mediaType?: string | null; thumbnailUrl?: string | null }) => {
  const [imgError, setImgError] = useState(false);
  const rawUrl = thumbnailUrl || getFirstMediaUrl(mediaUrls);

  if (!rawUrl || imgError) {
    const isVid = mediaType === "video" || mediaType === "reel" || mediaType === "short";
    const IconComponent = isVid ? Video : (mediaType === "image" || mediaType === "carousel" ? Image : BarChart2);
    return (
      <div className="h-16 w-16 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 border border-border/50 shadow-sm">
        <IconComponent className="h-5 w-5 text-muted-foreground/70" />
      </div>
    );
  }

  const resolved = getFullUrl(rawUrl);
  const isDirectVideoFile = /\.(mp4|mov|webm|m4v|ogv|avi)(\?.*)?$/i.test(rawUrl);
  const isVideoContent = mediaType === "video" || mediaType === "reel" || mediaType === "short" || isDirectVideoFile;

  if (isDirectVideoFile) {
    return (
      <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-border/50 shadow-sm bg-black/90 flex items-center justify-center">
        <video
          src={resolved}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <Play className="h-4 w-4 text-white fill-white opacity-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <img
        src={resolved}
        className="h-full w-full object-cover"
        alt=""
        onError={() => setImgError(true)}
      />
      {isVideoContent && (
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
          <Play className="h-3.5 w-3.5 text-white fill-white opacity-90 drop-shadow-sm" />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────── Main Component ──────────────────────────────────
export default function SocialAnalyzePage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [analytics, setAnalytics] = useState<FullAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Posts pagination state
  const [posts, setPosts] = useState<TopPost[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postPage, setPostPage] = useState(1);
  const [postSort, setPostSort] = useState<"engagement"|"likes"|"views"|"newest"|"oldest">("engagement");
  const [postsLoading, setPostsLoading] = useState(false);
  const POST_LIMIT = 10;

  // Post detail panel (metrics for one post + link out to the live post)
  const [detailPostId, setDetailPostId] = useState<string | null>(null);

  // Global filters
  const [activeTab, setActiveTab] = useState("overview");
  const [dateMode, setDateMode] = useState<"preset" | "custom">("preset");
  const [dateRange, setDateRange] = useState<number>(30);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [tempStartDate, setTempStartDate] = useState<string>(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  );
  const [tempEndDate, setTempEndDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [isCustomDateOpen, setIsCustomDateOpen] = useState<boolean>(false);
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [contentTypeFilter, setContentTypeFilter] = useState("ALL");
  const [postSearch, setPostSearch] = useState("");
  const [chartMetric, setChartMetric] = useState<"followers"|"reach"|"impressions"|"engagementRate">("followers");

  // Engagement Trend focus (persisted, so the filter ALWAYS applies across sessions)
  const [engFocus, setEngFocus] = useState<EngFocus>(() => {
    try { return (JSON.parse(localStorage.getItem(ENG_VIEW_KEY) || "{}").focus as EngFocus) || "total"; } catch { return "total"; }
  });
  const [engShowAvg, setEngShowAvg] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(ENG_VIEW_KEY) || "{}").showAvg !== false; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem(ENG_VIEW_KEY, JSON.stringify({ focus: engFocus, showAvg: engShowAvg })); } catch { /* ignore */ } }, [engFocus, engShowAvg]);

  const dateRangeText = useMemo(() => {
    if (dateMode === "custom" && customStartDate && customEndDate) {
      return `${customStartDate} to ${customEndDate}`;
    }
    return `${dateRange} days`;
  }, [dateMode, customStartDate, customEndDate, dateRange]);

  const getAnalyticsQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (dateMode === "custom" && customStartDate && customEndDate) {
      params.set("startDate", customStartDate);
      params.set("endDate", customEndDate);
      const fromT = new Date(customStartDate).getTime();
      const toT = new Date(customEndDate).getTime();
      const calculatedDays = Math.max(1, Math.round((toT - fromT) / 86400000));
      params.set("days", String(calculatedDays));
    } else {
      params.set("days", String(dateRange));
    }
    params.set("platform", platformFilter);
    params.set("contentType", contentTypeFilter);
    return params.toString();
  }, [dateMode, customStartDate, customEndDate, dateRange, platformFilter, contentTypeFilter]);

  useEffect(() => {
    Promise.all([
      apiFetch<any>("/clients"),
      apiFetch<any>("/social/accounts?limit=1000").catch(() => null),
    ]).then(([clientsRes, accountsRes]) => {
      const list: Client[] = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.clients || []);
      const accs = Array.isArray(accountsRes) ? accountsRes : (accountsRes?.accounts || []);
      const clientIdsWithAccounts = new Set<string>();
      accs.forEach((acc: any) => {
        if (acc.clientId) clientIdsWithAccounts.add(acc.clientId);
      });

      const filtered = list.filter(c => clientIdsWithAccounts.has(c.id) || ((c as any)._count?.socialAccounts ?? 0) > 0);
      if (filtered.length > 0) {
        setClients(filtered);
        setSelectedClient(filtered[0].id);
      } else {
        setClients(list);
        if (list.length > 0) setSelectedClient(list[0].id);
      }
    }).catch(() => {});
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedClient) return;
    setIsLoading(true);
    try {
      const q = getAnalyticsQueryString();
      const res = await apiFetch<FullAnalytics>(
        `/social/analytics/${selectedClient}/full?${q}`
      );
      setAnalytics(res);
    } catch (err: any) {
      toast({ title: "Error loading analytics", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedClient, getAnalyticsQueryString]);

  const fetchPosts = useCallback(async () => {
    if (!selectedClient) return;
    setPostsLoading(true);
    try {
      const q = getAnalyticsQueryString();
      const res = await apiFetch<any>(
        `/social/analytics/${selectedClient}/posts?page=${postPage}&limit=${POST_LIMIT}&sortBy=${postSort}&search=${postSearch}&${q}`
      );
      setPosts(res.posts || []);
      setPostsTotal(res.total || 0);
    } catch { /* handled */ } finally {
      setPostsLoading(false);
    }
  }, [selectedClient, postPage, postSort, postSearch, getAnalyticsQueryString]);

  useEffect(() => {
    if (selectedClient) { fetchAnalytics(); setPostPage(1); }
    else { setAnalytics(null); setPosts([]); }
  }, [selectedClient, getAnalyticsQueryString]);

  const handleRefresh = async () => {
    if (!selectedClient || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await apiFetch<any>(`/social/analytics/${selectedClient}/refresh`, { method: "POST" });
      toast({ title: "✅ Metrics & Video Thumbnails Synced", description: "Fresh metrics, video thumbnails, and verifications pulled." });
      await Promise.all([fetchAnalytics(), fetchPosts()]);
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally { setIsRefreshing(false); }
  };

  const exportCSV = () => {
    if (!posts.length) return;
    const hdr = "Caption,Platform(s),Date,Type,Likes,Comments,Shares,Saved,Views,Reach,Impressions,Engagement,ER%\n";
    const rows = posts.map(p => [
      `"${(p.caption||"").replace(/"/g,"'")}"`,
      (p.destinations||[]).map((d:any)=>d.platform).join("|"),
      p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "",
      p.mediaType || "text",
      p.likes, p.comments, p.shares, p.saved, p.views, p.reach, p.impressions, p.engagement, p.engagementRate,
    ].join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([hdr+rows], { type:"text/csv" })),
      download: `analytics_${new Date().toISOString().split("T")[0]}.csv`,
    });
    a.click();
  };

  // Derived values
  const kpis = analytics?.kpis;
  const caps = analytics?.capabilities;
  const connectedPlatforms = useMemo(
    () => Array.from(new Set((analytics?.accounts||[]).map(a => a.platform.toLowerCase()))),
    [analytics]
  );
  const chartData = analytics?.chartData || [];
  const pieData = (analytics?.platformBreakdown||[]).filter(p => p.followers > 0 || p.reach > 0)
    .map(p => ({ name: p.platform, value: p.followers || p.reach || 1 }));

  // Engagement Trend data: raw API counts + DERIVED metrics (total, weighted
  // score) + a 7-day moving average of whichever metric is in focus.
  const engData = useMemo(() => {
    const rows = (analytics?.engagementTrend || []).map((r: any) => {
      const likes = r.likes||0, comments = r.comments||0, shares = r.shares||0, saved = r.saved||0;
      const total = likes + comments + shares + saved;
      const score = likes + comments * 2 + shares * 3 + saved * 2;
      return { date: r.date, likes, comments, shares, saved, total, score } as Record<string, any>;
    });
    rows.forEach((r, i) => {
      const win = rows.slice(Math.max(0, i - 6), i + 1);
      r.avg = Math.round(win.reduce((s: number, x: any) => s + x[engFocus], 0) / (win.length || 1));
    });
    return rows;
  }, [analytics, engFocus]);
  const engStats = useMemo(() => {
    const focusTotal = engData.reduce((s, r) => s + (r[engFocus] || 0), 0);
    const peak = engData.reduce((m, r) => Math.max(m, r[engFocus] || 0), 0);
    const avg = engData.length ? Math.round(focusTotal / engData.length) : 0;
    const comp = ENG_SERIES.map(s => ({ ...s, value: engData.reduce((a, r) => a + (r[s.key] || 0), 0) }));
    const compTotal = comp.reduce((a, c) => a + c.value, 0) || 1;
    return { focusTotal, peak, avg, comp, compTotal };
  }, [engData, engFocus]);
  const engFocusMeta = ENG_FOCUS.find(f => f.key === engFocus) || ENG_FOCUS[0];

  // Helper: build KPI card props from the capability + kpi value blocks.
  const capKpi = (key: MetricKey, label: string, kpiData: NullableKPI | null | undefined, icon: any, color: string, opts?: { isRate?: boolean }) => {
    const cap = capOf(caps, key);
    if (!cap) return null; // metric doesn't exist for any active platform — omit entirely
    return {
      label,
      value: kpiData?.current ?? 0,
      growth: kpiData?.growth,
      icon,
      color,
      isRate: opts?.isRate,
      status: cap.status,
      note: cap.note,
      platforms: cap.platforms,
    };
  };

  // Heatmap: prefer real active-followers from imported data, fall back to post-engagement
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    const actHeatmap = analytics?.activityHeatmap || [];
    if (actHeatmap.length > 0) {
      for (const a of actHeatmap) grid[a.weekday][a.hour] = a.activeFollowers;
    } else {
      for (const t of (analytics?.bestTimes||[])) grid[t.day][t.hour] = t.engagement;
    }
    const flat: { day: number; hour: number; value: number }[] = [];
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (grid[d][h] > 0) flat.push({ day: d, hour: h, value: grid[d][h] });
    const topSlots = flat.slice().sort((a, b) => b.value - a.value).slice(0, 5);
    const maxVal = Math.max(...grid.flat(), 1);
    return { grid, maxVal, topSlots, hasData: flat.length > 0, source: actHeatmap.length > 0 ? 'import' as const : 'posts' as const };
  }, [analytics]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen space-y-0">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
            <p className="text-xs text-muted-foreground">Social media performance across all connected platforms</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedClient || "none"} onValueChange={val => {
              setSelectedClient(val === "none" ? "" : val);
              setPostPage(1);
            }}>
              <SelectTrigger className="border border-border bg-background rounded-xl px-3 py-2 h-9 text-sm font-semibold shadow-sm w-48 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Select Client" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">-- Select Client --</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient && (
              <>
                <Button variant="outline" disabled={isRefreshing||isLoading} onClick={handleRefresh} className="rounded-xl h-9 px-3 gap-1.5 text-sm">
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing?"animate-spin":""}`} />
                  Sync Metrics
                </Button>
                <Button variant="outline" onClick={exportCSV} className="rounded-xl h-9 px-3 gap-1.5 text-sm">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Global Filters */}
        {selectedClient && !isLoading && analytics && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/40">
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex bg-muted/30 border border-border rounded-lg p-0.5 gap-0.5 items-center">
                {([7,30,90] as const).map(d => (
                  <button key={d} onClick={() => { setDateMode("preset"); setDateRange(d); }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${dateMode==="preset" && dateRange===d ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                    {d}D
                  </button>
                ))}

                <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${dateMode==="custom" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                      <span>Custom</span>
                      {dateMode === "custom" && customStartDate && customEndDate && (
                        <span className="text-[10px] opacity-90 font-medium">({customStartDate} to {customEndDate})</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 rounded-2xl shadow-xl border border-border bg-card" align="start">
                    <div className="space-y-4 min-w-[280px]">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <h4 className="font-bold text-xs flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" /> Select Custom Date Range
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Start Date</label>
                          <Input
                            type="date"
                            value={tempStartDate}
                            onChange={(e) => setTempStartDate(e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase">End Date</label>
                          <Input
                            type="date"
                            value={tempEndDate}
                            onChange={(e) => setTempEndDate(e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      {/* Quick presets inside popover */}
                      <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/40">
                        <span className="text-[10px] text-muted-foreground font-semibold mr-1">Presets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const end = now.toISOString().split("T")[0];
                            const start = new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0];
                            setTempStartDate(start);
                            setTempEndDate(end);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted font-medium transition-colors">
                          Last 14D
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const end = now.toISOString().split("T")[0];
                            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                            setTempStartDate(start);
                            setTempEndDate(end);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted font-medium transition-colors">
                          This Month
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                            const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
                            setTempStartDate(firstOfPrev.toISOString().split("T")[0]);
                            setTempEndDate(lastOfPrev.toISOString().split("T")[0]);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted font-medium transition-colors">
                          Last Month
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2.5 rounded-lg"
                          onClick={() => setIsCustomDateOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3 rounded-lg"
                          disabled={!tempStartDate || !tempEndDate || tempStartDate > tempEndDate}
                          onClick={() => {
                            setCustomStartDate(tempStartDate);
                            setCustomEndDate(tempEndDate);
                            setDateMode("custom");
                            setIsCustomDateOpen(false);
                          }}>
                          Apply Range
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Platform */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex bg-muted/30 border border-border rounded-lg p-0.5 gap-0.5 flex-wrap">
                <button onClick={() => setPlatformFilter("ALL")}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${platformFilter==="ALL"?"bg-primary text-primary-foreground shadow":"text-muted-foreground hover:text-foreground"}`}>All</button>
                {connectedPlatforms.map(p => (
                  <button key={p} onClick={() => setPlatformFilter(p.toUpperCase())}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${platformFilter===p.toUpperCase()?"bg-primary text-primary-foreground shadow":"text-muted-foreground hover:text-foreground"}`}>
                    {getPlatformIcon(p, "h-3 w-3 object-contain")}
                    <span className="capitalize">{p}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Content type */}
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="border border-border bg-background rounded-lg px-2 py-1 h-7 text-xs font-semibold outline-none w-28">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="ALL">All Types</SelectItem>
                {["image","video","reel","story","short","carousel","text"].map(t =>
                  <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── No client / Loading / Empty ── */}
      {!selectedClient ? (
        <div className="p-6"><Card className="border-dashed py-24 text-center rounded-2xl"><Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30"/><p className="font-medium text-muted-foreground">Select a client to view analytics</p></Card></div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-40 gap-2 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin text-primary"/><span>Loading analytics...</span>
        </div>
      ) : !analytics || (analytics as any).empty ? (
        <div className="p-6"><Card className="border-dashed py-24 flex flex-col items-center justify-center text-center rounded-2xl">
          <BarChart2 className="h-10 w-10 text-muted-foreground mb-3"/>
          <h3 className="font-semibold">No Connected Accounts</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">Connect social media accounts for this client, then click Sync Metrics.</p>
        </Card></div>
      ) : (
        <div className="flex h-full">
          {/* ── Sidebar Tabs ── */}
          <nav className="w-44 shrink-0 border-r border-border/50 bg-muted/10 flex flex-col gap-0.5 py-4 px-2 sticky top-[145px] h-[calc(100vh-145px)] overflow-y-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const label = t.id === "followers" && platformFilter === "YOUTUBE" ? "Subscribers" : t.label;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${activeTab===t.id?"bg-primary text-primary-foreground shadow-sm":"text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0"/>
                  {label}
                </button>
              );
            })}
          </nav>

          {/* ── Content Area ── */}
          <div className="flex-1 overflow-x-hidden p-6 space-y-6 min-w-0">

            {/* ══════════════ OVERVIEW ══════════════ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Overview</h2>
                  <p className="text-xs text-muted-foreground">Key performance indicators for {dateRangeText}</p>
                </div>
                {/* Adaptive KPI cards — only metrics this platform can report */}
                {(() => {
                  const cards = [
                    capKpi('followers', platformFilter === "YOUTUBE" ? "Total Subscribers" : "Total Followers", kpis?.followers, Users, "blue"),
                    capKpi('reach', "Total Reach", kpis?.reach, TrendingUp, "emerald"),
                    capKpi('impressions', "Impressions", kpis?.impressions, Eye, "purple"),
                    capKpi('profileVisits', "Profile Visits", kpis?.profileVisits, UserPlus, "amber"),
                    capKpi('videoViews', "Video Views", kpis?.videoViews, Play, "teal"),
                    capKpi('engagementRate', "Engagement Rate", kpis?.engagementRate ? { current: kpis.engagementRate.current, previous: kpis.engagementRate.previous, change: kpis.engagementRate.change, growth: kpis.engagementRate.change } : null, Activity, "rose", { isRate: true }),
                    // Posts Published is always real (local data)
                    { label: "Posts Published", value: kpis?.publishing.published ?? 0, growth: undefined, icon: Zap, color: "indigo" },
                  ].filter(Boolean);
                  const cols = cards.length <= 4 ? "xl:grid-cols-4" : cards.length <= 5 ? "xl:grid-cols-5" : "xl:grid-cols-6";
                  return (
                    <div className={`grid grid-cols-2 md:grid-cols-3 ${cols} gap-4`}>
                      {cards.map((c: any) => <KPICard key={c.label} {...c} />)}
                    </div>
                  );
                })()}

                {/* Chart + Pie */}
                <div className="grid lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 rounded-2xl shadow-sm border border-border/80 overflow-hidden">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary"/>Performance Over Time</CardTitle>
                          <CardDescription className="text-xs">{dateRangeText}</CardDescription>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {(["followers","reach","impressions","engagementRate"] as const).map(m => (
                            <button key={m} onClick={() => setChartMetric(m)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${chartMetric===m?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:border-primary/50"}`}>
                              {m==="engagementRate"?"Eng.Rate":m.charAt(0).toUpperCase()+m.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-64 w-full">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top:5,right:5,left:-20,bottom:0 }}>
                              <defs>
                                <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)"/>
                              <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={v=>v.slice(5)}/>
                              <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>fmtN(Number(v))}/>
                              <Tooltip content={<ChartTip/>}/>
                              <Area type="monotone" dataKey={chartMetric} stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#gArea)" dot={false} activeDot={{r:5}}/>
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : <NoData/>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Platform Pie */}
                  <Card className="rounded-2xl shadow-sm border border-border/80 overflow-hidden">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Target className="h-4 w-4 text-indigo-500"/>Audience Split</CardTitle>
                      <CardDescription className="text-xs">{platformFilter === "YOUTUBE" ? "Subscriber distribution by platform" : "Follower distribution by platform"}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 flex flex-col items-center gap-4">
                      {pieData.length > 0 ? (
                        <>
                          <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                                  {pieData.map((e,i) => <Cell key={e.name} fill={PLATFORM_COLORS[e.name]||PIE_PALETTE[i%PIE_PALETTE.length]}/>)}
                                </Pie>
                                <Tooltip formatter={(v:any)=>fmtN(Number(v))} contentStyle={{borderRadius:"10px",fontSize:12}}/>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-full space-y-1.5">
                            {pieData.map((e,i) => {
                              const tot = pieData.reduce((s,x)=>s+x.value,0);
                              const pp = tot>0?((e.value/tot)*100).toFixed(1):"0";
                              const col = PLATFORM_COLORS[e.name]||PIE_PALETTE[i%PIE_PALETTE.length];
                              return (
                                <div key={e.name} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:col}}/><span className="capitalize font-medium">{e.name}</span></div>
                                  <div className="flex items-center gap-2"><span className="text-muted-foreground">{fmtN(e.value)}</span><span className="font-bold">{pp}%</span></div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : <NoData msg="No follower data yet — sync metrics"/>}
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Comparison */}
                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-violet-500"/>Period Comparison</CardTitle>
                    <CardDescription className="text-xs">Current ({dateRangeText}) vs. previous period</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {analytics.monthlyComparison ? (
                      <div className="space-y-0">
                        <CompareRow label={platformFilter === "YOUTUBE" ? "Subscribers" : "Followers"} curr={analytics.monthlyComparison.current.followers} prev={analytics.monthlyComparison.previous.followers}/>
                        <CompareRow label="Reach" curr={analytics.monthlyComparison.current.reach} prev={analytics.monthlyComparison.previous.reach}/>
                        <CompareRow label="Impressions" curr={analytics.monthlyComparison.current.impressions} prev={analytics.monthlyComparison.previous.impressions}/>
                        <CompareRow label="Engagement" curr={analytics.monthlyComparison.current.engagement} prev={analytics.monthlyComparison.previous.engagement}/>
                        <CompareRow label="Posts" curr={analytics.monthlyComparison.current.posts} prev={analytics.monthlyComparison.previous.posts}/>
                        <CompareRow label="Video Views" curr={analytics.monthlyComparison.current.views} prev={analytics.monthlyComparison.previous.views}/>
                      </div>
                    ) : <NoData/>}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══════════════ ENGAGEMENT ══════════════ */}
            {activeTab === "engagement" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Engagement Analytics</h2><p className="text-xs text-muted-foreground">All user interactions with your content</p></div>

                {/* Breakdown cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                  {[
                    { label:"Likes", value:kpis?.engagement.likes ?? 0, icon:Heart, color:"rose" },
                    { label:"Comments", value:kpis?.engagement.comments ?? 0, icon:MessageSquare, color:"blue" },
                    { label:"Shares", value:kpis?.engagement.shares ?? 0, icon:Share2, color:"emerald" },
                    { label:"Saves", value:kpis?.engagement.saved ?? 0, icon:Bookmark, color:"amber" },
                    { label:"Video Views", value:kpis?.engagement.views ?? 0, icon:Play, color:"purple" },
                    { label:"Total Engaged", value:kpis?.engagement.total ?? 0, icon:Activity, color:"indigo" },
                  ].map(c => <KPICard key={c.label} {...c} growth={undefined}/>)}
                </div>

                {/* Engagement trend — focus-metric area + composition */}
                <Card className="rounded-2xl shadow-sm border border-border/80 overflow-hidden">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Activity className="h-4 w-4 text-primary"/>Engagement Trend</CardTitle>
                        <CardDescription className="text-xs">How your audience interacts over time ({dateRangeText}) — choose a metric or view all together</CardDescription>
                      </div>
                      <button onClick={() => setEngShowAvg(v => !v)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${engShowAvg?"bg-primary/10 text-primary border-primary/30":"bg-muted/30 text-muted-foreground border-border"}`}>
                        <TrendingUp className="h-3 w-3"/> 7-day avg
                      </button>
                    </div>
                    {/* Focus selector — options for Total (All) or individual metrics */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {ENG_FOCUS.map(f => {
                        const on = engFocus === f.key;
                        return (
                          <button key={f.key} onClick={() => setEngFocus(f.key)}
                            style={on ? { background: `${f.color}1a`, color: f.color, borderColor: `${f.color}66` } : undefined}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${on?"shadow-sm font-bold":"border-border/50 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                            <span className="w-2 h-2 rounded-full" style={{ background: f.color }}/>
                            {f.label}
                            {f.derived && <Sparkles className="h-2.5 w-2.5"/>}
                          </button>
                        );
                      })}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {engData.length === 0 ? (
                      <div className="h-72"><NoData msg="No engagement recorded for the selected period — adjust dates or sync data"/></div>
                    ) : (
                      <div className="space-y-5">
                        {/* Headline stats for the focused metric */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">{engFocusMeta.label} · Total {engFocusMeta.derived && <Sparkles className="h-2.5 w-2.5 text-violet-500"/>}</p>
                            <p className="text-xl font-black leading-tight mt-0.5" style={{ color: engFocusMeta.color }}>{fmtN(engStats.focusTotal)}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Peak Day</p>
                            <p className="text-xl font-black leading-tight mt-0.5">{fmtN(engStats.peak)}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Daily Average</p>
                            <p className="text-xl font-black leading-tight mt-0.5">{fmtN(engStats.avg)}</p>
                          </div>
                        </div>

                        {/* Interactive multi-metric / focus-metric chart */}
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={engData} margin={{top:12,right:12,left:-16,bottom:0}}>
                              <defs>
                                <linearGradient id="engGradTotal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
                                </linearGradient>
                                <linearGradient id="engGradLikes" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                                </linearGradient>
                                <linearGradient id="engGradComments" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                                </linearGradient>
                                <linearGradient id="engGradShares" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                                </linearGradient>
                                <linearGradient id="engGradSaved" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01}/>
                                </linearGradient>
                                <linearGradient id="engGradScore" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.01}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)"/>
                              <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}
                                tickFormatter={v => {
                                  try {
                                    const d = new Date(v);
                                    return isNaN(d.getTime()) ? String(v).slice(5) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                  } catch { return String(v); }
                                }}
                                minTickGap={24}
                              />
                              <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>fmtN(Number(v))} width={44}/>
                              <Tooltip content={<ChartTip/>} cursor={{ stroke: engFocusMeta.color, strokeOpacity: 0.3, strokeWidth: 1.5 }}/>

                              {engFocus === "total" ? (
                                <>
                                  <Area type="monotone" dataKey="total" name="Total Interactions" stroke="#6366f1" strokeWidth={2.5} fill="url(#engGradTotal)" fillOpacity={0.15} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                                  <Line type="monotone" dataKey="likes" name="Likes" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                  <Line type="monotone" dataKey="comments" name="Comments" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                  <Line type="monotone" dataKey="shares" name="Shares" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                  <Line type="monotone" dataKey="saved" name="Saves" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                </>
                              ) : (
                                <Area type="monotone" dataKey={engFocus} name={engFocusMeta.label} stroke={engFocusMeta.color} strokeWidth={2.5}
                                  fill={`url(#engGrad${engFocus === "saved" ? "Saved" : engFocus.charAt(0).toUpperCase() + engFocus.slice(1)})`}
                                  dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                                />
                              )}
                              {engShowAvg && <Line type="monotone" dataKey="avg" name="7-Day Avg" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Composition — where the interactions come from */}
                        <div className="pt-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Composition Breakdown</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">{fmtN(engStats.compTotal)} total interactions</span>
                          </div>
                          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted gap-[2px]">
                            {engStats.comp.map(c => c.value > 0 && (
                              <div key={c.key} style={{ width: `${(c.value / engStats.compTotal) * 100}%`, background: c.color }} title={`${c.label}: ${fmtN(c.value)}`}/>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                            {engStats.comp.map(c => (
                              <button key={c.key} onClick={() => setEngFocus(c.key)} className="flex items-center gap-2 text-left rounded-lg hover:bg-muted/40 transition-colors p-1.5 -m-1.5 border border-transparent hover:border-border/40">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }}/>
                                <div className="min-w-0">
                                  <p className="text-[10px] text-muted-foreground leading-none font-medium">{c.label}</p>
                                  <p className="text-xs font-bold leading-tight mt-0.5">{fmtN(c.value)} <span className="text-[10px] font-medium text-muted-foreground">({Math.round((c.value / engStats.compTotal) * 100)}%)</span></p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {engFocusMeta.derived && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3 text-primary"/> Weighted Score = likes×1 + comments×2 + shares×3 + saves×2 — a custom quality metric computed in-dashboard from your raw counts.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Engagement rate section */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="rounded-2xl shadow-sm border border-border/80">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold">Engagement Rate</CardTitle>
                      <CardDescription className="text-xs">Formula: (Engagements ÷ Reach) × 100</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-end gap-3">
                        <span className="text-4xl font-black text-foreground">{(kpis?.engagementRate?.current ?? 0).toFixed(2)}%</span>
                        <Delta value={kpis?.engagementRate?.change ?? 0}/>
                      </div>
                      <p className="text-xs text-muted-foreground">vs. {(kpis?.engagementRate?.previous ?? 0).toFixed(2)}% in the previous period</p>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{width:`${Math.min((kpis?.engagementRate?.current ?? 0)*10,100)}%`}}/>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl shadow-sm border border-border/80">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold">Engagement Mix</CardTitle>
                      <CardDescription className="text-xs">Distribution of interaction types</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {kpis!.engagement.total > 0 ? (
                        <div className="space-y-3">
                          {[
                            { label:"Likes", val:kpis!.engagement.likes, color:"bg-red-400" },
                            { label:"Comments", val:kpis!.engagement.comments, color:"bg-blue-400" },
                            { label:"Shares", val:kpis!.engagement.shares, color:"bg-emerald-400" },
                            { label:"Saves", val:kpis!.engagement.saved, color:"bg-amber-400" },
                          ].map(i => {
                            const pct = kpis!.engagement.total>0?((i.val/kpis!.engagement.total)*100):0;
                            return (
                              <div key={i.label} className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-16 shrink-0">{i.label}</span>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full ${i.color} rounded-full`} style={{width:`${pct}%`}}/>
                                </div>
                                <span className="text-xs font-bold w-10 text-right">{pct.toFixed(0)}%</span>
                                <span className="text-xs text-muted-foreground w-12 text-right">{fmtN(i.val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : <NoData/>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ══════════════ FOLLOWERS ══════════════ */}
            {activeTab === "followers" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">{platformFilter === "YOUTUBE" ? "Subscribers Analytics" : "Followers Analytics"}</h2><p className="text-xs text-muted-foreground">Audience growth and distribution</p></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: platformFilter === "YOUTUBE" ? "Current Subscribers" : "Current Followers", value:kpis?.followers?.current ?? 0, icon:Users, color:"blue" },
                    { label:"Net Change", value:kpis?.followers?.change != null ? Math.abs(kpis.followers.change) : 0, icon:(kpis?.followers?.change ?? 0)>=0?ArrowUp:ArrowDown, color:(kpis?.followers?.change ?? 0)>=0?"emerald":"rose" },
                    { label:"Growth", value:kpis?.followers?.growth != null ? Math.abs(kpis.followers.growth) : 0, icon:TrendingUp, color:"indigo", suffix:"%" },
                    ...(kpis?.followers?.isNew ? [] : [{ label:"Prev. Period", value:kpis?.followers?.previous ?? 0, icon:Clock, color:"amber" }]),
                  ].map(c => <KPICard key={c.label} growth={undefined} {...c} isRate={"suffix" in c}/>)}
                </div>

                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-blue-500"/>{platformFilter === "YOUTUBE" ? "Subscribers Growth Chart" : "Followers Growth Chart"}</CardTitle>
                    <CardDescription className="text-xs">{platformFilter === "YOUTUBE" ? "Total subscribers tracked daily" : "Total followers tracked daily"}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-72 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{top:5,right:5,left:-20,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)"/>
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={v=>v.slice(5)}/>
                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>fmtN(Number(v))}/>
                            <Tooltip content={<ChartTip/>}/>
                            <Line type="monotone" dataKey="followers" name={platformFilter === "YOUTUBE" ? "Subscribers" : "Followers"} stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
                          </LineChart>
                        </ResponsiveContainer>
                      ) : <NoData/>}
                    </div>
                  </CardContent>
                </Card>

                {/* Platform distribution */}
                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold">Audience Distribution</CardTitle>
                    <CardDescription className="text-xs">{platformFilter === "YOUTUBE" ? "Subscribers per platform" : "Followers per platform"}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {(analytics.platformBreakdown||[]).sort((a,b)=>b.followers-a.followers).map(p => {
                        const tot = (analytics.platformBreakdown||[]).reduce((s,x)=>s+x.followers,0);
                        const pctVal = tot>0?((p.followers/tot)*100):0;
                        const col = PLATFORM_COLORS[p.platform]||"#6366f1";
                        return (
                          <div key={p.platform} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">{getPlatformIcon(p.platform)}<span className="capitalize font-semibold">{p.platform}</span></div>
                              <div className="flex items-center gap-3"><span className="text-muted-foreground text-xs">{fmtN(p.followers)}</span><span className="font-bold text-xs">{pctVal.toFixed(1)}%</span></div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{width:`${pctVal}%`,background:col}}/>
                            </div>
                          </div>
                        );
                      })}
                      {!(analytics.platformBreakdown||[]).some(p=>p.followers>0) && <NoData/>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══════════════ REACH ══════════════ */}
            {activeTab === "reach" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Reach & Impressions</h2><p className="text-xs text-muted-foreground">Content visibility and exposure metrics</p></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard label="Total Reach" value={kpis?.reach?.current ?? 0} growth={kpis?.reach?.growth} icon={TrendingUp} color="emerald"/>
                  <KPICard label="Impressions" value={kpis?.impressions?.current ?? 0} growth={kpis?.impressions?.growth} icon={Eye} color="purple"/>
                  <KPICard label="Reach Change" value={kpis?.reach?.change != null ? Math.abs(kpis.reach.change) : 0} growth={undefined} icon={(kpis?.reach?.change ?? 0)>=0?ArrowUp:ArrowDown} color={(kpis?.reach?.change ?? 0)>=0?"emerald":"rose"}/>
                  <KPICard label="Frequency" value={(kpis?.reach?.current ?? 0)>0?parseFloat(((kpis?.impressions?.current ?? 0)/(kpis?.reach?.current ?? 1)).toFixed(2)):0} growth={undefined} icon={Repeat2} color="amber"/>
                </div>

                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Eye className="h-4 w-4 text-emerald-500"/>Reach vs. Impressions — Daily</CardTitle>
                    <CardDescription className="text-xs">Unique viewers vs. total content displays</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-72 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{top:5,right:5,left:-20,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)"/>
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={v=>v.slice(5)}/>
                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>fmtN(Number(v))}/>
                            <Tooltip content={<ChartTip/>}/>
                            <Legend iconSize={8} wrapperStyle={{fontSize:11}}/>
                            <Bar dataKey="reach" name="Reach" fill="#10b981" radius={[4,4,0,0]}/>
                            <Bar dataKey="impressions" name="Impressions" fill="#8b5cf6" radius={[4,4,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <NoData/>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold">Daily Reach Trend</CardTitle>
                    <CardDescription className="text-xs">Reach progression over {dateRangeText}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-52 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{top:5,right:5,left:-20,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)"/>
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={v=>v.slice(5)}/>
                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>fmtN(Number(v))}/>
                            <Tooltip content={<ChartTip/>}/>
                            <Line type="monotone" dataKey="reach" name="Reach" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
                          </LineChart>
                        </ResponsiveContainer>
                      ) : <NoData/>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══════════════ CONTENT ══════════════ */}
            {activeTab === "content" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Content Performance</h2><p className="text-xs text-muted-foreground">Top posts and content type analysis</p></div>

                {/* Content type performance */}
                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5"><LayoutGrid className="h-4 w-4 text-violet-500"/>Content Type Performance</CardTitle>
                    <CardDescription className="text-xs">Average metrics per content format</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {analytics.contentTypePerformance.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/40 bg-muted/5">
                              {["Type","Posts","Avg. Reach","Avg. Engagement","Avg. Views","Avg. Saves","Avg. Impressions"].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {analytics.contentTypePerformance.map((ct,i) => {
                              const Icon = CONTENT_TYPE_ICONS[ct.type] || FileText;
                              return (
                                <tr key={ct.type} className={`hover:bg-muted/5 transition-colors ${i===0?"bg-primary/3":""}`}>
                                  <td className="px-4 py-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground"/><span className="capitalize font-semibold">{ct.type}{i===0?" 🏆":""}</span></div></td>
                                  <td className="px-4 py-3 font-medium">{ct.count}</td>
                                  <td className="px-4 py-3">{fmtN(ct.avgReach)}</td>
                                  <td className="px-4 py-3 font-bold text-primary">{fmtN(ct.avgEngagement)}</td>
                                  <td className="px-4 py-3">{fmtN(ct.avgViews)}</td>
                                  <td className="px-4 py-3">{fmtN(ct.avgSaved)}</td>
                                  <td className="px-4 py-3">{fmtN(ct.avgImpressions)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="p-6"><NoData msg="Publish content and sync to see type performance"/></div>}
                  </CardContent>
                </Card>

                {/* Top Posts */}
                <Card className="rounded-2xl shadow-sm border border-border/80 overflow-hidden">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <CardTitle className="text-sm font-bold">Top Performing Posts</CardTitle>
                        <CardDescription className="text-xs">Sort and filter your published content</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"/>
                          <Input placeholder="Search posts..." value={postSearch} onChange={e=>{setPostSearch(e.target.value);setPostPage(1);}} className="pl-8 h-8 text-xs rounded-lg w-44"/>
                        </div>
                        <div className="flex bg-muted/30 border border-border rounded-lg p-0.5 gap-0.5">
                          {(["engagement","likes","views","newest","oldest"] as const).map(s => (
                            <button key={s} onClick={()=>{setPostSort(s);setPostPage(1);}}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${postSort===s?"bg-primary text-primary-foreground shadow":"text-muted-foreground hover:text-foreground"}`}>
                              {s.charAt(0).toUpperCase()+s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="divide-y divide-border/40">
                    {postsLoading ? (
                      <div className="flex justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-primary"/></div>
                    ) : posts.length === 0 ? (
                      <div className="py-12"><NoData msg="No posts found — try adjusting your filters"/></div>
                    ) : posts.map(post => {
                      return (
                        // Click-anywhere is a convenience only — no focus ring on
                        // the row itself (an inset ring on a wide row reads as
                        // stray lines). The View button below is the real,
                        // keyboard-reachable control.
                        <div
                          key={post.id}
                          onClick={() => setDetailPostId(post.id)}
                          className="p-4 hover:bg-muted/5 transition-all cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <PostThumbnail mediaUrls={post.mediaUrls} mediaType={post.mediaType} thumbnailUrl={post.thumbnailUrl} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <p className="text-xs font-semibold line-clamp-2 leading-normal flex-1">{post.caption||"(no caption)"}</p>
                                {/* Actions: open the live post directly, or inspect its metrics. */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {post.link && (
                                    <button
                                      onClick={e => { e.stopPropagation(); openExternal(post.link!); }}
                                      title="Open the live post in a new tab"
                                      aria-label="Open the live post in a new tab"
                                      className="p-1.5 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                    >
                                      <ExternalLink size={12}/>
                                    </button>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); setDetailPostId(post.id); }}
                                    className="px-2 py-1 rounded-lg border border-border/70 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {(post.destinations||[]).map((d:any,i:number)=><span key={i}>{getPlatformIcon(d.platform,"h-3 w-3 object-contain")}</span>)}
                                {post.mediaType && <span className="bg-muted border border-border/50 px-1.5 py-0.5 rounded text-[9px] font-bold capitalize">{post.mediaType}</span>}
                                {post.isVerified && (
                                  <span className="bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1" title={`Verified video via ${post.verificationSource === 'api' ? 'TikTok API' : 'TikTok oEmbed'}`}>
                                    <CheckCircle2 size={10} className="text-emerald-500" />
                                    Verified
                                  </span>
                                )}
                                {post.source === "both" && <span className="bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded text-[9px] font-bold text-violet-600" title="Published from here — metrics confirmed by your imported export">Verified by export</span>}
                                {post.source === "imported" && <span className="bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded text-[9px] font-bold text-violet-600" title="Posted natively — found in your imported export">Imported</span>}
                                <span className="text-[10px] text-muted-foreground">{post.publishedAt?new Date(post.publishedAt).toLocaleDateString():""}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500"><Heart size={10} fill="currentColor"/>{fmtN(post.likes)}</span>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500"><MessageSquare size={10}/>{fmtN(post.comments)}</span>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><Share2 size={10}/>{fmtN(post.shares)}</span>
                                {post.saved>0 && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500"><Bookmark size={10}/>{fmtN(post.saved)}</span>}
                                {post.views>0 && <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500"><Play size={10}/>{fmtN(post.views)}</span>}
                                {post.reach>0 && <span className="flex items-center gap-1 text-[10px] font-bold text-teal-500"><Eye size={10}/>{fmtN(post.reach)}</span>}
                                <div className="ml-auto flex items-center gap-2">
                                  <span className="bg-primary/10 border border-primary/20 rounded-lg px-2 py-0.5 text-[10px] font-black text-primary">{fmtN(post.engagement)} eng.</span>
                                  {post.engagementRate>0&&<span className="text-[10px] font-bold text-muted-foreground">{post.engagementRate.toFixed(1)}% ER</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {postsTotal > POST_LIMIT && (
                    <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/5">
                      <span className="text-xs text-muted-foreground">{(postPage-1)*POST_LIMIT+1}–{Math.min(postPage*POST_LIMIT,postsTotal)} of {postsTotal} posts</span>
                      <div className="flex gap-1">
                        <button disabled={postPage<=1} onClick={()=>setPostPage(p=>p-1)} className="p-1.5 rounded-lg border border-border disabled:opacity-30 hover:bg-muted/50"><ChevronLeft size={14}/></button>
                        <button disabled={postPage*POST_LIMIT>=postsTotal} onClick={()=>setPostPage(p=>p+1)} className="p-1.5 rounded-lg border border-border disabled:opacity-30 hover:bg-muted/50"><ChevronRight size={14}/></button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ══════════════ VIDEO & STORY ══════════════ */}
            {activeTab === "video" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Video & Story Analytics</h2><p className="text-xs text-muted-foreground">Performance metrics for video and story content</p></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard label="Video Views" value={kpis?.engagement.views ?? 0} growth={undefined} icon={Play} color="purple"/>
                  <KPICard label="Saves" value={kpis?.engagement.saved ?? 0} growth={undefined} icon={Bookmark} color="amber"/>
                  <KPICard label="Shares" value={kpis?.engagement.shares ?? 0} growth={undefined} icon={Share2} color="emerald"/>
                  <KPICard label="Comments" value={kpis?.engagement.comments ?? 0} growth={undefined} icon={MessageSquare} color="blue"/>
                </div>
                {capStatus(caps, 'story') === 'locked' && (
                  <SectionLock
                    title="Story Analytics"
                    desc="Story insights require the instagram_manage_insights permission. Reconnect Instagram with insights enabled to view story reach, replies, and completion data."
                  />
                )}
              </div>
            )}

            {/* ══════════════ AUDIENCE ══════════════ */}
            {activeTab === "audience" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Audience Insights</h2><p className="text-xs text-muted-foreground">Who is following your client's accounts</p></div>

                {/* Gender demographics */}
                {capAvailable(caps, 'demoGender') && (analytics?.demographics?.gender?.length ?? 0) > 0 ? (
                  <Card className="rounded-2xl shadow-sm border border-border/80">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-violet-500"/>Gender Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {analytics!.demographics.gender.map((g: any) => (
                          <div key={g.label} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-20 capitalize">{g.label}</span>
                            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-violet-400 rounded-full" style={{width:`${(g.fraction*100)}%`}}/>
                            </div>
                            <span className="text-sm font-bold w-14 text-right">{(g.fraction*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : capStatus(caps, 'demoGender') === 'locked' ? (
                  <SectionLock title="Gender Demographics" desc="Requires instagram_manage_insights or advanced Facebook Page access. Reconnect with the required permissions to view." />
                ) : capStatus(caps, 'demoGender') === 'importable' ? (
                  <SectionLock title="Gender Demographics" desc="Import your TikTok Studio export to see gender breakdown." />
                ) : null}

                {/* Top Countries */}
                {capAvailable(caps, 'demoCountry') && (analytics?.demographics?.country?.length ?? 0) > 0 ? (
                  <Card className="rounded-2xl shadow-sm border border-border/80">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Globe className="h-4 w-4 text-blue-500"/>Top Countries</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {analytics!.demographics.country.slice(0, 10).map((c: any) => (
                          <div key={c.label} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-20 uppercase">{c.label}</span>
                            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{width:`${(c.fraction*100)}%`}}/>
                            </div>
                            <span className="text-sm font-bold w-14 text-right">{(c.fraction*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : capStatus(caps, 'demoCountry') === 'locked' ? (
                  <SectionLock title="Top Countries" desc="Geographic data requires Business-level access. Enable advanced data access in Meta Business Suite." />
                ) : capStatus(caps, 'demoCountry') === 'importable' ? (
                  <SectionLock title="Top Countries" desc="Import your TikTok Studio export to see top countries." />
                ) : null}

                {/* If nothing is available at all */}
                {!capOf(caps, 'demoGender') && !capOf(caps, 'demoCountry') && (
                  <NoData msg="Audience demographics are not available for the selected platform" />
                )}
              </div>
            )}

            {/* ══════════════ BEST TIME ══════════════ */}
            {activeTab === "besttime" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Best Posting Time</h2><p className="text-xs text-muted-foreground">{heatmapGrid.source === 'import' ? "When your followers are most active — from imported TikTok Studio data" : "Optimal publishing times based on your historical engagement"}</p></div>

                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Clock className="h-4 w-4 text-amber-500"/>{heatmapGrid.source === 'import' ? "Follower Activity Heatmap" : "Engagement Heatmap"}</CardTitle>
                    <CardDescription className="text-xs">Darker = more {heatmapGrid.source === 'import' ? "active followers" : "engagement"} at that day/hour</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 overflow-x-auto">
                    {heatmapGrid.hasData ? (
                      <div>
                        <div className="flex gap-1 mb-1 pl-10">
                          {Array.from({length:24},(_,h)=>(
                            <div key={h} className="w-7 text-center text-[9px] text-muted-foreground font-medium shrink-0">
                              {h===0?"12a":h<12?`${h}a`:h===12?"12p":`${h-12}p`}
                            </div>
                          ))}
                        </div>
                        {heatmapGrid.grid.map((row, day) => (
                          <div key={day} className="flex items-center gap-1 mb-1">
                            <span className="w-8 text-[10px] font-bold text-muted-foreground shrink-0 text-right pr-1">{DAYS[day]}</span>
                            {row.map((val,hour) => {
                              const intensity = heatmapGrid.maxVal>0?val/heatmapGrid.maxVal:0;
                              return (
                                <div
                                  key={hour}
                                  title={`${DAYS_FULL[day]} ${hour}:00 — ${fmtN(val)} ${heatmapGrid.source === 'import' ? "active followers" : "engagement"}`}
                                  className="w-7 h-7 rounded-sm shrink-0 border border-border/20 cursor-pointer hover:scale-110 transition-transform"
                                  style={{
                                    background: intensity>0
                                      ? `rgba(99,102,241,${Math.max(intensity,0.08)})`
                                      : "rgba(0,0,0,0.03)"
                                  }}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <NoData msg="Publish content — or import TikTok Studio data — to generate the heatmap"/>
                    )}
                  </CardContent>
                </Card>

                {/* Top 5 slots */}
                {heatmapGrid.topSlots.length > 0 && (
                  <Card className="rounded-2xl shadow-sm border border-border/80">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold">Top 5 {heatmapGrid.source === 'import' ? "Most Active Slots" : "Best Posting Slots"}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {heatmapGrid.topSlots.map((t, i) => {
                        const hr = t.hour===0?12:t.hour>12?t.hour-12:t.hour;
                        const ap = t.hour<12?"AM":"PM";
                        const maxE = heatmapGrid.topSlots[0]?.value||1;
                        return (
                          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/40 last:border-0 hover:bg-muted/5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0">#{i+1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm">{DAYS_FULL[t.day]}</p>
                              <p className="text-xs text-muted-foreground">{hr}:00 {ap}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{width:`${(t.value/maxE)*100}%`}}/>
                              </div>
                              <span className="text-xs font-bold text-primary w-20 text-right">{fmtN(t.value)} {heatmapGrid.source === 'import' ? "active" : "eng."}</span>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ══════════════ PLATFORMS ══════════════ */}
            {activeTab === "platforms" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Platform Comparison</h2><p className="text-xs text-muted-foreground">Side-by-side performance across all connected platforms</p></div>
                <Card className="rounded-2xl shadow-sm border border-border/80 overflow-hidden">
                  <CardContent className="p-0">
                    {analytics.platformComparison.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/40 bg-muted/5">
                              {["Platform", platformFilter === "YOUTUBE" ? "Subscribers" : "Followers", "Reach", "Impressions", "Engagement", "Posts", "Growth"].map(h=>(
                                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {(analytics.platformComparison as any[]).sort((a,b)=>b.followers-a.followers).map((p:any) => (
                              <tr key={p.platform} className="hover:bg-muted/5 transition-colors">
                                <td className="px-5 py-4"><div className="flex items-center gap-2.5">{getPlatformIcon(p.platform,"h-4 w-4 object-contain")}<span className="capitalize font-semibold">{p.platform}</span></div></td>
                                <td className="px-5 py-4 font-bold">{fmtN(p.followers)}</td>
                                <td className="px-5 py-4">{fmtN(p.reach)}</td>
                                <td className="px-5 py-4">{fmtN(p.impressions)}</td>
                                <td className="px-5 py-4">{fmtN(p.engagement)}</td>
                                <td className="px-5 py-4">{fmtN(p.posts)}</td>
                                <td className="px-5 py-4"><Delta value={p.growth||0}/></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="py-12"><NoData msg="No platform data available — sync metrics first"/></div>}
                  </CardContent>
                </Card>

                {/* Platform chart */}
                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold">{platformFilter === "YOUTUBE" ? "Subscribers by Platform" : "Followers by Platform"}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-52 w-full">
                      {analytics.platformBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.platformBreakdown.sort((a,b)=>b.followers-a.followers)} layout="vertical" margin={{top:0,right:20,left:40,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)"/>
                            <XAxis type="number" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={v=>fmtN(Number(v))}/>
                            <YAxis dataKey="platform" type="category" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={70} tickFormatter={v=>v.charAt(0).toUpperCase()+v.slice(1)}/>
                            <Tooltip content={<ChartTip/>}/>
                            <Bar dataKey="followers" name={platformFilter === "YOUTUBE" ? "Subscribers" : "Followers"} fill="#6366f1" radius={[0,4,4,0]}>
                              {analytics.platformBreakdown.map((p,i) => <Cell key={p.platform} fill={PLATFORM_COLORS[p.platform]||PIE_PALETTE[i%PIE_PALETTE.length]}/>)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <NoData/>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══════════════ PUBLISHING ══════════════ */}
            {activeTab === "publishing" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Publishing Analytics</h2><p className="text-xs text-muted-foreground">Scheduler performance and post status tracking</p></div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                  {[
                    { label:"Published", value:analytics.publishing.published, icon:CheckCircle2, color:"emerald" },
                    { label:"Scheduled", value:analytics.publishing.scheduled, icon:Calendar, color:"blue" },
                    { label:"Draft", value:analytics.publishing.draft, icon:FileText, color:"amber" },
                    { label:"Failed", value:analytics.publishing.failed, icon:XCircle, color:"rose" },
                    { label:"Pending Approval", value:analytics.publishing.pendingApproval, icon:AlertCircle, color:"purple" },
                    { label:"Success Rate", value:analytics.publishing.successRate, icon:Target, color:"teal", isRate:true },
                  ].map(c => <KPICard key={c.label} growth={undefined} {...c}/>)}
                </div>

                {/* Success rate visual */}
                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5"><Target className="h-4 w-4 text-teal-500"/>Publishing Success Rate</CardTitle>
                    <CardDescription className="text-xs">Formula: (Published ÷ Attempted) × 100</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                      <div className="relative w-28 h-28 shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="12"/>
                          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="12"
                            stroke={analytics.publishing.successRate>=95?"#10b981":analytics.publishing.successRate>=80?"#f59e0b":"#ef4444"}
                            strokeDasharray={`${(analytics.publishing.successRate/100)*251.2} 251.2`}
                            strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-xl font-black text-foreground">{analytics.publishing.successRate}%</span>
                        </div>
                      </div>
                      <div className="space-y-3 flex-1">
                        {[
                          { label:"Total Attempted", val:analytics.publishing.published+analytics.publishing.failed, color:"bg-neutral-400" },
                          { label:"Successfully Published", val:analytics.publishing.published, color:"bg-emerald-500" },
                          { label:"Failed", val:analytics.publishing.failed, color:"bg-red-500" },
                        ].map(r => (
                          <div key={r.label} className="flex items-center gap-3 text-sm">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.color}`}/>
                            <span className="font-bold tabular-nums">{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly activity */}
                {(analytics.publishing.weeklyActivity||[]).length > 0 && (
                  <Card className="rounded-2xl shadow-sm border border-border/80">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                      <CardTitle className="text-sm font-bold">Weekly Publishing Activity</CardTitle>
                      <CardDescription className="text-xs">Posts published per week</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.publishing.weeklyActivity} margin={{top:5,right:5,left:-20,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)"/>
                            <XAxis dataKey="week" stroke="#9ca3af" fontSize={10} tickLine={false}/>
                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/>
                            <Tooltip content={<ChartTip/>}/>
                            <Bar dataKey="posts" name="Posts Published" fill="#6366f1" radius={[4,4,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ══════════════ ACCOUNTS ══════════════ */}
            {activeTab === "accounts" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Account Analytics</h2><p className="text-xs text-muted-foreground">Detailed metrics for every connected social account</p></div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {(analytics?.accounts||[]).map((acc) => {
                    const m = acc.latestMetrics;
                    const isHealthy = acc.healthStatus === "healthy";
                    const plat = acc.platform?.toLowerCase();
                    const slots = [
                      { key: "followers", label: plat === "youtube" ? "Subscribers" : "Followers", value: m?.followers ?? null, status: "available" as string },
                      { key: "reach", label: "Reach", value: m?.reach ?? null, status: acc.metricStatus?.reach || (m?.reach != null ? "available" : "unavailable") },
                      { key: "impressions", label: "Impressions", value: m?.impressions ?? null, status: acc.metricStatus?.impressions || (m?.impressions != null ? "available" : "unavailable") },
                    ];
                    const slotNote = (status: string) => status === "locked" ? (plat === "instagram" ? "Needs Instagram insights permission" : "Needs an extra platform permission") : `Not provided by ${acc.platform}`;
                    return (
                      <Card key={acc.id} className="rounded-2xl shadow-sm border border-border/80 overflow-hidden">
                        <div className="flex items-center gap-3 p-5 border-b border-border/40">
                          <div className="relative">
                            {acc.avatarUrl ? <img src={acc.avatarUrl} className="w-11 h-11 rounded-full border border-border object-cover" alt=""/> :
                              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center border border-border">{getPlatformIcon(acc.platform,"h-5 w-5")}</div>}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isHealthy?"bg-emerald-500":"bg-red-500"}`}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{acc.displayName||acc.platformUsername}</p>
                            <div className="flex items-center gap-1 mt-0.5">{getPlatformIcon(acc.platform,"h-3 w-3 object-contain")}<span className="text-xs text-muted-foreground capitalize">{acc.platform}</span></div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${isHealthy?"bg-emerald-50 text-emerald-600 border-emerald-100":"bg-red-50 text-red-500 border-red-100"}`}>
                            {isHealthy?"Connected":"Issue"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-0 divide-x divide-y divide-border/40">
                          {slots.map(slot => {
                            const shown = slot.status === "available" && slot.value != null;
                            return (
                              <div key={slot.key} className="p-4 text-center">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{slot.label}</p>
                                {shown ? (
                                  <p className="text-lg font-black text-foreground mt-1">{fmtN(slot.value)}</p>
                                ) : (
                                  <div className="mt-1 flex flex-col items-center" title={slotNote(slot.status)}>
                                    <span className="text-lg font-black text-muted-foreground/30 leading-none inline-flex items-center gap-1">
                                      {slot.status === "locked" && <Lock className="h-3 w-3"/>}—
                                    </span>
                                    <span className="text-[8px] text-muted-foreground/70 mt-1 leading-tight">{slot.status === "locked" ? "Enable to view" : "Not available"}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {plat === "instagram" && acc.metricStatus?.reach === "locked" && (
                          <div className="px-4 py-2 text-[10px] text-amber-700 bg-amber-50/60 border-t border-amber-100 flex items-center gap-1.5">
                            <Lock className="h-3 w-3 shrink-0"/> Reach &amp; impressions need the Instagram insights permission — reconnect to enable.
                          </div>
                        )}
                        {m?.engagementRate != null && m.engagementRate > 0 && (
                          <div className="px-5 py-3 border-t border-border/40 bg-muted/5 flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Engagement Rate</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{width:`${Math.min(m.engagementRate*10,100)}%`}}/>
                            </div>
                            <span className="text-xs font-bold text-emerald-600">{m.engagementRate.toFixed(1)}%</span>
                          </div>
                        )}
                        <div className="px-5 pb-3 pt-1 text-[10px] text-muted-foreground flex flex-col gap-2">
                          <div>Last sync: {m?.date ? new Date(m.date).toLocaleDateString() : "Never"}</div>
                          {acc.lastImportedAt && (
                            <div className="flex items-center gap-1 text-[10px] text-violet-600 bg-violet-50/50 border border-violet-100 px-2 py-1 rounded font-medium">
                              <Upload size={10}/> Imported from {acc.platform} Studio · {new Date(acc.lastImportedAt).toLocaleDateString()}
                            </div>
                          )}
                          {acc.healthStatus !== "healthy" && acc.healthMessage && (
                            <div className="text-[10px] text-red-600 bg-red-50/50 border border-red-100 px-2 py-1 rounded font-medium">
                              ⚠️ {acc.healthMessage}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══════════════ AI INSIGHTS ══════════════ */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">AI Insights</h2><p className="text-xs text-muted-foreground">Automated recommendations based on your analytics data</p></div>
                <div className="grid gap-4">
                  {analytics.aiInsights.length > 0 ? analytics.aiInsights.map((insight, i) => (
                    <Card key={i} className="rounded-2xl shadow-sm border border-border/80 hover:shadow-md transition-shadow">
                      <CardContent className="p-5 flex items-start gap-4">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Sparkles className="h-4 w-4"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{
                            __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          }}/>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <Card className="rounded-2xl border-dashed">
                      <CardContent className="flex flex-col items-center py-16 gap-3 text-center">
                        <Sparkles className="h-10 w-10 text-muted-foreground/30"/>
                        <p className="font-medium text-muted-foreground">No insights yet</p>
                        <p className="text-xs text-muted-foreground max-w-xs">Sync metrics and publish content for the AI to generate recommendations based on your data patterns.</p>
                        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="rounded-xl mt-2 gap-2">
                          <RefreshCw className={`h-4 w-4 ${isRefreshing?"animate-spin":""}`}/>Sync Metrics
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════ EXPORT ══════════════ */}
            {activeTab === "export" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Export Reports</h2><p className="text-xs text-muted-foreground">Download your analytics data</p></div>
                <div className="grid md:grid-cols-2 gap-5">
                  <Card className="rounded-2xl shadow-sm border border-border/80 hover:shadow-md cursor-pointer transition-all">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                      <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
                        <FileText className="h-6 w-6"/>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">CSV</h3>
                        <p className="text-xs text-muted-foreground mt-1">Raw data export for spreadsheets. Includes all posts, metrics, and engagement data.</p>
                      </div>
                      <Button onClick={exportCSV} className="rounded-xl w-full gap-2"><Download className="h-4 w-4"/>Export Now</Button>
                    </CardContent>
                  </Card>

                  {/* TikTok Studio Import panel */}
                  {connectedPlatforms.includes('tiktok') && (
                    <Card className="rounded-2xl shadow-sm border border-violet-200 hover:shadow-md transition-all">
                      <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-violet-50 text-violet-600 border border-violet-100">
                          <Upload className="h-6 w-6"/>
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">Import TikTok Studio Data</h3>
                          <p className="text-xs text-muted-foreground mt-1">Upload XLSX exports from TikTok Studio Analytics to enrich your dashboard with reach, demographics, and per-video metrics.</p>
                          {analytics?.provenance?.lastImportedAt && (
                            <p className="text-[10px] text-violet-600 mt-2">Last imported: {new Date(analytics.provenance.lastImportedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                        <label className="w-full">
                          <input
                            type="file"
                            multiple
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (!files?.length) return;
                              const tiktokAcct = analytics?.accounts?.find(a => a.platform.toLowerCase() === 'tiktok');
                              if (!tiktokAcct) { toast({ title: "No TikTok account", description: "Connect a TikTok account first.", variant: "destructive" }); return; }
                              const formData = new FormData();
                              Array.from(files).forEach(f => formData.append('files', f));
                              try {
                                // Route through apiFetch so the auth token comes from the
                                // in-memory store (it is deliberately NOT in localStorage) and
                                // 401s trigger a refresh. 'SKIP' lets the browser set the
                                // multipart boundary for FormData.
                                const data = await apiFetch<any>(`/social/import/tiktok/${tiktokAcct.id}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'SKIP' },
                                  body: formData,
                                });
                                const okFiles = data.summary?.files?.filter((f: any) => f.rows > 0).length || 0;
                                toast({ title: "✅ Import Complete", description: `Imported ${okFiles} file(s) successfully.` });
                                fetchAnalytics();
                              } catch (err: any) {
                                toast({ title: "Import Failed", description: err.message || "Unknown error", variant: "destructive" });
                              }
                              e.target.value = '';
                            }}
                          />
                          <Button variant="outline" className="rounded-xl w-full gap-2 border-violet-200 text-violet-600 hover:bg-violet-50" asChild>
                            <span><Upload className="h-4 w-4"/>Upload XLSX Files</span>
                          </Button>
                        </label>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* What's included */}
                <Card className="rounded-2xl shadow-sm border border-border/80">
                  <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                    <CardTitle className="text-sm font-bold">CSV Export Includes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        "Post captions and media types","Platform(s) posted to","Publication date and time",
                        "Likes, Comments, Shares, Saves","Video views and reach","Impressions per post",
                        "Engagement total and ER%","Destination platform breakdown","Filtered by your current date range & platform",
                      ].map(item => (
                        <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0"/>{item}
                        </div>
                      ))}
                    </div>
                    <Button onClick={exportCSV} className="mt-5 rounded-xl gap-2" disabled={posts.length===0}>
                      <Download className="h-4 w-4"/>Download CSV ({posts.length} posts)
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      )}

      <PostDetailDialog
        postId={detailPostId}
        open={detailPostId !== null}
        onOpenChange={open => { if (!open) setDetailPostId(null); }}
      />
    </div>
  );
}
