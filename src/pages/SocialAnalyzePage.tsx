/* eslint-disable @typescript-eslint/no-explicit-any -- analytics payloads are untyped server JSON */
import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch, getFullUrl } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { capStatus, capAvailable, capOf, type Capabilities, type MetricKey } from "@/lib/platform-capabilities";
import { PostDetailDialog, openExternal } from "@/components/social/PostDetailDialog";
import { ClearImportedDataDialog } from "@/components/social/ClearImportedDataDialog";
import { compactNumber } from "@/lib/social/format";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell,
  LineChart, Line, ComposedChart,
} from "recharts";
import {
  Users, Eye, TrendingUp, UserPlus, RefreshCw, BarChart2, Heart, MessageSquare, ChevronDown,
  Share2, Search, Calendar, Filter, Download, Bookmark, Play,
  ArrowUp, ArrowDown, Minus, ChevronLeft, ChevronRight, Activity, Zap, Target, Upload, Lock, Info,
  Globe, Clock, CheckCircle2, XCircle, AlertCircle, FileText, Repeat2, LayoutGrid,
  Image, Video, Film, BookOpen, Layers, List, BarChart3, Sparkles, Send, ExternalLink, Trash2,
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
  latestMetrics: {
    followers: number | null;
    reach: number | null;
    impressions: number | null;
    profileVisits: number | null;
    videoViews: number | null;
    engagementRate: number | null;
    date: string | null;
    periodDays?: number;
  } | null;
}

interface Client { id: string; name: string; company: string }

// ─────────────────────────── Constants ───────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2", instagram: "#E1306C", tiktok: "#010101",
  youtube: "#FF0000", linkedin: "#0A66C2", x: "#14171A",
  twitter: "#1DA1F2", threads: "#313131",
};

const PIE_PALETTE = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
const platColor = (name: string, i: number) => PLATFORM_COLORS[name] || PIE_PALETTE[i % PIE_PALETTE.length];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const CONTENT_TYPE_ICONS: Record<string,any> = {
  image: Image, video: Video, reel: Film, short: Film, story: BookOpen,
  carousel: Layers, text: FileText,
};
const POST_LIMIT = 10;

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
type EngFocus = "total" | EngSeriesKey | "score";
const ENG_FOCUS: { key: EngFocus; label: string; color: string; derived?: boolean }[] = [
  { key: "total", label: "Total (All Metrics)", color: "#6366f1" },
  ...ENG_SERIES,
  { key: "score", label: "Weighted Score", color: "#7c3aed", derived: true },
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

const PLATFORM_ICONS: Record<string, string> = {
  facebook: "/social-icons/Facebook.png", instagram: "/social-icons/instagram.png",
  threads: "/social-icons/Threads.png", tiktok: "/social-icons/tiktok.png",
  linkedin: "/social-icons/linkedin.png", youtube: "/social-icons/youtube.png",
  x: "/social-icons/twitter.png", twitter: "/social-icons/twitter.png",
  pinterest: "/social-icons/pinterest.png",
};

const KPI_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  teal: "bg-teal-50 text-teal-600 border-teal-100",
};

// Quick presets inside the custom-range popover → [start, end].
const DATE_PRESETS: [string, () => [Date, Date]][] = [
  ["Last 14D", () => { const n = new Date(); return [new Date(n.getTime() - 14 * 86400000), n]; }],
  ["This Month", () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; }],
  ["Last Month", () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)]; }],
];

// ─────────────────────────── Utilities ───────────────────────────────────────
// Local calendar date. toISOString() is UTC, which east of UTC turned "This Month"
// into the last day of the previous month.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const compactTick = (v: any) => compactNumber(Number(v));

const getPlatformIcon = (platform: string, cls = "h-4 w-4 rounded-sm object-contain") => {
  const src = PLATFORM_ICONS[platform?.toLowerCase()];
  return src ? <img src={src} className={cls} alt={platform} /> : <BarChart2 className={cls} />;
};

/**
 * Render **bold** spans as real elements. Replaces a dangerouslySetInnerHTML
 * that ran a regex over strings containing client-controlled values (platform
 * names, content types), which is an HTML-injection sink.
 */
const renderBold = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );

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

/** The standard dashboard card: bold title (optional icon), optional description, body. */
const Panel = ({ title, icon, desc, className = "", content = "p-6", children }: {
  title: ReactNode; icon?: ReactNode; desc?: ReactNode; className?: string; content?: string; children: ReactNode;
}) => (
  <Card className={`rounded-2xl shadow-sm border border-border/80 ${className}`}>
    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
      <CardTitle className={icon ? "text-sm font-bold flex items-center gap-1.5" : "text-sm font-bold"}>{icon}{title}</CardTitle>
      {desc != null && <CardDescription className="text-xs">{desc}</CardDescription>}
    </CardHeader>
    <CardContent className={content}>{children}</CardContent>
  </Card>
);

// ─────────────────────────── KPI Card ────────────────────────────────────────
const KPICard = ({ label, value, growth, icon: Icon, color, isRate = false, suffix = "", status, note, platforms }: any) => {
  const isUnavailable = status === 'locked' || status === 'importable';
  return (
    <Card className={`rounded-2xl shadow-sm border border-border/80 hover:shadow-md transition-all duration-200 cursor-default group ${isUnavailable ? 'opacity-55 grayscale-[30%]' : ''}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center border shadow-sm shrink-0 ${isUnavailable ? 'bg-muted text-muted-foreground border-border' : (KPI_COLORS[color] || KPI_COLORS.blue)}`}>
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
              {isRate ? `${Number(value ?? 0).toFixed(1)}%` : compactNumber(value)}{suffix}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {growth != null && <Delta value={growth} />}
              {platforms && platforms.length > 0 && platforms.length < 5 && (
                <div className="flex items-center gap-1 bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-full shadow-2xs">
                  {platforms.map((p: string) => (
                    <span key={p} title={cap(p)} className="inline-flex items-center">
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

// ─────────────────────────── Charts ──────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const formattedDate = isNaN(d.getTime()) ? label : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const totalSum = payload.reduce((acc: number, p: any) => acc + (Number(p.value) || 0), 0);

  return (
    <div className="bg-card/95 backdrop-blur border border-border/80 rounded-xl shadow-xl p-3 text-xs min-w-[160px] space-y-1.5">
      <div className="flex items-center justify-between border-b border-border/40 pb-1.5 mb-1 gap-2">
        <span className="font-bold text-foreground">{formattedDate}</span>
        {payload.length > 1 && (
          <span className="text-[11px] font-extrabold text-primary font-mono">{compactNumber(totalSum)} total</span>
        )}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey || p.name} className="flex items-center justify-between gap-3 text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: p.color || p.stroke }} />
            <span className="font-medium text-foreground/90 capitalize truncate">{p.name}:</span>
          </div>
          <span className="font-bold text-foreground font-mono">{compactNumber(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
};

/** A daily time-series chart over `chartData` with the shared grid/axes/tooltip. */
const TimeChart = ({ data, cls, chart: Chart, defs, children }: {
  data: any[]; cls: string; chart: typeof LineChart; defs?: ReactNode; children: ReactNode;
}) => (
  <div className={cls}>
    {data.length > 0 ? (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{top:5,right:5,left:-20,bottom:0}}>
          {defs}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)"/>
          <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={v=>v.slice(5)}/>
          <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={compactTick}/>
          <Tooltip content={<ChartTip/>}/>
          {children}
        </Chart>
      </ResponsiveContainer>
    ) : <NoData/>}
  </div>
);

// ─────────────────────────── Monthly comparison row ──────────────────────────
const CompareRow = ({ label, curr, prev }: { label: string; curr: number; prev: number }) => {
  const g = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  return (
    // The fixed label + two 80px numbers + bar + delta needed ~390px, so on a
    // phone the delta badge fell off the edge. The label takes its own line
    // below sm and the number columns narrow.
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 border-b border-border/40 last:border-0 sm:flex-nowrap sm:gap-4">
      <span className="w-full text-sm font-medium text-muted-foreground sm:w-28 sm:shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:w-20">{compactNumber(prev)}</span>
        <div className="h-1.5 min-w-[20px] flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary/30 rounded-full" style={{ width: `${prev > 0 ? Math.min((curr / Math.max(curr, prev)) * 100, 100) : 0}%` }} />
        </div>
        <span className="w-14 shrink-0 text-sm font-bold text-foreground tabular-nums sm:w-20">{compactNumber(curr)}</span>
      </div>
      <span className="shrink-0"><Delta value={parseFloat(g.toFixed(1))} /></span>
    </div>
  );
};

// ─────────────────────────── Post Thumbnail ──────────────────────────────────
const getFirstMediaUrl = (mediaUrls: any): string | null => {
  if (Array.isArray(mediaUrls)) {
    return mediaUrls.length > 0 && typeof mediaUrls[0] === 'string' ? mediaUrls[0] : null;
  }
  if (!mediaUrls || typeof mediaUrls !== 'string') return null;
  if (mediaUrls.startsWith('[')) {
    try {
      const parsed = JSON.parse(mediaUrls);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch { /* not JSON — treat as a plain URL */ }
  }
  return mediaUrls;
};

const PostThumbnail = ({ mediaUrls, mediaType, thumbnailUrl }: { mediaUrls: any; mediaType?: string | null; thumbnailUrl?: string | null }) => {
  const [imgError, setImgError] = useState(false);
  const rawUrl = thumbnailUrl || getFirstMediaUrl(mediaUrls);
  const isVid = mediaType === "video" || mediaType === "reel" || mediaType === "short";

  if (!rawUrl || imgError) {
    const IconComponent = isVid ? Video : (mediaType === "image" || mediaType === "carousel" ? Image : BarChart2);
    return (
      <div className="h-16 w-16 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 border border-border/50 shadow-sm">
        <IconComponent className="h-5 w-5 text-muted-foreground/70" />
      </div>
    );
  }

  const resolved = getFullUrl(rawUrl);
  if (/\.(mp4|mov|webm|m4v|ogv|avi)(\?.*)?$/i.test(rawUrl)) {
    return (
      <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-border/50 shadow-sm bg-black/90 flex items-center justify-center">
        <video src={resolved} className="h-full w-full object-cover" muted preload="metadata" onError={() => setImgError(true)} />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <Play className="h-4 w-4 text-white fill-white opacity-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <img src={resolved} className="h-full w-full object-cover" alt="" onError={() => setImgError(true)} />
      {isVid && (
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
  // Set when the date window held more posts than the server ranks in one pass,
  // so the list can say so instead of quietly showing a partial ranking.
  const [postsTruncated, setPostsTruncated] = useState<{ rowCap: number } | null>(null);
  const [postPage, setPostPage] = useState(1);
  const [postSort, setPostSort] = useState<"engagement"|"likes"|"views"|"newest"|"oldest">("engagement");
  const [postsLoading, setPostsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [postSearch, setPostSearch] = useState("");
  const [debouncedPostSearch, setDebouncedPostSearch] = useState("");

  const aiInsightsRequestRef = useRef(0);
  const [aiInsightsState, setAiInsightsState] = useState<{
    insights: string[];
    loading: boolean;
    source: "ai" | "fallback";
    reason: string | null;
    // Set once a request settles, so an empty or failed answer is not re-requested
    // in a loop while the tab stays open (Regenerate still forces a new one).
    attempted: boolean;
  }>({ insights: [], loading: false, source: "fallback", reason: null, attempted: false });

  // Post detail panel (metrics for one post + link out to the live post)
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [clearImportOpen, setClearImportOpen] = useState(false);

  // Global filters
  const [activeTab, setActiveTab] = useState("overview");
  const [dateMode, setDateMode] = useState<"preset" | "custom">("preset");
  const [dateRange, setDateRange] = useState<number>(30);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [tempStartDate, setTempStartDate] = useState<string>(() => ymd(new Date(Date.now() - 30 * 86400000)));
  const [tempEndDate, setTempEndDate] = useState<string>(() => ymd(new Date()));
  const [isCustomDateOpen, setIsCustomDateOpen] = useState<boolean>(false);
  // Phones only: the date/platform/type filters collapse behind a toggle so the
  // page doesn't open with ~700px of controls before a single number.
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [contentTypeFilter, setContentTypeFilter] = useState("ALL");
  const [chartMetric, setChartMetric] = useState<"followers"|"reach"|"impressions"|"engagementRate">("followers");

  // Engagement Trend focus (persisted, so the filter ALWAYS applies across sessions)
  const [engFocus, setEngFocus] = useState<EngFocus>(() => {
    try { return (JSON.parse(localStorage.getItem(ENG_VIEW_KEY) || "{}").focus as EngFocus) || "total"; } catch { return "total"; }
  });
  const [engShowAvg, setEngShowAvg] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(ENG_VIEW_KEY) || "{}").showAvg !== false; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem(ENG_VIEW_KEY, JSON.stringify({ focus: engFocus, showAvg: engShowAvg })); } catch { /* ignore */ } }, [engFocus, engShowAvg]);

  const isCustomRange = dateMode === "custom" && !!customStartDate && !!customEndDate;
  const dateRangeText = isCustomRange ? `${customStartDate} to ${customEndDate}` : `${dateRange} days`;

  const analyticsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (isCustomRange) {
      params.set("startDate", customStartDate);
      params.set("endDate", customEndDate);
      const calculatedDays = Math.max(1, Math.round((new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) / 86400000));
      params.set("days", String(calculatedDays));
    } else {
      params.set("days", String(dateRange));
    }
    params.set("platform", platformFilter);
    params.set("contentType", contentTypeFilter);
    return params.toString();
  }, [isCustomRange, customStartDate, customEndDate, dateRange, platformFilter, contentTypeFilter]);

  /**
   * Ask the server to write real insights from the analytics already on screen.
   * On-demand rather than part of /full: an LLM call on every page load would be
   * slow and costly, and most visits never open this tab.
   */
  const fetchAiInsights = useCallback(async (force = false) => {
    if (!selectedClient || !analytics) return;
    if (!force && (aiInsightsState.loading || aiInsightsState.attempted)) return;

    const requestId = ++aiInsightsRequestRef.current;
    setAiInsightsState(s => ({ ...s, loading: true, reason: null }));
    try {
      // Send the numbers the page already has rather than recomputing them.
      const facts = {
        calculatedInsights: analytics.aiInsights,
        kpis: analytics.kpis,
        monthlyComparison: analytics.monthlyComparison,
        platformComparison: analytics.platformComparison,
        publishing: analytics.publishing,
        contentTypePerformance: analytics.contentTypePerformance,
        bestTimes: analytics.bestTimes,
      };
      const res = await apiFetch<{ insights: string[]; source: string; reason?: string }>(
        `/social/analytics/${selectedClient}/insights`,
        { method: "POST", body: JSON.stringify({ facts, days: dateRange, platform: platformFilter }) }
      );
      if (aiInsightsRequestRef.current !== requestId) return;
      setAiInsightsState({
        insights: res.insights || [],
        loading: false,
        source: res.source === "ai" && (res.insights || []).length > 0 ? "ai" : "fallback",
        reason: res.reason ?? null,
        attempted: true,
      });
    } catch (err: any) {
      if (aiInsightsRequestRef.current !== requestId) return;
      setAiInsightsState({ insights: [], loading: false, source: "fallback", reason: err.message || "AI insights are unavailable.", attempted: true });
    }
  }, [selectedClient, analytics, aiInsightsState.loading, aiInsightsState.attempted, dateRange, platformFilter]);

  // Generate when the tab is opened, not on page load.
  useEffect(() => {
    if (activeTab === "ai") fetchAiInsights();
  }, [activeTab, fetchAiInsights]);

  // A different client / range / platform invalidates whatever was generated.
  useEffect(() => {
    aiInsightsRequestRef.current++;
    setAiInsightsState({ insights: [], loading: false, source: "fallback", reason: null, attempted: false });
  }, [selectedClient, dateRange, platformFilter]);

  /** AI prose when we have it, the calculated sentences otherwise. */
  const displayedInsights = aiInsightsState.insights.length > 0 ? aiInsightsState.insights : (analytics?.aiInsights ?? []);

  useEffect(() => {
    Promise.all([
      apiFetch<any>("/clients"),
      apiFetch<any>("/social/accounts?limit=1000").catch(() => null),
    ]).then(([clientsRes, accountsRes]) => {
      const list: Client[] = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.clients || []);
      const accs = Array.isArray(accountsRes) ? accountsRes : (accountsRes?.accounts || []);
      const clientIdsWithAccounts = new Set<string>(accs.filter((acc: any) => acc.clientId).map((acc: any) => acc.clientId));
      const filtered = list.filter(c => clientIdsWithAccounts.has(c.id) || ((c as any)._count?.socialAccounts ?? 0) > 0);
      const shown = filtered.length > 0 ? filtered : list;
      setClients(shown);
      if (shown.length > 0) setSelectedClient(shown[0].id);
    }).catch((err: any) => {
      // A failed /clients load used to leave the dropdown silently empty
      // forever, indistinguishable from "no clients have accounts yet".
      toast({ title: "Error loading clients", description: err.message, variant: "destructive" });
    });
  }, [toast]);

  // Debounce search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedPostSearch(postSearch), 300);
    return () => clearTimeout(handler);
  }, [postSearch]);

  // Monotonic request counters: switching client/filters quickly can resolve
  // an older, slower response after a newer one — these guard against
  // committing a stale response under the current selection.
  const analyticsRequestRef = useRef(0);
  const postsRequestRef = useRef(0);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedClient) return;
    const requestId = ++analyticsRequestRef.current;
    setIsLoading(true);
    try {
      const res = await apiFetch<FullAnalytics>(`/social/analytics/${selectedClient}/full?${analyticsQuery}`);
      if (analyticsRequestRef.current !== requestId) return;
      setAnalytics(res);
    } catch (err: any) {
      if (analyticsRequestRef.current !== requestId) return;
      toast({ title: "Error loading analytics", description: err.message, variant: "destructive" });
    } finally {
      if (analyticsRequestRef.current === requestId) setIsLoading(false);
    }
  }, [selectedClient, analyticsQuery, toast]);

  const fetchPosts = useCallback(async () => {
    if (!selectedClient) return;
    const requestId = ++postsRequestRef.current;
    setPostsLoading(true);
    try {
      const res = await apiFetch<any>(
        `/social/analytics/${selectedClient}/posts?page=${postPage}&limit=${POST_LIMIT}&sortBy=${postSort}&search=${encodeURIComponent(debouncedPostSearch)}&${analyticsQuery}`
      );
      if (postsRequestRef.current !== requestId) return;
      setPosts(res.posts || []);
      setPostsTotal(res.total || 0);
      setPostsTruncated(res.truncated ? { rowCap: res.rowCap } : null);
    } catch (err: any) {
      if (postsRequestRef.current !== requestId) return;
      toast({ title: "Error loading posts", description: err.message, variant: "destructive" });
    } finally {
      if (postsRequestRef.current === requestId) setPostsLoading(false);
    }
  }, [selectedClient, postPage, postSort, debouncedPostSearch, analyticsQuery, toast]);

  const reloadAll = () => Promise.all([fetchAnalytics(), fetchPosts()]);

  useEffect(() => {
    if (selectedClient) { fetchAnalytics(); setPostPage(1); }
    else { setAnalytics(null); setPosts([]); }
  }, [selectedClient, fetchAnalytics]);

  // The post list loads on its own, not only when "Sync Metrics" is pressed —
  // paging, sorting and searching all run through here too.
  useEffect(() => {
    if (selectedClient) fetchPosts();
  }, [selectedClient, fetchPosts]);

  const handleRefresh = async () => {
    if (!selectedClient || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await apiFetch<any>(`/social/analytics/${selectedClient}/refresh`, { method: "POST" });
      toast({
        title: res.partial ? "⚠️ Partially Synced" : "✅ Metrics & Video Thumbnails Synced",
        description: res.message || "Fresh metrics, video thumbnails, and verifications pulled.",
        variant: res.partial ? "destructive" : "default",
      });
      await reloadAll();
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally { setIsRefreshing(false); }
  };

  // Fetches every page (not just the one currently on screen — the endpoint
  // caps at 50 posts per page) so "Includes all posts" is actually true.
  const exportCSV = async () => {
    if (!selectedClient || postsTotal === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const PAGE_SIZE = 50; // server-side cap on /posts?limit=
      const all: any[] = [];
      for (let page = 1; ; page++) {
        const res = await apiFetch<any>(
          `/social/analytics/${selectedClient}/posts?page=${page}&limit=${PAGE_SIZE}&sortBy=${postSort}&search=${encodeURIComponent(postSearch)}&${analyticsQuery}`
        );
        const batch = res.posts || [];
        all.push(...batch);
        if (batch.length < PAGE_SIZE || all.length >= (res.total || 0)) break;
      }

      const hdr = "Caption,Platform(s),Date,Type,Likes,Comments,Shares,Saved,Views,Reach,Impressions,Engagement,ER%\n";
      const rows = all.map(p => [
        `"${(p.caption||"").replace(/"/g,"'")}"`,
        (p.destinations||[]).map((d:any)=>d.platform).join("|"),
        p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "",
        p.mediaType || "text",
        p.likes, p.comments, p.shares, p.saved, p.views, p.reach, p.impressions, p.engagement, p.engagementRate,
      ].join(",")).join("\n");
      Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([hdr+rows], { type:"text/csv" })),
        download: `analytics_${ymd(new Date())}.csv`,
      }).click();
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Derived values
  const kpis = analytics?.kpis;
  const caps = analytics?.capabilities;
  const tiktokAcct = analytics?.accounts?.find(a => a.platform.toLowerCase() === 'tiktok');
  const isYT = platformFilter === "YOUTUBE";
  const fol = isYT ? "Subscribers" : "Followers";
  const connectedPlatforms = useMemo(
    () => Array.from(new Set((analytics?.accounts||[]).map(a => a.platform.toLowerCase()))),
    [analytics]
  );
  const chartData = analytics?.chartData || [];
  const pieData = (analytics?.platformBreakdown||[]).filter(p => p.followers > 0 || p.reach > 0)
    .map(p => ({ name: p.platform, value: p.followers || p.reach || 1 }));
  const pieTotal = pieData.reduce((s,x)=>s+x.value,0);

  const importTikTok = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
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
      // Refresh both halves: the imported videos land in
      // the post list, which the analytics call doesn't touch.
      await reloadAll();
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message || "Unknown error", variant: "destructive" });
    }
    e.target.value = '';
  };

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
  const capKpi = (key: MetricKey, label: string, kpiData: NullableKPI | null | undefined, icon: any, color: string, isRate?: boolean) => {
    const c = capOf(caps, key);
    if (!c) return null; // metric doesn't exist for any active platform — omit entirely
    return { label, value: kpiData?.current ?? 0, growth: kpiData?.growth, icon, color, isRate, status: c.status, note: c.note, platforms: c.platforms };
  };

  // Heatmap: prefer real active-followers from imported data, fall back to post-engagement
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const actHeatmap = analytics?.activityHeatmap || [];
    if (actHeatmap.length > 0) {
      for (const a of actHeatmap) grid[a.weekday][a.hour] = a.activeFollowers;
    } else {
      for (const t of (analytics?.bestTimes||[])) grid[t.day][t.hour] = t.engagement;
    }
    const flat: { day: number; hour: number; value: number }[] = [];
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (grid[d][h] > 0) flat.push({ day: d, hour: h, value: grid[d][h] });
    const topSlots = flat.sort((a, b) => b.value - a.value).slice(0, 5);
    const maxVal = Math.max(...grid.flat(), 1);
    return { grid, maxVal, topSlots, hasData: flat.length > 0, isImport: actHeatmap.length > 0 };
  }, [analytics]);

  // Shown on the collapsed mobile Filters button so a narrowed view is never a
  // silent one.
  const activeFilterCount =
    (dateMode === "custom" || dateRange !== 30 ? 1 : 0) +
    (platformFilter !== "ALL" ? 1 : 0) +
    (contentTypeFilter !== "ALL" ? 1 : 0);

  const seg = (on: boolean) => on ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">
      {/*
        Pinned only from lg up. On a phone this bar stacks to roughly 440px, so
        pinning it left barely a third of the screen for the actual analytics —
        it scrolls away with the content instead.
      */}
      <div className="lg:sticky lg:top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
            <p className="hidden sm:block text-xs text-muted-foreground">Social media performance across all connected platforms</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <Select value={selectedClient || "none"} onValueChange={val => {
              setSelectedClient(val === "none" ? "" : val);
              setPostPage(1);
            }}>
              <SelectTrigger className="border border-border bg-background rounded-xl px-3 py-2 h-9 text-sm font-semibold shadow-sm w-full sm:w-48 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Select Client" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">-- Select Client --</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedClient && (
              <>
                <Button variant="outline" disabled={isRefreshing||isLoading} onClick={handleRefresh} className="rounded-xl h-9 px-3 gap-1.5 text-sm">
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing?"animate-spin":""}`} />
                  <span className="hidden sm:inline">Sync Metrics</span>
                  <span className="sm:hidden">Sync</span>
                </Button>
                <Button variant="outline" onClick={exportCSV} disabled={isExporting || postsTotal===0} className="rounded-xl h-9 px-3 gap-1.5 text-sm">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
                {!isLoading && analytics && (
                  <Button
                    variant="outline"
                    onClick={() => setShowMobileFilters(v => !v)}
                    aria-expanded={showMobileFilters}
                    className="rounded-xl h-9 px-3 gap-1.5 text-sm lg:hidden"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                        {activeFilterCount}
                      </span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMobileFilters ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Global Filters */}
        {selectedClient && !isLoading && analytics && (
          <div className={`${showMobileFilters ? "flex" : "hidden"} lg:flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/40`}>
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex bg-muted/30 border border-border rounded-lg p-0.5 gap-0.5 items-center">
                {([7,30,90] as const).map(d => (
                  <button key={d} onClick={() => { setDateMode("preset"); setDateRange(d); }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${seg(dateMode==="preset" && dateRange===d)}`}>
                    {d}D
                  </button>
                ))}

                <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                  <PopoverTrigger asChild>
                    <button className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${seg(dateMode==="custom")}`}>
                      <span>Custom</span>
                      {isCustomRange && <span className="text-[10px] opacity-90 font-medium">({customStartDate} to {customEndDate})</span>}
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
                        {([["Start Date", tempStartDate, setTempStartDate], ["End Date", tempEndDate, setTempEndDate]] as const).map(([label, value, set]) => (
                          <div key={label} className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</label>
                            <Input type="date" value={value} onChange={(e) => set(e.target.value)} className="h-8 text-xs rounded-lg" />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/40">
                        <span className="text-[10px] text-muted-foreground font-semibold mr-1">Presets:</span>
                        {DATE_PRESETS.map(([label, range]) => (
                          <button key={label} type="button"
                            onClick={() => { const [s, e] = range(); setTempStartDate(ymd(s)); setTempEndDate(ymd(e)); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted font-medium transition-colors">
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5 rounded-lg" onClick={() => setIsCustomDateOpen(false)}>
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
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${seg(platformFilter==="ALL")}`}>All</button>
                {connectedPlatforms.map(p => (
                  <button key={p} onClick={() => setPlatformFilter(p.toUpperCase())}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${seg(platformFilter===p.toUpperCase())}`}>
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
                  <SelectItem key={t} value={t} className="capitalize">{cap(t)}</SelectItem>
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
        <div className="flex flex-col lg:flex-row">
          {/*
            Tabs are a horizontal scroller on phones and a vertical rail from lg
            up. As a fixed w-44 rail it left roughly 150px of usable width on a
            375px screen, which clipped every KPI number.
          */}
          <nav
            aria-label="Analytics sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/50 bg-muted/10 px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:sticky lg:top-0 lg:w-44 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-2 lg:py-4 lg:max-h-[calc(100dvh-4rem)] [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-all lg:w-full lg:gap-2.5 lg:py-2.5 lg:text-left ${activeTab===id?"bg-primary text-primary-foreground shadow-sm":"text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                <Icon className="h-3.5 w-3.5 shrink-0"/>
                {id === "followers" && isYT ? "Subscribers" : label}
              </button>
            ))}
          </nav>

          {/* ── Content Area ── */}
          <div className="flex-1 overflow-x-hidden p-4 space-y-6 min-w-0 sm:p-6">

            {/* ══════════════ OVERVIEW ══════════════ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Overview</h2>
                  <p className="text-xs text-muted-foreground">Key performance indicators for {dateRangeText}</p>
                </div>
                {/* Adaptive KPI cards — only metrics this platform can report */}
                {(() => {
                  const er = kpis?.engagementRate;
                  const cards = [
                    capKpi('followers', `Total ${fol}`, kpis?.followers, Users, "blue"),
                    capKpi('reach', "Total Reach", kpis?.reach, TrendingUp, "emerald"),
                    capKpi('impressions', "Impressions", kpis?.impressions, Eye, "purple"),
                    capKpi('profileVisits', "Profile Visits", kpis?.profileVisits, UserPlus, "amber"),
                    capKpi('videoViews', "Video Views", kpis?.videoViews, Play, "teal"),
                    capKpi('engagementRate', "Engagement Rate", er ? { ...er, growth: er.change } : null, Activity, "rose", true),
                    // Posts Published is always real (local data)
                    { label: "Posts Published", value: kpis?.publishing.published ?? 0, icon: Zap, color: "indigo" },
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
                              {m==="engagementRate"?"Eng.Rate":cap(m)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <TimeChart data={chartData} cls="h-64 w-full" chart={AreaChart} defs={
                        <defs>
                          <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      }>
                        <Area type="monotone" dataKey={chartMetric} stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#gArea)" dot={false} activeDot={{r:5}}/>
                      </TimeChart>
                    </CardContent>
                  </Card>

                  {/* Platform Pie */}
                  <Panel className="overflow-hidden" content="p-6 flex flex-col items-center gap-4" icon={<Target className="h-4 w-4 text-indigo-500"/>} title="Audience Split"
                    desc={`${fol.slice(0, -1)} distribution by platform`}>
                    {pieData.length > 0 ? (
                      <>
                        <div className="h-40 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                                {pieData.map((e,i) => <Cell key={e.name} fill={platColor(e.name, i)}/>)}
                              </Pie>
                              <Tooltip formatter={compactTick} contentStyle={{borderRadius:"10px",fontSize:12}}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-1.5">
                          {pieData.map((e,i) => (
                            <div key={e.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:platColor(e.name, i)}}/><span className="capitalize font-medium">{e.name}</span></div>
                              <div className="flex items-center gap-2"><span className="text-muted-foreground">{compactNumber(e.value)}</span><span className="font-bold">{pieTotal>0?((e.value/pieTotal)*100).toFixed(1):"0"}%</span></div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <NoData msg="No follower data yet — sync metrics"/>}
                  </Panel>
                </div>

                {/* Monthly Comparison */}
                <Panel icon={<BarChart3 className="h-4 w-4 text-violet-500"/>} title="Period Comparison" desc={<>Current ({dateRangeText}) vs. previous period</>}>
                  {analytics.monthlyComparison ? (
                    <div className="space-y-0">
                      {([[fol,"followers"],["Reach","reach"],["Impressions","impressions"],["Engagement","engagement"],["Posts","posts"],["Video Views","views"]] as const).map(([label, k]) => (
                        <CompareRow key={k} label={label} curr={analytics.monthlyComparison.current[k]} prev={analytics.monthlyComparison.previous[k]}/>
                      ))}
                    </div>
                  ) : <NoData/>}
                </Panel>
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
                  ].map(c => <KPICard key={c.label} {...c}/>)}
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
                          {[
                            { label: <>{engFocusMeta.label} · Total {engFocusMeta.derived && <Sparkles className="h-2.5 w-2.5 text-violet-500"/>}</>, value: engStats.focusTotal, color: engFocusMeta.color },
                            { label: "Peak Day", value: engStats.peak },
                            { label: "Daily Average", value: engStats.avg },
                          ].map((s, i) => (
                            <div key={i} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                              <p className={i === 0 ? "text-[9px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1" : "text-[9px] font-bold text-muted-foreground uppercase tracking-wide"}>{s.label}</p>
                              <p className="text-xl font-black leading-tight mt-0.5" style={s.color ? { color: s.color } : undefined}>{compactNumber(s.value)}</p>
                            </div>
                          ))}
                        </div>

                        {/* Interactive multi-metric / focus-metric chart */}
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={engData} margin={{top:12,right:12,left:-16,bottom:0}}>
                              <defs>
                                {ENG_FOCUS.map(f => (
                                  <linearGradient key={f.key} id={`engGrad${cap(f.key)}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={f.color} stopOpacity={0.25}/>
                                    <stop offset="95%" stopColor={f.color} stopOpacity={0.01}/>
                                  </linearGradient>
                                ))}
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)"/>
                              <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}
                                tickFormatter={v => {
                                  const d = new Date(v);
                                  return isNaN(d.getTime()) ? String(v).slice(5) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                }}
                                minTickGap={24}
                              />
                              <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={compactTick} width={44}/>
                              <Tooltip content={<ChartTip/>} cursor={{ stroke: engFocusMeta.color, strokeOpacity: 0.3, strokeWidth: 1.5 }}/>

                              {engFocus === "total" ? (
                                <>
                                  <Area type="monotone" dataKey="total" name="Total Interactions" stroke="#6366f1" strokeWidth={2.5} fill="url(#engGradTotal)" fillOpacity={0.15} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                                  {ENG_SERIES.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
                                </>
                              ) : (
                                <Area type="monotone" dataKey={engFocus} name={engFocusMeta.label} stroke={engFocusMeta.color} strokeWidth={2.5}
                                  fill={`url(#engGrad${cap(engFocus)})`}
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
                            <span className="text-[10px] text-muted-foreground font-semibold">{compactNumber(engStats.compTotal)} total interactions</span>
                          </div>
                          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted gap-[2px]">
                            {engStats.comp.map(c => c.value > 0 && (
                              <div key={c.key} style={{ width: `${(c.value / engStats.compTotal) * 100}%`, background: c.color }} title={`${c.label}: ${compactNumber(c.value)}`}/>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                            {engStats.comp.map(c => (
                              <button key={c.key} onClick={() => setEngFocus(c.key)} className="flex items-center gap-2 text-left rounded-lg hover:bg-muted/40 transition-colors p-1.5 -m-1.5 border border-transparent hover:border-border/40">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }}/>
                                <div className="min-w-0">
                                  <p className="text-[10px] text-muted-foreground leading-none font-medium">{c.label}</p>
                                  <p className="text-xs font-bold leading-tight mt-0.5">{compactNumber(c.value)} <span className="text-[10px] font-medium text-muted-foreground">({Math.round((c.value / engStats.compTotal) * 100)}%)</span></p>
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
                  <Panel title="Engagement Rate" desc="Formula: (Engagements ÷ Reach) × 100" content="p-6 space-y-4">
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-black text-foreground">{(kpis?.engagementRate?.current ?? 0).toFixed(2)}%</span>
                      <Delta value={kpis?.engagementRate?.change ?? 0}/>
                    </div>
                    <p className="text-xs text-muted-foreground">vs. {(kpis?.engagementRate?.previous ?? 0).toFixed(2)}% in the previous period</p>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{width:`${Math.min((kpis?.engagementRate?.current ?? 0)*10,100)}%`}}/>
                    </div>
                  </Panel>

                  <Panel title="Engagement Mix" desc="Distribution of interaction types">
                    {kpis!.engagement.total > 0 ? (
                      <div className="space-y-3">
                        {[
                          { label:"Likes", val:kpis!.engagement.likes, color:"bg-red-400" },
                          { label:"Comments", val:kpis!.engagement.comments, color:"bg-blue-400" },
                          { label:"Shares", val:kpis!.engagement.shares, color:"bg-emerald-400" },
                          { label:"Saves", val:kpis!.engagement.saved, color:"bg-amber-400" },
                        ].map(i => {
                          const pct = (i.val/kpis!.engagement.total)*100;
                          return (
                            <div key={i.label} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-16 shrink-0">{i.label}</span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${i.color} rounded-full`} style={{width:`${pct}%`}}/>
                              </div>
                              <span className="text-xs font-bold w-10 text-right">{pct.toFixed(0)}%</span>
                              <span className="text-xs text-muted-foreground w-12 text-right">{compactNumber(i.val)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : <NoData/>}
                  </Panel>
                </div>
              </div>
            )}

            {/* ══════════════ FOLLOWERS ══════════════ */}
            {activeTab === "followers" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">{fol} Analytics</h2><p className="text-xs text-muted-foreground">Audience growth and distribution</p></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label:`Current ${fol}`, value:kpis?.followers?.current ?? 0, icon:Users, color:"blue" },
                    { label:"Net Change", value:kpis?.followers?.change != null ? Math.abs(kpis.followers.change) : 0, icon:(kpis?.followers?.change ?? 0)>=0?ArrowUp:ArrowDown, color:(kpis?.followers?.change ?? 0)>=0?"emerald":"rose" },
                    { label:"Growth", value:kpis?.followers?.growth != null ? Math.abs(kpis.followers.growth) : 0, icon:TrendingUp, color:"indigo", isRate:true },
                    ...(kpis?.followers?.isNew ? [] : [{ label:"Prev. Period", value:kpis?.followers?.previous ?? 0, icon:Clock, color:"amber" }]),
                  ].map(c => <KPICard key={c.label} {...c}/>)}
                </div>

                <Panel icon={<TrendingUp className="h-4 w-4 text-blue-500"/>} title={`${fol} Growth Chart`} desc={`Total ${fol.toLowerCase()} tracked daily`}>
                  <TimeChart data={chartData} cls="h-72 w-full" chart={LineChart}>
                    <Line type="monotone" dataKey="followers" name={fol} stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
                  </TimeChart>
                </Panel>

                {/* Platform distribution */}
                <Panel title="Audience Distribution" desc={`${fol} per platform`}>
                  <div className="space-y-4">
                    {(() => {
                      const tot = (analytics.platformBreakdown||[]).reduce((s,x)=>s+x.followers,0);
                      return (analytics.platformBreakdown||[]).sort((a,b)=>b.followers-a.followers).map(p => {
                        const pctVal = tot>0?((p.followers/tot)*100):0;
                        return (
                          <div key={p.platform} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">{getPlatformIcon(p.platform)}<span className="capitalize font-semibold">{p.platform}</span></div>
                              <div className="flex items-center gap-3"><span className="text-muted-foreground text-xs">{compactNumber(p.followers)}</span><span className="font-bold text-xs">{pctVal.toFixed(1)}%</span></div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{width:`${pctVal}%`,background:PLATFORM_COLORS[p.platform]||"#6366f1"}}/>
                            </div>
                          </div>
                        );
                      });
                    })()}
                    {!(analytics.platformBreakdown||[]).some(p=>p.followers>0) && <NoData/>}
                  </div>
                </Panel>
              </div>
            )}

            {/* ══════════════ REACH ══════════════ */}
            {activeTab === "reach" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Reach & Impressions</h2><p className="text-xs text-muted-foreground">Content visibility and exposure metrics</p></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard label="Total Reach" value={kpis?.reach?.current ?? 0} growth={kpis?.reach?.growth} icon={TrendingUp} color="emerald"/>
                  <KPICard label="Impressions" value={kpis?.impressions?.current ?? 0} growth={kpis?.impressions?.growth} icon={Eye} color="purple"/>
                  <KPICard label="Reach Change" value={kpis?.reach?.change != null ? Math.abs(kpis.reach.change) : 0} icon={(kpis?.reach?.change ?? 0)>=0?ArrowUp:ArrowDown} color={(kpis?.reach?.change ?? 0)>=0?"emerald":"rose"}/>
                  <KPICard label="Frequency" value={(kpis?.reach?.current ?? 0)>0?parseFloat(((kpis?.impressions?.current ?? 0)/(kpis?.reach?.current ?? 1)).toFixed(2)):0} icon={Repeat2} color="amber"/>
                </div>

                <Panel icon={<Eye className="h-4 w-4 text-emerald-500"/>} title="Reach vs. Impressions — Daily" desc="Unique viewers vs. total content displays">
                  <TimeChart data={chartData} cls="h-72 w-full" chart={BarChart}>
                    <Legend iconSize={8} wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="reach" name="Reach" fill="#10b981" radius={[4,4,0,0]}/>
                    <Bar dataKey="impressions" name="Impressions" fill="#8b5cf6" radius={[4,4,0,0]}/>
                  </TimeChart>
                </Panel>

                <Panel title="Daily Reach Trend" desc={<>Reach progression over {dateRangeText}</>}>
                  <TimeChart data={chartData} cls="h-52 w-full" chart={LineChart}>
                    <Line type="monotone" dataKey="reach" name="Reach" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
                  </TimeChart>
                </Panel>
              </div>
            )}

            {/* ══════════════ CONTENT ══════════════ */}
            {activeTab === "content" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Content Performance</h2><p className="text-xs text-muted-foreground">Top posts and content type analysis</p></div>

                {/* Content type performance */}
                <Panel icon={<LayoutGrid className="h-4 w-4 text-violet-500"/>} title="Content Type Performance" desc="Average metrics per content format" content="p-0">
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
                                <td className="px-4 py-3">{compactNumber(ct.avgReach)}</td>
                                <td className="px-4 py-3 font-bold text-primary">{compactNumber(ct.avgEngagement)}</td>
                                <td className="px-4 py-3">{compactNumber(ct.avgViews)}</td>
                                <td className="px-4 py-3">{compactNumber(ct.avgSaved)}</td>
                                <td className="px-4 py-3">{compactNumber(ct.avgImpressions)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="p-6"><NoData msg="Publish content and sync to see type performance"/></div>}
                </Panel>

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
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${seg(postSort===s)}`}>
                              {cap(s)}
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
                    ) : posts.map(post => (
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
                              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500"><Heart size={10} fill="currentColor"/>{compactNumber(post.likes)}</span>
                              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500"><MessageSquare size={10}/>{compactNumber(post.comments)}</span>
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><Share2 size={10}/>{compactNumber(post.shares)}</span>
                              {post.saved>0 && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500"><Bookmark size={10}/>{compactNumber(post.saved)}</span>}
                              {post.views>0 && <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500"><Play size={10}/>{compactNumber(post.views)}</span>}
                              {post.reach>0 && <span className="flex items-center gap-1 text-[10px] font-bold text-teal-500"><Eye size={10}/>{compactNumber(post.reach)}</span>}
                              <div className="ml-auto flex items-center gap-2">
                                <span className="bg-primary/10 border border-primary/20 rounded-lg px-2 py-0.5 text-[10px] font-black text-primary">{compactNumber(post.engagement)} eng.</span>
                                {post.engagementRate>0&&<span className="text-[10px] font-bold text-muted-foreground">{post.engagementRate.toFixed(1)}% ER</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {postsTruncated && (
                    <div className="px-5 py-2.5 border-t border-border/40 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-700 dark:text-amber-300">
                        This range holds more than {postsTruncated.rowCap.toLocaleString()} posts — ranking the most recent {postsTruncated.rowCap.toLocaleString()}. Narrow the date range to include the rest.
                      </span>
                    </div>
                  )}
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
                  <KPICard label="Video Views" value={kpis?.engagement.views ?? 0} icon={Play} color="purple"/>
                  <KPICard label="Saves" value={kpis?.engagement.saved ?? 0} icon={Bookmark} color="amber"/>
                  <KPICard label="Shares" value={kpis?.engagement.shares ?? 0} icon={Share2} color="emerald"/>
                  <KPICard label="Comments" value={kpis?.engagement.comments ?? 0} icon={MessageSquare} color="blue"/>
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

                {/* Gender demographics, then top countries */}
                {([
                  { key: 'demoGender', rows: analytics.demographics?.gender, title: "Gender Distribution", lockTitle: "Gender Demographics",
                    icon: <Users className="h-4 w-4 text-violet-500"/>, label: "text-sm font-medium w-20 capitalize", bar: "h-full bg-violet-400 rounded-full",
                    locked: "Requires instagram_manage_insights or advanced Facebook Page access. Reconnect with the required permissions to view.",
                    importable: "Import your TikTok Studio export to see gender breakdown." },
                  { key: 'demoCountry', rows: analytics.demographics?.country?.slice(0, 10), title: "Top Countries", lockTitle: "Top Countries",
                    icon: <Globe className="h-4 w-4 text-blue-500"/>, label: "text-sm font-medium w-20 uppercase", bar: "h-full bg-blue-400 rounded-full",
                    locked: "Geographic data requires Business-level access. Enable advanced data access in Meta Business Suite.",
                    importable: "Import your TikTok Studio export to see top countries." },
                ] as const).map(d => {
                  const status = capStatus(caps, d.key);
                  return capAvailable(caps, d.key) && (d.rows?.length ?? 0) > 0 ? (
                    <Panel key={d.key} icon={d.icon} title={d.title}>
                      <div className="space-y-3">
                        {d.rows!.map((r: any) => (
                          <div key={r.label} className="flex items-center gap-3">
                            <span className={d.label}>{r.label}</span>
                            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className={d.bar} style={{width:`${(r.fraction*100)}%`}}/>
                            </div>
                            <span className="text-sm font-bold w-14 text-right">{(r.fraction*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : status === 'locked' || status === 'importable' ? (
                    <SectionLock key={d.key} title={d.lockTitle} desc={d[status]} />
                  ) : null;
                })}

                {/* If nothing is available at all */}
                {!capOf(caps, 'demoGender') && !capOf(caps, 'demoCountry') && (
                  <NoData msg="Audience demographics are not available for the selected platform" />
                )}
              </div>
            )}

            {/* ══════════════ BEST TIME ══════════════ */}
            {activeTab === "besttime" && (
              <div className="space-y-6">
                <div><h2 className="text-lg font-bold">Best Posting Time</h2><p className="text-xs text-muted-foreground">{heatmapGrid.isImport ? "When your followers are most active — from imported TikTok Studio data" : "Optimal publishing times based on your historical engagement"}</p></div>

                <Panel icon={<Clock className="h-4 w-4 text-amber-500"/>} title={heatmapGrid.isImport ? "Follower Activity Heatmap" : "Engagement Heatmap"}
                  desc={<>Darker = more {heatmapGrid.isImport ? "active followers" : "engagement"} at that day/hour</>} content="p-6 overflow-x-auto">
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
                            const intensity = val/heatmapGrid.maxVal;
                            return (
                              <div
                                key={hour}
                                title={`${DAYS_FULL[day]} ${hour}:00 — ${compactNumber(val)} ${heatmapGrid.isImport ? "active followers" : "engagement"}`}
                                className="w-7 h-7 rounded-sm shrink-0 border border-border/20 cursor-pointer hover:scale-110 transition-transform"
                                style={{ background: intensity>0 ? `rgba(99,102,241,${Math.max(intensity,0.08)})` : "rgba(0,0,0,0.03)" }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <NoData msg="Publish content — or import TikTok Studio data — to generate the heatmap"/>
                  )}
                </Panel>

                {/* Top 5 slots */}
                {heatmapGrid.topSlots.length > 0 && (
                  <Panel title={<>Top 5 {heatmapGrid.isImport ? "Most Active Slots" : "Best Posting Slots"}</>} content="p-0">
                    {heatmapGrid.topSlots.map((t, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 border-b border-border/40 last:border-0 hover:bg-muted/5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0">#{i+1}</div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{DAYS_FULL[t.day]}</p>
                          <p className="text-xs text-muted-foreground">{t.hour===0?12:t.hour>12?t.hour-12:t.hour}:00 {t.hour<12?"AM":"PM"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 sm:gap-3">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden sm:w-32">
                            <div className="h-full bg-primary rounded-full" style={{width:`${(t.value/heatmapGrid.topSlots[0].value)*100}%`}}/>
                          </div>
                          <span className="text-xs font-bold text-primary w-16 text-right sm:w-20">{compactNumber(t.value)} {heatmapGrid.isImport ? "active" : "eng."}</span>
                        </div>
                      </div>
                    ))}
                  </Panel>
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
                              {["Platform", fol, "Reach", "Impressions", "Engagement", "Posts", "Growth"].map(h=>(
                                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {analytics.platformComparison.sort((a,b)=>b.followers-a.followers).map(p => (
                              <tr key={p.platform} className="hover:bg-muted/5 transition-colors">
                                <td className="px-5 py-4"><div className="flex items-center gap-2.5">{getPlatformIcon(p.platform,"h-4 w-4 object-contain")}<span className="capitalize font-semibold">{p.platform}</span></div></td>
                                <td className="px-5 py-4 font-bold">{compactNumber(p.followers)}</td>
                                {(["reach","impressions","engagement","posts"] as const).map(k => <td key={k} className="px-5 py-4">{compactNumber(p[k])}</td>)}
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
                <Panel title={`${fol} by Platform`}>
                  <div className="h-52 w-full">
                    {analytics.platformBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.platformBreakdown.sort((a,b)=>b.followers-a.followers)} layout="vertical" margin={{top:0,right:20,left:40,bottom:0}}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)"/>
                          <XAxis type="number" stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={compactTick}/>
                          <YAxis dataKey="platform" type="category" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={70} tickFormatter={cap}/>
                          <Tooltip content={<ChartTip/>}/>
                          <Bar dataKey="followers" name={fol} fill="#6366f1" radius={[0,4,4,0]}>
                            {analytics.platformBreakdown.map((p,i) => <Cell key={p.platform} fill={platColor(p.platform, i)}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <NoData/>}
                  </div>
                </Panel>
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
                  ].map(c => <KPICard key={c.label} {...c}/>)}
                </div>

                {/* Success rate visual */}
                <Panel icon={<Target className="h-4 w-4 text-teal-500"/>} title="Publishing Success Rate" desc="Formula: (Published ÷ Attempted) × 100">
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
                </Panel>

                {/* Weekly activity */}
                {(analytics.publishing.weeklyActivity||[]).length > 0 && (
                  <Panel title="Weekly Publishing Activity" desc="Posts published per week">
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
                  </Panel>
                )}
              </div>
            )}

            {/* ══════════════ ACCOUNTS ══════════════ */}
            {activeTab === "accounts" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Account Analytics</h2>
                  <p className="text-xs text-muted-foreground">
                    Live followers · reach &amp; impressions for {dateRangeText}
                  </p>
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {(analytics.accounts||[]).map((acc) => {
                    const m = acc.latestMetrics;
                    const isHealthy = acc.healthStatus === "healthy";
                    const plat = acc.platform?.toLowerCase();
                    const periodLabel = dateMode === "custom" ? "Period" : `${dateRange}d`;
                    const metricSlot = (key: "reach" | "impressions", label: string) =>
                      ({ key, label, sub: periodLabel, value: m?.[key] ?? null, status: acc.metricStatus?.[key] || (m?.[key] != null ? "available" : "unavailable") });
                    const slots = [
                      { key: "followers", label: plat === "youtube" ? "Subscribers" : "Followers", sub: "Live", value: m?.followers ?? null, status: "available" },
                      metricSlot("reach", "Reach"),
                      metricSlot("impressions", "Impressions"),
                    ];
                    const slotNote = (status: string) =>
                      status === "locked"
                        ? (plat === "instagram" ? "Needs Instagram insights permission" : "Needs an extra platform permission")
                        : plat === "tiktok" ? "Import TikTok Studio export to view reach & impressions" : `Not provided by ${acc.platform}`;
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
                          {slots.map(slot => (
                            <div key={slot.key} className="p-4 text-center">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{slot.label}</p>
                              {slot.status === "available" && slot.value != null ? (
                                <>
                                  <p className="text-lg font-black text-foreground mt-1">{compactNumber(slot.value)}</p>
                                  <span className="text-[8px] text-muted-foreground/70 mt-0.5 leading-tight">{slot.sub}</span>
                                </>
                              ) : (
                                <div className="mt-1 flex flex-col items-center" title={slotNote(slot.status)}>
                                  <span className="text-lg font-black text-muted-foreground/30 leading-none inline-flex items-center gap-1">
                                    {slot.status === "locked" && <Lock className="h-3 w-3"/>}—
                                  </span>
                                  <span className="text-[8px] text-muted-foreground/70 mt-1 leading-tight">
                                    {slot.status === "locked" ? "Enable to view" : plat === "tiktok" ? "Import to view" : "Not available"}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {plat === "instagram" && (acc.metricStatus?.reach === "locked" || (acc.healthStatus === "warning" && (acc.healthMessage || "").toLowerCase().includes("insights"))) && (
                          <div className="px-4 py-2 text-[10px] text-amber-700 bg-amber-50/60 border-t border-amber-100 flex items-center gap-1.5">
                            <Lock className="h-3 w-3 shrink-0"/> Reach &amp; impressions need the Instagram insights permission — reconnect Instagram, then Sync Metrics.
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">AI Insights</h2>
                    <p className="text-xs text-muted-foreground">
                      {aiInsightsState.source === "ai"
                        ? "Written by your configured AI provider from this client's analytics"
                        : "Automated recommendations based on your analytics data"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => fetchAiInsights(true)}
                    disabled={aiInsightsState.loading} className="rounded-xl gap-2 shrink-0">
                    <RefreshCw className={`h-3.5 w-3.5 ${aiInsightsState.loading ? "animate-spin" : ""}`} />
                    {aiInsightsState.loading ? "Analysing…" : "Regenerate"}
                  </Button>
                </div>
                {aiInsightsState.reason && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      {aiInsightsState.reason} Showing the calculated insights below instead.
                    </span>
                  </div>
                )}
                <div className="grid gap-4">
                  {displayedInsights.length > 0 ? displayedInsights.map((insight, i) => (
                    <Card key={i} className="rounded-2xl shadow-sm border border-border/80 hover:shadow-md transition-shadow">
                      <CardContent className="p-5 flex items-start gap-4">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Sparkles className="h-4 w-4"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Rendered as text nodes, not innerHTML — these strings carry
                              client-supplied values (captions, platform names). */}
                          <p className="text-sm text-foreground leading-relaxed">{renderBold(insight)}</p>
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
                      <Button onClick={exportCSV} disabled={isExporting || postsTotal===0} className="rounded-xl w-full gap-2"><Download className="h-4 w-4"/>{isExporting ? "Exporting…" : "Export Now"}</Button>
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
                          {analytics.provenance?.lastImportedAt && (
                            <p className="text-[10px] text-violet-600 mt-2">Last imported: {new Date(analytics.provenance.lastImportedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                        <label className="w-full">
                          <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={importTikTok} />
                          <Button variant="outline" className="rounded-xl w-full gap-2 border-violet-200 text-violet-600 hover:bg-violet-50" asChild>
                            <span><Upload className="h-4 w-4"/>Upload XLSX Files</span>
                          </Button>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setClearImportOpen(true)}
                        >
                          <Trash2 className="h-4 w-4"/>Clear imported data…
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* What's included */}
                <Panel title="CSV Export Includes">
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
                  <Button onClick={exportCSV} className="mt-5 rounded-xl gap-2" disabled={isExporting || postsTotal===0}>
                    <Download className="h-4 w-4"/>{isExporting ? "Exporting…" : `Download CSV (${postsTotal} posts)`}
                  </Button>
                </Panel>
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
      <ClearImportedDataDialog
        accountId={tiktokAcct?.id ?? null}
        accountLabel={tiktokAcct?.platformUsername}
        open={clearImportOpen}
        onOpenChange={setClearImportOpen}
        onCleared={() => { void reloadAll(); }}
      />
    </div>
  );
}
