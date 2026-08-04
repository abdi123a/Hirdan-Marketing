import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayCalendar } from "@/components/ui/calendar";
import {
  ArrowLeft, Plus, Download, Copy, ChevronLeft, ChevronRight,
  Instagram, Facebook, Linkedin, Youtube, Twitter,
  Trash2, Pencil, Calendar as CalendarIcon, Loader2, Zap, Send, Image,
  Sparkles, FileDown, CheckCircle2, Clock, Eye, AlertCircle, X
} from "lucide-react";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import { CardGridSkeleton } from "@/components/ui/PageSkeleton";
import { useAgencyStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Constants & Config ───────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string; pdfColor: string }> = {
  INSTAGRAM: { icon: Instagram, color: "text-pink-500", bg: "bg-gradient-to-r from-purple-500/15 to-pink-500/15 border-pink-400/30", label: "Instagram", pdfColor: "#E1306C" },
  FACEBOOK: { icon: Facebook, color: "text-blue-600", bg: "bg-blue-500/10 border-blue-400/30", label: "Facebook", pdfColor: "#1877F2" },
  LINKEDIN: { icon: Linkedin, color: "text-blue-700", bg: "bg-blue-700/10 border-blue-600/30", label: "LinkedIn", pdfColor: "#0A66C2" },
  YOUTUBE: { icon: Youtube, color: "text-red-600", bg: "bg-red-500/10 border-red-400/30", label: "YouTube", pdfColor: "#FF0000" },
  X: { icon: Twitter, color: "text-foreground", bg: "bg-foreground/5 border-border", label: "X (Twitter)", pdfColor: "#14171A" },
  TIKTOK: { icon: Zap, color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-400/30", label: "TikTok", pdfColor: "#00F2EA" },
  SNAPCHAT: { icon: Send, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-400/30", label: "Snapchat", pdfColor: "#FFFC00" },
  PINTEREST: { icon: Image, color: "text-red-500", bg: "bg-red-500/10 border-red-400/30", label: "Pinterest", pdfColor: "#BD081C" },
  OTHER: { icon: Sparkles, color: "text-muted-foreground", bg: "bg-muted/50 border-border", label: "Other", pdfColor: "#888888" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; hint: string }> = {
  DRAFT: { label: "Draft", color: "text-slate-500", bg: "bg-slate-100 border-slate-300 dark:bg-slate-800/50 dark:border-slate-600", icon: Clock, hint: "not ready" },
  SCHEDULED: { label: "Scheduled", color: "text-blue-600", bg: "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700", icon: CalendarIcon, hint: "queued to post" },
  FILMED: { label: "Filmed", color: "text-purple-600", bg: "bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-700", icon: Eye, hint: "shot, not posted" },
  PUBLISHED: { label: "Published", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700", icon: CheckCircle2, hint: "live" },
  DELAYED: { label: "Delayed", color: "text-red-500", bg: "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700", icon: AlertCircle, hint: "behind schedule" },
};

const PLATFORM_ICON_SRC: Record<string, string> = {
  INSTAGRAM: "/social-icons/instagram.png",
  FACEBOOK: "/social-icons/Facebook.png",
  LINKEDIN: "/social-icons/linkedin.png",
  YOUTUBE: "/social-icons/youtube.png",
  X: "/social-icons/twitter.png",
  TIKTOK: "/social-icons/tiktok.png",
  PINTEREST: "/social-icons/pinterest.png",
};

const SHOOT_EVENT_COLOR = "#6B7FD4";

function showShootDayField(contentType: string): boolean {
  return contentType !== "story";
}

function formatPlannerDate(value: string): string {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPlannerDateLong(value: string): string {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toDateInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function PlannerDateField({
  value,
  onChange,
  placeholder = "Pick a date",
  defaultMonth,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  defaultMonth?: Date;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateInputValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full h-10 justify-between rounded-xl px-3 font-medium shadow-none",
            !value && "text-muted-foreground"
          )}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {value ? formatPlannerDateLong(value) : placeholder}
            </span>
          </span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              className="ml-1 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
              aria-label="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-muted-foreground/70" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-[120] rounded-2xl shadow-xl border border-border/80 overflow-hidden"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
      >
        <DayCalendar
          mode="single"
          selected={selected}
          defaultMonth={selected || defaultMonth}
          onSelect={date => {
            if (!date) {
              onChange("");
              return;
            }
            onChange(toDateInputValue(date));
            setOpen(false);
          }}
          initialFocus
          className="p-3"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-semibold"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-semibold text-primary"
            onClick={() => {
              onChange(toDateInputValue(new Date()));
              setOpen(false);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PlatformIconImg({
  platform,
  className = "h-3.5 w-3.5",
}: {
  platform: string;
  className?: string;
}) {
  const src = PLATFORM_ICON_SRC[platform];
  const label = PLATFORM_CONFIG[platform]?.label || platform;
  if (src) {
    return <img src={src} alt={label} title={label} className={`${className} object-contain`} />;
  }
  const FallbackIcon = PLATFORM_CONFIG[platform]?.icon || Sparkles;
  return <FallbackIcon className={className} aria-label={label} />;
}

function PlatformIconStack({ platforms, size = "sm" }: { platforms: string[]; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const icon = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  return (
    <div className="flex items-center">
      {platforms.map((pl, i) => (
        <span
          key={pl}
          className={`${box} rounded-full bg-white dark:bg-card border border-border/70 shadow-sm flex items-center justify-center ${i > 0 ? "-ml-1" : ""}`}
          style={{ zIndex: platforms.length - i }}
          title={PLATFORM_CONFIG[pl]?.label || pl}
        >
          <PlatformIconImg platform={pl} className={icon} />
        </span>
      ))}
    </div>
  );
}

const ALL_PLATFORMS = Object.keys(PLATFORM_CONFIG);
const ALL_STATUSES = Object.keys(STATUS_CONFIG);
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const CONTENT_TYPE_CONFIG: Record<string, { label: string; emoji: string; description: string; accentClass: string }> = {
  video:   { label: "Video",   emoji: "🎬", description: "Reels, TikToks, YT Shorts", accentClass: "border-[#4c3d94] bg-[#4c3d94]/8 text-[#4c3d94]" },
  photo:   { label: "Photo",   emoji: "📷", description: "Single images & carousels", accentClass: "border-[#9b8fd4] bg-[#9b8fd4]/8 text-[#9b8fd4]" },
  story:   { label: "Story",   emoji: "✨", description: "24-hour ephemeral content",  accentClass: "border-[#f5cf7e] bg-[#f5cf7e]/8 text-[#c89a2a]" },
  graphic: { label: "Graphic", emoji: "🎨", description: "Designed posts & infographics", accentClass: "border-[#f6b317] bg-[#f6b317]/8 text-[#b07e0c]" },
};

const defaultForm = {
  title: "",
  platforms: ["INSTAGRAM"],
  status: "DRAFT",
  contentType: "graphic",
  shootingDate: "",
  publishDate: "",
  notes: "",
};

// ─── Types ────────────────────────────────────────────────────────

interface ContentPost {
  id: string;
  clientId: string;
  month: number;
  year: number;
  title: string;
  platform: string;
  status: string;
  contentType?: string;
  shootingDate: string | null;
  publishDate: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupedPost {
  id: string;
  title: string;
  status: string;
  contentType: string;
  shootingDate: string | null;
  publishDate: string | null;
  notes: string | null;
  platforms: string[];
  postIds: string[];
}

interface CalendarEvent {
  id: string;
  group: GroupedPost;
  type: "SHOOT" | "PUBLISH";
}

interface PlannerTabProps {
  clientId: string;
  clientName?: string;
  clientCompany?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return `rgba(90, 66, 138, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${isNaN(r) ? 80 : r}, ${isNaN(g) ? 65 : g}, ${isNaN(b) ? 136 : b}, ${alpha})`;
};

const shiftHexShade = (hex: string, amount: number) => {
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#5A428A";
  const r = parseInt(safeHex.slice(1, 3), 16);
  const g = parseInt(safeHex.slice(3, 5), 16);
  const b = parseInt(safeHex.slice(5, 7), 16);
  const next = (value: number) => Math.max(0, Math.min(255, value + amount));

  return `#${next(r).toString(16).padStart(2, "0")}${next(g).toString(16).padStart(2, "0")}${next(b).toString(16).padStart(2, "0")}`;
};

const getStatusStyle = (status: string, primaryColor: string, accentColor: string) => {
  switch (status) {
    case "DRAFT":
      return { color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" };
    case "SCHEDULED":
      return { color: primaryColor, bg: hexToRgba(primaryColor, 0.1), border: hexToRgba(primaryColor, 0.3) };
    case "FILMED":
      return { color: primaryColor, bg: hexToRgba(primaryColor, 0.15), border: hexToRgba(primaryColor, 0.4) };
    case "PUBLISHED":
      return { color: accentColor, bg: hexToRgba(accentColor, 0.15), border: hexToRgba(accentColor, 0.4) };
    case "DELAYED":
      return { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
    default:
      return { color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" };
  }
};

// ─── PDF Card Spec Constants ──────────────────────────────────────

const CONTENT_TYPE_COLORS: Record<string, string> = {
  video:   "#4c3d94",
  graphic: "#f6b317",
  photo:   "#9b8fd4",
  story:   "#f5cf7e",
};

const PDF_STATUS_DOT_COLORS: Record<string, string> = {
  DRAFT:     "#888780",
  SCHEDULED: "#7F77DD",
  FILMED:    "#5DCAA5",
  PUBLISHED: "#EF9F27",
  DELAYED:   "#E24B4A",
};

// Infer a content type from the post title (best-effort; defaults to "graphic").
function inferContentType(title: string, platforms: string[]): string {
  const t = title.toLowerCase();
  if (/\bvideo\b|\breel\b|\btiktok\b|\bshort\b|\bfilm\b|\bfilmed\b|\brecord/.test(t)) return "video";
  if (/\bstory\b|\bstories\b/.test(t)) return "story";
  if (/\bphoto\b|\bpicture\b|\bimage\b|\bpic\b|\bshot\b/.test(t)) return "photo";
  // Platform hint: TikTok → video by default
  if (platforms.some(p => p === "TIKTOK" || p === "YOUTUBE")) return "video";
  return "graphic";
}

function buildCalendarGrid(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function getEventsForDay(groups: GroupedPost[], day: number | null, month: number, year: number): CalendarEvent[] {
  if (!day) return [];
  const events: CalendarEvent[] = [];

  groups.forEach(g => {
    if (g.shootingDate) {
      const d = new Date(g.shootingDate);
      if (d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day) {
        events.push({ id: `${g.id}-shoot`, group: g, type: "SHOOT" });
      }
    }
    if (g.publishDate) {
      const d = new Date(g.publishDate);
      if (d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day) {
        events.push({ id: `${g.id}-publish`, group: g, type: "PUBLISH" });
      }
    }
  });

  return events.sort((a, b) => a.type.localeCompare(b.type));
}

// ─── Reusable Screen Components ───────────────────────────────────

function Pill({
  label,
  icon: Icon,
  style,
  className = "",
}: {
  label: string;
  icon?: any;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md text-[9px] font-extrabold uppercase tracking-[0.04em] whitespace-nowrap ${className}`}
      style={style}
    >
      {Icon ? (
        <span className="flex items-center justify-center shrink-0" style={{ lineHeight: 0 }}>
          <Icon size={10} strokeWidth={2.5} />
        </span>
      ) : null}
      <span>{label}</span>
    </div>
  );
}

function LegendPill({
  label,
  dotColor,
  style,
}: {
  label: string;
  dotColor: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="inline-flex items-center justify-center gap-2 py-1.5 px-4 rounded-full border text-[10px] font-extrabold uppercase tracking-[0.08em] whitespace-nowrap"
      style={style}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0 inline-block"
        style={{ backgroundColor: dotColor }}
      />
      <span>{label}</span>
    </div>
  );
}

// ─── Planner Tab ──────────────────────────────────────────────────

export function ClientMonthlyPlannerTab({ clientId, clientName, clientCompany }: PlannerTabProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<GroupedPost | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [dupYear, setDupYear] = useState(year);
  const [dupMonth, setDupMonth] = useState(month > 1 ? month - 1 : 12);
  const [duplicating, setDuplicating] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearing, setClearing] = useState(false);

  // AI State
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    platforms: [] as string[],
    numberOfPosts: 12,
    tone: 'Professional yet engaging',
    focusTopics: ''
  });
  const [aiPreviewPosts, setAiPreviewPosts] = useState<any[]>([]);

  const { settings } = useAgencyStore();
  const { toast } = useToast();

  const clientDisplayName = clientCompany || clientName || "Client";

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ posts: ContentPost[] }>(
        `/clients/${clientId}/content-posts?month=${month}&year=${year}`
      );
      setPosts(res.posts);
    } catch {
      toast({ title: "Error", description: "Failed to load posts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year, toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const groupedPosts = useMemo(() => {
    const groups: Record<string, GroupedPost> = {};

    posts.forEach(post => {
      // Group by title and dates only. Status is excluded from the key so that platforms 
      // belonging to the same content piece stay grouped even if statuses drift.
      const key = `${post.title}_${post.shootingDate}_${post.publishDate}`;
      if (!groups[key]) {
        groups[key] = {
          id: post.id,
          title: post.title,
          status: post.status,
          contentType: post.contentType || inferContentType(post.title, [post.platform]),
          shootingDate: post.shootingDate,
          publishDate: post.publishDate,
          notes: post.notes,
          platforms: [post.platform],
          postIds: [post.id],
        };
      } else {
        if (!groups[key].platforms.includes(post.platform)) {
          groups[key].platforms.push(post.platform);
        }
        if (!groups[key].postIds.includes(post.id)) {
          groups[key].postIds.push(post.id);
        }
        // If statuses drift, we show the most "advanced" one as the group status
        const statusOrder = ["DRAFT", "SCHEDULED", "FILMED", "PUBLISHED", "DELAYED"];
        const currentIdx = statusOrder.indexOf(post.status);
        const groupIdx = statusOrder.indexOf(groups[key].status);
        if (currentIdx > groupIdx) {
          groups[key].status = post.status;
        }
      }
    });

    return Object.values(groups).sort((a, b) => {
      const da = a.publishDate || a.shootingDate || "";
      const db = b.publishDate || b.shootingDate || "";
      return new Date(da).getTime() - new Date(db).getTime();
    });
  }, [posts]);

  const weeks = useMemo(() => buildCalendarGrid(month, year), [month, year]);

  const navigateMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setMonth(m);
    setYear(y);
  };

  const openAdd = (prefillDate?: string, prefillStatus?: string) => {
    setEditingPost(null);
    setForm({
      ...defaultForm,
      publishDate: prefillDate || "",
      status: prefillStatus || "DRAFT",
    });
    setShowAddDialog(true);
  };

  const openEdit = (group: GroupedPost) => {
    setEditingPost(group);
    setForm({
      title: group.title,
      platforms: group.platforms,
      status: group.status,
      contentType: group.contentType || "graphic",
      shootingDate: group.shootingDate ? group.shootingDate.split("T")[0] : "",
      publishDate: group.publishDate ? group.publishDate.split("T")[0] : "",
      notes: group.notes || "",
    });
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!form.platforms || form.platforms.length === 0) {
      toast({ title: "At least one platform is required", variant: "destructive" });
      return;
    }
    if (!form.publishDate) {
      toast({ title: "Goes live date is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingPost) {
        const oldPostIds = editingPost.postIds;
        let idIndex = 0;

        const shootingDate = showShootDayField(form.contentType) ? form.shootingDate : "";

        for (const platform of form.platforms) {
          const payload = {
            month,
            year,
            title: form.title.trim(),
            platform,
            status: form.status,
            contentType: form.contentType || "graphic",
            shootingDate,
            publishDate: form.publishDate,
            notes: form.notes || null,
          };

          if (idIndex < oldPostIds.length) {
            await apiFetch(`/clients/${clientId}/content-posts/${oldPostIds[idIndex]}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
            idIndex++;
          } else {
            await apiFetch(`/clients/${clientId}/content-posts`, {
              method: "POST",
              body: JSON.stringify(payload),
            });
          }
        }

        while (idIndex < oldPostIds.length) {
          await apiFetch(`/clients/${clientId}/content-posts/${oldPostIds[idIndex]}`, { method: "DELETE" });
          idIndex++;
        }

        toast({ title: "Post updated" });
      } else {
        const shootingDate = showShootDayField(form.contentType) ? form.shootingDate : "";

        for (const platform of form.platforms) {
          const payload = {
            month,
            year,
            title: form.title.trim(),
            platform,
            status: form.status,
            contentType: form.contentType || "graphic",
            shootingDate,
            publishDate: form.publishDate,
            notes: form.notes || null,
          };
          await apiFetch(`/clients/${clientId}/content-posts`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        toast({ title: "Post(s) added" });
      }

      setShowAddDialog(false);
      await fetchPosts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (postIds: string[]) => {
    try {
      await Promise.all(
        postIds.map(id => apiFetch(`/clients/${clientId}/content-posts/${id}`, { method: "DELETE" }))
      );
      toast({ title: "Post(s) deleted" });
      await fetchPosts();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await apiFetch<{ created: number }>(`/clients/${clientId}/content-posts/duplicate`, {
        method: "POST",
        body: JSON.stringify({
          fromMonth: dupMonth,
          fromYear: dupYear,
          toMonth: month,
          toYear: year,
        }),
      });
      toast({ title: "Month duplicated!", description: `${res.created} posts copied as draft` });
      setShowDupDialog(false);
      await fetchPosts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDuplicating(false);
    }
  };

  const handleClearMonth = async () => {
    if (posts.length === 0) return;
    setClearing(true);
    try {
      await Promise.all(
        posts.map(post => apiFetch(`/clients/${clientId}/content-posts/${post.id}`, { method: "DELETE" }))
      );
      toast({ title: "Month cleared!", description: `All posts for ${MONTHS[month - 1]} have been deleted.` });
      setShowClearDialog(false);
      await fetchPosts();
    } catch {
      toast({ title: "Error", description: "Failed to clear month", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const handleStatusChangeGroup = async (group: GroupedPost, newStatus: string) => {
    setSaving(true);
    try {
      await Promise.all(
        group.postIds.map(id => apiFetch(`/clients/${clientId}/content-posts/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            // We only want to update status here, keeping other fields as they are.
            // The backend updatePostDto is partial, so this works.
            status: newStatus
          })
        }))
      );
      toast({ title: "Status updated", description: `Post(s) marked as ${STATUS_CONFIG[newStatus].label}` });
      await fetchPosts();
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (aiConfig.platforms.length === 0) {
      toast({ title: "Select platforms", variant: "destructive" });
      return;
    }
    setAiGenerating(true);
    setAiPreviewPosts([]);
    try {
      const res = await apiFetch<{ posts: any[] }>(`/ai/generate-plan`, {
        method: "POST",
        body: JSON.stringify({
          clientId,
          month,
          year,
          ...aiConfig
        })
      });
      const processed = res.posts.map((p, i) => ({
        ...p,
        id: `ai-${i}`,
        selected: true
      }));
      setAiPreviewPosts(processed);
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveAiPosts = async () => {
    const selected = aiPreviewPosts.filter(p => p.selected);
    if (selected.length === 0) return;

    setSaving(true);
    try {
      // Create posts sequentially or in parallel batches
      await Promise.all(selected.map(p =>
        apiFetch(`/clients/${clientId}/content-posts`, {
          method: "POST",
          body: JSON.stringify({
            month,
            year,
            title: p.title,
            platform: p.platform,
            status: "DRAFT",
            shootingDate: p.shootingDate || null,
            publishDate: p.publishDate || null,
            notes: p.notes || null,
          })
        })
      ));
      toast({ title: "Plan Saved!", description: `${selected.length} posts added to your calendar.` });
      setShowAiDialog(false);
      setAiPreviewPosts([]);
      await fetchPosts();
    } catch (err: any) {
      toast({ title: "Failed to save plan", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await apiFetchBlob('/reports/content-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientDisplayName,
          month,
          year,
          agency: {
            agencyName: settings.agencyName || 'Hirdan Marketing',
            logo: settings.logo || null,
            primaryColor: settings.primaryColor || '#5A428A',
            phone: settings.phone || null,
            adminEmail: settings.adminEmail || null,
            website: settings.website || null,
          },
          posts: groupedPosts.map(g => ({
            id: g.id,
            title: g.title,
            status: g.status,
            contentType: g.contentType || null,
            shootingDate: g.shootingDate || null,
            publishDate: g.publishDate || null,
            platforms: g.platforms,
          })),
        }),
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${clientDisplayName}-${MONTHS[month - 1]}-${year}-Content-Plan.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'PDF exported!', description: 'Download started' });
    } catch (err: any) {
      toast({
        title: 'Export failed',
        description: err?.message || 'Could not generate PDF',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <CardGridSkeleton />;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-400">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[160px]">
            <p className="text-lg font-display font-bold">
              {MONTHS[month - 1]} {year}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {posts.length} posts planned
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={() => setShowDupDialog(true)}>
            <Copy className="h-3.5 w-3.5" /> Duplicate Month
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setShowClearDialog(true)} disabled={posts.length === 0}>
            <Trash2 className="h-3.5 w-3.5" /> Clear All
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Export PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-500/10" onClick={() => setShowAiDialog(true)}>
            <Sparkles className="h-3.5 w-3.5" /> AI Generate
          </Button>
          <Button variant="hero" size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-premium" onClick={() => openAdd()}>
            <Plus className="h-3.5 w-3.5" /> Add Post
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="border-border/50 overflow-hidden">
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
          <div className="min-w-[560px] sm:min-w-[680px]">
            <div
              className="grid grid-cols-7"
              style={{ backgroundColor: settings.primaryColor || "#5A428A" }}
            >
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="py-2 px-1 sm:py-2.5 sm:px-2 text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/90">
                  <span className="sm:hidden">{d.slice(0, 1)}</span>
                  <span className="hidden sm:inline">{d.slice(0, 3)}</span>
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-t border-border/60">
                {week.map((day, di) => {
                  const eventsOnDay = getEventsForDay(groupedPosts, day, month, year);
                  const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

                  return (
                    <div
                      key={di}
                      className={`min-h-[100px] sm:min-h-[112px] border-r last:border-r-0 border-border/50 bg-muted/20 dark:bg-muted/10 relative ${day ? "cursor-pointer hover:bg-primary/[0.04] transition-colors" : "opacity-35"}`}
                      onClick={() =>
                        day &&
                        openAdd(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
                      }
                    >
                      {day && (
                        <>
                          <div className="px-1.5 sm:px-2 pt-1.5 pb-1 flex items-center justify-between gap-1">
                            <span
                              className={`inline-flex items-center justify-center min-w-[1.35rem] h-5 px-1 rounded-md text-[10px] font-bold tabular-nums ${
                                isToday
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {day}
                            </span>
                          </div>

                          <div className="px-1 sm:px-1.5 pb-1.5 space-y-1 min-w-0">
                            {eventsOnDay.map(ev => {
                              const g = ev.group;
                              const isShoot = ev.type === "SHOOT";
                              const stStyle = getStatusStyle(g.status, settings.primaryColor || "#5A428A", "#f6b317");
                              const ct = g.contentType || inferContentType(g.title, g.platforms);
                              const ctAccentColor = CONTENT_TYPE_COLORS[ct] || "#9b8fd4";
                              const ctConfig = CONTENT_TYPE_CONFIG[ct];
                              const statusColor = PDF_STATUS_DOT_COLORS[g.status] || PDF_STATUS_DOT_COLORS.DRAFT;
                              const eventLabel = isShoot ? "Shoot" : (STATUS_CONFIG[g.status]?.label || g.status);

                              return (
                                <div
                                  key={ev.id}
                                  className="relative min-w-0 rounded-lg border border-border/70 bg-background dark:bg-card shadow-sm hover:shadow-md hover:border-border transition-all duration-150 cursor-pointer overflow-hidden"
                                  title={`${g.title} (${g.platforms.map(p => PLATFORM_CONFIG[p]?.label || p).join(", ")}) — ${ctConfig?.label || ct} — ${isShoot ? "Shoot day" : "Goes live"} — Status: ${g.status}`}
                                  onClick={e => {
                                    e.stopPropagation();
                                    openEdit(g);
                                  }}
                                >
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                                    style={{ backgroundColor: ctAccentColor }}
                                  />
                                  <div className="pl-2 pr-1.5 py-1.5 space-y-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1 min-w-0">
                                      <span
                                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-white truncate max-w-[calc(100%-1.25rem)]"
                                        style={{
                                          backgroundColor: isShoot ? SHOOT_EVENT_COLOR : statusColor,
                                        }}
                                      >
                                        {eventLabel}
                                      </span>

                                      <Select
                                        value={g.status}
                                        onValueChange={(v) => handleStatusChangeGroup(g, v)}
                                      >
                                        <SelectTrigger
                                          className="h-4 w-4 shrink-0 border-none shadow-none p-0 bg-transparent flex items-center justify-center [&>svg]:hidden"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          <div
                                            className="w-2 h-2 rounded-full transition-transform hover:scale-125"
                                            style={{
                                              backgroundColor: stStyle.color,
                                              boxShadow: `0 0 0 1.5px ${stStyle.border}`,
                                            }}
                                            title={`Status: ${STATUS_CONFIG[g.status]?.label || g.status}`}
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ALL_STATUSES.map(s => (
                                            <SelectItem key={s} value={s} className="text-[10px] py-1 px-2">
                                              <div className="flex items-center gap-2">
                                                <div
                                                  className="w-1.5 h-1.5 rounded-full"
                                                  style={{
                                                    backgroundColor: getStatusStyle(
                                                      s,
                                                      settings.primaryColor || "#5A428A",
                                                      "#f6b317"
                                                    ).color,
                                                  }}
                                                />
                                                {STATUS_CONFIG[s].label}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <p className="text-[10px] sm:text-[11px] font-semibold text-foreground leading-snug line-clamp-2 break-words">
                                      <span className="mr-1" aria-hidden>{ctConfig?.emoji || "🎨"}</span>
                                      {g.title}
                                    </p>

                                    {g.platforms.length > 0 ? (
                                      <PlatformIconStack platforms={g.platforms} />
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Legend:</p>
        <LegendPill
          label="Shoot"
          dotColor={SHOOT_EVENT_COLOR}
          style={{
            backgroundColor: "rgba(107, 127, 212, 0.12)",
            color: SHOOT_EVENT_COLOR,
            borderColor: "rgba(107, 127, 212, 0.35)",
          }}
        />
        {Object.entries(STATUS_CONFIG).map(([k, v]) => {
          const st = getStatusStyle(k, settings.primaryColor || "#5A428A", "#f6b317");
          return (
            <LegendPill
              key={k}
              label={v.label}
              dotColor={st.color}
              style={{
                backgroundColor: st.bg,
                color: st.color,
                borderColor: st.border,
              }}
            />
          );
        })}
      </div>

      {/* Posts Table */}
      {posts.length > 0 && (
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {MONTHS[month - 1]} {year} — Content Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b border-border/40">
                  <tr>
                    {["Post Title", "Platform", "Status", "Shoot day", "Goes live", "Notes", ""].map(h => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {groupedPosts.map(g => {
                    const sc = STATUS_CONFIG[g.status] || STATUS_CONFIG.DRAFT;
                    const scStyle = getStatusStyle(g.status, settings.primaryColor || "#5A428A", "#f6b317");

                    return (
                      <tr key={g.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-2.5 text-[11px] font-semibold text-foreground max-w-[180px] truncate">{g.title}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            <PlatformIconStack platforms={g.platforms} size="md" />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Select
                            value={g.status}
                            onValueChange={(v) => handleStatusChangeGroup(g, v)}
                          >
                            <SelectTrigger className="bg-transparent border-none p-0 h-auto shadow-none focus:ring-0">
                              <Pill
                                label={sc.label}
                                icon={sc.icon}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: scStyle.bg,
                                  color: scStyle.color,
                                  border: `1px solid ${scStyle.border}`,
                                }}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map(s => {
                                const sStyle = getStatusStyle(s, settings.primaryColor || "#5A428A", "#f6b317");
                                return (
                                  <SelectItem key={s} value={s} className="text-[10px]">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sStyle.color }} />
                                      {STATUS_CONFIG[s].label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {g.shootingDate
                            ? new Date(g.shootingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {g.publishDate
                            ? new Date(g.publishDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{g.notes || "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(g)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => handleDelete(g.postIds)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {posts.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-border/40 rounded-2xl bg-muted/5">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-bold text-muted-foreground">
            No posts planned for {MONTHS[month - 1]} {year}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click any day on the calendar or use the Add Post button
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5 text-xs" onClick={() => openAdd()}>
            <Plus className="h-3 w-3" /> Add First Post
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[640px] max-h-[min(92dvh,840px)] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 pr-12 border-b border-border/60 shrink-0 text-left">
            <DialogTitle className="font-display text-lg sm:text-xl">
              {editingPost ? "Edit Post" : "Add Content Post"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {MONTHS[month - 1]} {year} · {clientDisplayName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
            {/* What */}
            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  What
                </Label>
                <span className="text-[10px] text-muted-foreground">Required</span>
              </div>
              <Input
                placeholder="e.g. Video 1 — Waafi Residences"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="h-11 text-sm"
              />
            </section>

            {/* What kind */}
            <section className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                What kind
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(CONTENT_TYPE_CONFIG).map(([key, cfg]) => {
                  const isSelected = form.contentType === key;
                  const dotColor = CONTENT_TYPE_COLORS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, contentType: key }))}
                      className={`flex flex-col items-start sm:items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-left sm:text-center transition-all duration-150 min-h-[88px] ${
                        isSelected
                          ? "shadow-sm"
                          : "border-border/60 hover:border-border bg-muted/15 hover:bg-muted/30"
                      }`}
                      style={isSelected ? { borderColor: dotColor, backgroundColor: `${dotColor}14` } : {}}
                    >
                      <span className="text-xl leading-none">{cfg.emoji}</span>
                      <span
                        className="text-[12px] font-bold leading-none"
                        style={isSelected ? { color: dotColor } : undefined}
                      >
                        {cfg.label}
                      </span>
                      <span
                        className="text-[10px] leading-snug text-muted-foreground"
                        style={isSelected ? { color: dotColor, opacity: 0.85 } : undefined}
                      >
                        {cfg.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Where */}
            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Where
                </Label>
                <span className="text-[10px] text-muted-foreground">Select one or more</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_PLATFORMS.map(pl => {
                  const pc = PLATFORM_CONFIG[pl];
                  const isSelected = form.platforms.includes(pl);

                  return (
                    <button
                      key={pl}
                      type="button"
                      onClick={() => {
                        setForm(p => {
                          const newPlatforms = p.platforms.includes(pl)
                            ? p.platforms.filter((x: string) => x !== pl)
                            : [...p.platforms, pl];
                          return { ...p, platforms: newPlatforms };
                        });
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? `${pc.bg} border-current ${pc.color} shadow-sm ring-1 ring-current`
                          : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="h-7 w-7 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
                        <PlatformIconImg platform={pl} className="h-4 w-4" />
                      </span>
                      <span className="truncate">{pc.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* When */}
            <section className="space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                When
              </Label>
              <div
                className={`grid gap-3 ${
                  showShootDayField(form.contentType)
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Goes live <span className="text-destructive">*</span>
                  </Label>
                  <PlannerDateField
                    value={form.publishDate}
                    onChange={v => setForm(p => ({ ...p, publishDate: v }))}
                    placeholder="Select publish date"
                    defaultMonth={new Date(year, month - 1, 1)}
                  />
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    When this posts for the client.
                  </p>
                </div>
                {showShootDayField(form.contentType) ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">
                      Shoot day{" "}
                      <span className="text-muted-foreground font-medium">(optional)</span>
                    </Label>
                    <PlannerDateField
                      value={form.shootingDate}
                      onChange={v => setForm(p => ({ ...p, shootingDate: v }))}
                      placeholder="Select shoot day"
                      defaultMonth={new Date(year, month - 1, 1)}
                    />
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      When you film or create it.
                    </p>
                  </div>
                ) : null}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2.5">
                <span className="font-semibold text-foreground/80">Tip:</span> Shoot day is for production.
                Goes live is the client-facing publish date. Stories only need Goes live.
              </p>
            </section>

            {/* Status */}
            <section className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_STATUSES.map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const st = getStatusStyle(s, settings.primaryColor || "#5A428A", "#f6b317");
                  const isSelected = form.status === s;
                  const StatusIcon = cfg.icon;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, status: s }))}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "shadow-sm"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      }`}
                      style={
                        isSelected
                          ? {
                              borderColor: st.border,
                              backgroundColor: st.bg,
                              boxShadow: `0 0 0 1px ${st.border}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border"
                        style={{
                          color: st.color,
                          backgroundColor: isSelected ? "#fff" : st.bg,
                          borderColor: st.border,
                        }}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold" style={{ color: isSelected ? st.color : undefined }}>
                          {cfg.label}
                        </span>
                        <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5">
                          {cfg.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Notes */}
            <section className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Notes
              </Label>
              <Textarea
                placeholder="Optional brief, caption ideas, or production notes…"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="min-h-[88px] resize-none text-sm"
              />
            </section>
          </div>

          {/* Live summary */}
          <div className="px-4 sm:px-6 py-3 border-t border-border/60 bg-muted/30 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Preview
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs sm:text-sm font-medium text-foreground">
              {form.platforms.length > 0 ? (
                <span className="inline-flex items-center" title={form.platforms.map(p => PLATFORM_CONFIG[p]?.label || p).join(", ")}>
                  {form.platforms.map((pl, i) => (
                    <span
                      key={pl}
                      className="h-5 w-5 rounded-full bg-background border border-border/70 flex items-center justify-center"
                      style={{ marginLeft: i > 0 ? -4 : 0, zIndex: form.platforms.length - i }}
                    >
                      <PlatformIconImg platform={pl} className="h-3 w-3" />
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">No platforms</span>
              )}
              <span className="text-muted-foreground/50">·</span>
              <span>{CONTENT_TYPE_CONFIG[form.contentType]?.label || "Content"}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                {form.publishDate
                  ? `Goes live ${formatPlannerDate(form.publishDate)}`
                  : "Goes live not set"}
              </span>
              {showShootDayField(form.contentType) && form.shootingDate ? (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>Shoot {formatPlannerDate(form.shootingDate)}</span>
                </>
              ) : null}
              <span className="text-muted-foreground/50">·</span>
              <span
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: getStatusStyle(form.status, settings.primaryColor || "#5A428A", "#f6b317").color,
                  backgroundColor: getStatusStyle(form.status, settings.primaryColor || "#5A428A", "#f6b317").bg,
                }}
              >
                {STATUS_CONFIG[form.status]?.label || form.status}
              </span>
            </div>
            {form.title.trim() ? (
              <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                “{form.title.trim()}”
              </p>
            ) : null}
          </div>

          <DialogFooter className="px-4 sm:px-6 py-3 border-t border-border/60 shrink-0 flex-row items-center justify-between gap-2 sm:space-x-0">
            {editingPost ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5 text-xs font-semibold"
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this post?")) {
                    await handleDelete(editingPost.postIds);
                    setShowAddDialog(false);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            ) : (
              <span className="hidden sm:inline" />
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 min-w-[110px]">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : editingPost ? (
                  <Pencil className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving..." : editingPost ? "Update Post" : "Add Post"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Month Dialog */}
      <Dialog open={showDupDialog} onOpenChange={setShowDupDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="font-display">Duplicate Month Plan</DialogTitle>
            <DialogDescription className="text-xs">
              Copy all posts from a previous month into {MONTHS[month - 1]} {year}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                Posts will be copied as <strong>Draft</strong> and dates shifted to match the same day-of-month in{" "}
                {MONTHS[month - 1]} {year}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">From Month</Label>
                <Select value={String(dupMonth)} onValueChange={v => setDupMonth(Number(v))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">From Year</Label>
                <Select value={String(dupYear)} onValueChange={v => setDupYear(Number(v))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[year - 1, year, year + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicating} className="gap-1.5">
              {duplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              {duplicating ? "Copying..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Month Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="font-display text-red-600">Clear Month Plan</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete all {posts.length} posts for {MONTHS[month - 1]} {year}?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <p className="text-sm font-medium">This action cannot be undone.</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearMonth} disabled={clearing} className="gap-1.5">
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {clearing ? "Clearing..." : "Clear All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className={`transition-all duration-300 ${aiPreviewPosts.length > 0 ? 'sm:max-w-[800px]' : 'sm:max-w-[450px]'}`}>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" /> Generate AI Content Plan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Powered by OpenAI. Generates highly relevant posts for {MONTHS[month - 1]} {year}.
            </DialogDescription>
          </DialogHeader>

          {!aiPreviewPosts.length ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Target Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map(pl => {
                    const isSelected = aiConfig.platforms.includes(pl);
                    return (
                      <Badge
                        key={pl}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer ${isSelected ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                        onClick={() => {
                          setAiConfig(p => ({
                            ...p,
                            platforms: isSelected
                              ? p.platforms.filter(x => x !== pl)
                              : [...p.platforms, pl]
                          }));
                        }}
                      >
                        {PLATFORM_CONFIG[pl]?.label || pl}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Number of Posts</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={aiConfig.numberOfPosts}
                    onChange={e => setAiConfig(p => ({ ...p, numberOfPosts: parseInt(e.target.value) || 12 }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Tone of Voice</Label>
                  <Select value={aiConfig.tone} onValueChange={v => setAiConfig(p => ({ ...p, tone: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Professional yet engaging">Professional</SelectItem>
                      <SelectItem value="Educational & authoritative">Educational</SelectItem>
                      <SelectItem value="Casual & entertaining">Casual</SelectItem>
                      <SelectItem value="Inspirational & motivational">Inspirational</SelectItem>
                      <SelectItem value="Sales oriented & promotional">Promotional</SelectItem>
                      <SelectItem value="Mixed variety">Mixed Variety</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Focus Topics (Optional)</Label>
                <Textarea
                  value={aiConfig.focusTopics}
                  onChange={e => setAiConfig(p => ({ ...p, focusTopics: e.target.value }))}
                  placeholder="E.g. Summer promotion, new software updates, behind the scenes..."
                  className="resize-none h-20"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => setShowAiDialog(false)} disabled={aiGenerating}>Cancel</Button>
                <Button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || aiConfig.platforms.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                >
                  {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiGenerating ? "Generating..." : "Generate Ideas"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-2 flex flex-col max-h-[60vh] h-full">
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {aiPreviewPosts.map(post => (
                  <div key={post.id} className="p-3 border rounded-xl relative group">
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Include</Label>
                      <Switch
                        checked={post.selected}
                        onCheckedChange={v => setAiPreviewPosts(prev => prev.map(p => p.id === post.id ? { ...p, selected: v } : p))}
                        className="data-[state=checked]:bg-emerald-500 scale-90"
                      />
                    </div>

                    <div className={`transition-opacity ${!post.selected ? 'opacity-50' : 'opacity-100'}`}>
                      <div className="pr-20">
                        <Input
                          value={post.title}
                          onChange={e => setAiPreviewPosts(prev => prev.map(p => p.id === post.id ? { ...p, title: e.target.value } : p))}
                          className="font-bold text-sm h-8 border-none p-0 focus-visible:ring-1 focus-visible:ring-purple-500/50 shadow-none -ml-2 px-2 rounded-md transition-all"
                        />
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase tracking-wider">{post.platform}</Badge>
                        <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Publish: {post.publishDate}</span>
                      </div>

                      <Textarea
                        value={post.notes}
                        onChange={e => setAiPreviewPosts(prev => prev.map(p => p.id === post.id ? { ...p, notes: e.target.value } : p))}
                        className="text-xs h-16 resize-none mt-3 border-dashed focus-visible:ring-purple-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 mt-2 border-t">
                <span className="text-sm font-bold">{aiPreviewPosts.filter(p => p.selected).length} generated posts selected</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setAiPreviewPosts([])} disabled={saving}>Discard Ideas</Button>
                  <Button onClick={handleSaveAiPosts} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save to Plan
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Standalone Page ──────────────────────────────────────────────

export default function SocialMediaPlannerPage() {
  const navigate = useNavigate();
  const { clients, fetchClients } = useAgencyStore();
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [connectedClientIds, setConnectedClientIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (clients.length === 0) fetchClients();
    apiFetch<any>("/social/accounts?limit=1000")
      .then(res => {
        const accs = Array.isArray(res) ? res : (res?.accounts || []);
        const set = new Set<string>();
        accs.forEach((a: any) => { if (a.clientId) set.add(a.clientId); });
        setConnectedClientIds(set);
      })
      .catch(() => {});
  }, [clients.length, fetchClients]);

  const clientsWithAccounts = useMemo(() => {
    const filtered = clients.filter(c => connectedClientIds.has(c.id) || ((c as any)._count?.socialAccounts ?? 0) > 0);
    return filtered.length > 0 ? filtered : clients;
  }, [clients, connectedClientIds]);

  const client = clients.find(c => c.id === selectedClient);

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9"
            onClick={() => navigate("/dashboard/social-media")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Content Planner</h1>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">
              Build monthly social media calendars and export branded PDFs
            </p>
          </div>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs font-bold uppercase tracking-wider mb-2 block">Select Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue placeholder="Choose a client to plan for..." />
                </SelectTrigger>
                <SelectContent>
                  {clientsWithAccounts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {client && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {client.initials || (client.company || client.name).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold">{client.company || client.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {client.industry || "Agency Client"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedClient ? (
        <ClientMonthlyPlannerTab
          clientId={selectedClient}
          clientName={client?.name}
          clientCompany={client?.company}
        />
      ) : (
        <div className="py-20 text-center border-2 border-dashed border-border/30 rounded-3xl bg-muted/5">
          <CalendarIcon className="h-12 w-12 text-muted-foreground/25 mx-auto mb-4" />
          <p className="text-sm font-bold text-muted-foreground">Select a client to start planning</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Monthly content calendars are linked to individual clients
          </p>
        </div>
      )}
    </div>
  );
}