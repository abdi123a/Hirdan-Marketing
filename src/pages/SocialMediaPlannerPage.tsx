import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import {
  ArrowLeft, Plus, Download, Copy, ChevronLeft, ChevronRight,
  Instagram, Facebook, Linkedin, Youtube, Twitter,
  Trash2, Pencil, Calendar, Loader2, Zap, Send, Image,
  Sparkles, FileDown, CheckCircle2, Clock, Eye, AlertCircle
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { CardGridSkeleton } from "@/components/ui/PageSkeleton";
import { useAgencyStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "text-slate-500", bg: "bg-slate-100 border-slate-300 dark:bg-slate-800/50 dark:border-slate-600", icon: Clock },
  SCHEDULED: { label: "Scheduled", color: "text-blue-600", bg: "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700", icon: Calendar },
  FILMED: { label: "Filmed", color: "text-purple-600", bg: "bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-700", icon: Eye },
  PUBLISHED: { label: "Published", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700", icon: CheckCircle2 },
  DELAYED: { label: "Delayed", color: "text-red-500", bg: "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700", icon: AlertCircle },
};

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
  if (!hex || !hex.startsWith("#") || hex.length < 7) return `rgba(80, 65, 136, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${isNaN(r) ? 80 : r}, ${isNaN(g) ? 65 : g}, ${isNaN(b) ? 136 : b}, ${alpha})`;
};

const shiftHexShade = (hex: string, amount: number) => {
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#504188";
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

// ─── Reusable PDF Components ──────────────────────────────────────

function PdfLegendPill({
  label,
  backgroundColor,
  borderColor,
  dotColor,
}: {
  label: string;
  backgroundColor: string;
  borderColor: string;
  dotColor: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        padding: "7px 16px",
        borderRadius: "999px",
        backgroundColor,
        border: `2px solid ${borderColor}`,
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          width: "9px",
          height: "9px",
          borderRadius: "999px",
          backgroundColor: dotColor,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontSize: "11px",
          fontWeight: 800,
          color: dotColor,
          textTransform: "uppercase",
          letterSpacing: "0.9px",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function PdfFooterItem({
  text,
  iconSrc,
  color = "#ffffff",
  fontWeight = 600,
}: {
  text: string;
  iconSrc: string;
  color?: string;
  fontWeight?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color,
        height: "12px",
      }}
    >
      <span
        style={{
          width: "12px",
          height: "12px",
          textAlign: "center",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={iconSrc}
          alt=""
          style={{
            width: "12px",
            height: "12px",
            objectFit: "contain",
            display: "block",
          }}
        />
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: "11px",
          fontWeight,
          whiteSpace: "nowrap",
          lineHeight: "12px",
          height: "12px",
        }}
      >
        {text}
      </span>
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
  const pdfRef = useRef<HTMLDivElement>(null);

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
      toast({ title: "Publish Date is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingPost) {
        const oldPostIds = editingPost.postIds;
        let idIndex = 0;

        for (const platform of form.platforms) {
          const payload = {
            month,
            year,
            title: form.title.trim(),
            platform,
            status: form.status,
            contentType: form.contentType || "graphic",
            shootingDate: form.shootingDate,
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
        for (const platform of form.platforms) {
          const payload = {
            month,
            year,
            title: form.title.trim(),
            platform,
            status: form.status,
            contentType: form.contentType || "graphic",
            shootingDate: form.shootingDate,
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
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      // Ensure web fonts are loaded before rasterizing.
      const docWithFonts = document as Document & { fonts?: { ready: Promise<unknown> } };
      if (docWithFonts.fonts?.ready) {
        await docWithFonts.fonts.ready;
      }
      // Ensure embedded footer icons are fully decoded before capture.
      const imageNodes = Array.from(pdfRef.current.querySelectorAll("img"));
      await Promise.all(
        imageNodes.map(async img => {
          if (img.decode) {
            try {
              await img.decode();
              return;
            } catch {
              // Fall back to load events if decode fails.
            }
          }
          await new Promise<void>(resolve => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );

      const captureScale = 3;
      const jpegQuality = 0.94;
      const canvas = await html2canvas(pdfRef.current, {
        // Higher scale improves text and icon sharpness in export.
        scale: captureScale,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", jpegQuality);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });

      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
      pdf.save(`${clientDisplayName}-${MONTHS[month - 1]}-${year}-Content-Plan.pdf`);
      toast({ title: "PDF exported!", description: "Download started" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
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
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div
              className="grid grid-cols-7"
              style={{ backgroundColor: settings.primaryColor || "#504188" }}
            >
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/90">
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-t border-[#C5CAD8]">
                {week.map((day, di) => {
                  const eventsOnDay = getEventsForDay(groupedPosts, day, month, year);
                  const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

                  return (
                    <div
                      key={di}
                      className={`min-h-[90px] border-r last:border-r-0 border-[#C5CAD8] bg-[#D5D9E8]/40 dark:bg-[#2E3A59]/10 relative ${day ? "cursor-pointer hover:bg-primary/5 transition-colors" : "opacity-40"}`}
                      onClick={() =>
                        day &&
                        openAdd(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
                      }
                    >
                      {day && (
                        <>
                          <div className="px-2 pt-1.5 pb-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-[#2E3A59] dark:text-foreground/80"
                                }`}
                            >
                              {DAYS_OF_WEEK[di].slice(0, 3)} {String(day).padStart(2, "0")}
                            </span>
                          </div>

                          <div className="px-1 pb-1 space-y-1">
                            {eventsOnDay.map(ev => {
                              const g = ev.group;
                              const isShoot = ev.type === "SHOOT";
                              const stStyle = getStatusStyle(g.status, settings.primaryColor || "#504188", "#f6b317");
                              const ct = g.contentType || inferContentType(g.title, g.platforms);
                              const ctAccentColor = CONTENT_TYPE_COLORS[ct] || "#9b8fd4";
                              const ctConfig = CONTENT_TYPE_CONFIG[ct];
                              const statusColor = PDF_STATUS_DOT_COLORS[g.status] || PDF_STATUS_DOT_COLORS.DRAFT;
                              const eventLabel = isShoot ? "Shooting" : (STATUS_CONFIG[g.status]?.label || g.status);

                              return (
                                <div
                                  key={ev.id}
                                  className="flex flex-col gap-1.5 px-2.5 py-2 rounded-r-[10px] rounded-l-none shadow-[0_2px_6px_rgba(0,0,0,0.06)] border border-black/5 border-l-0 cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(0,0,0,0.10)] bg-white dark:bg-card"
                                  title={`${g.title} (${g.platforms.join(", ")}) — ${ctConfig?.label || ct} — Status: ${g.status}`}
                                  onClick={e => {
                                    e.stopPropagation();
                                    openEdit(g);
                                  }}
                                  style={{
                                    borderLeft: `3px solid ${ctAccentColor}`,
                                  }}
                                >
                                  {/* Top row: event label + status dot */}
                                  <div className="flex items-center justify-between gap-1">
                                    <span 
                                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-white"
                                      style={{
                                        backgroundColor: isShoot ? "#6B7FD4" : statusColor
                                      }}
                                    >
                                      {eventLabel}
                                    </span>

                                    <Select
                                      value={g.status}
                                      onValueChange={(v) => handleStatusChangeGroup(g, v)}
                                    >
                                      <SelectTrigger className="h-4 w-4 border-none shadow-none p-0 bg-transparent flex items-center justify-center">
                                        <div
                                          className="w-1.5 h-1.5 rounded-full ring-2 ring-offset-1 ring-offset-transparent transition-all hover:scale-125"
                                          style={{ backgroundColor: stStyle.color }}
                                          title={`Current Status: ${g.status} (Click to change)`}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ALL_STATUSES.map(s => (
                                          <SelectItem key={s} value={s} className="text-[10px] py-1 px-2">
                                            <div className="flex items-center gap-2">
                                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s].color }} />
                                              {STATUS_CONFIG[s].label}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Post title with emoji in front */}
                                  <div className="text-[9px] font-semibold text-[#111827] dark:text-foreground leading-tight line-clamp-2 flex items-center gap-1">
                                    <span className="text-[10px] leading-none shrink-0">{ctConfig?.emoji || "🎨"}</span>
                                    <span>{g.title}</span>
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
        {Object.entries(STATUS_CONFIG).map(([k, v]) => {
          const st = getStatusStyle(k, settings.primaryColor || "#504188", "#f6b317");
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
              <Calendar className="h-4 w-4 text-primary" />
              {MONTHS[month - 1]} {year} — Content Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b border-border/40">
                  <tr>
                    {["Post Title", "Platform", "Status", "Shoot Date", "Publish Date", "Notes", ""].map(h => (
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
                    const scStyle = getStatusStyle(g.status, settings.primaryColor || "#504188", "#f6b317");

                    return (
                      <tr key={g.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-2.5 text-[11px] font-semibold text-foreground max-w-[180px] truncate">{g.title}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {g.platforms.map((pl: string) => {
                              const pc = PLATFORM_CONFIG[pl] || PLATFORM_CONFIG.OTHER;
                              const PIcon = pc.icon;
                              return (
                                <div
                                  key={pl}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-bold ${pc.bg}`}
                                >
                                  {pl === "PINTEREST" ? (
                                    <img src="/social-icons/pinterest.png" className="h-2.5 w-2.5 object-contain" alt="Pinterest" />
                                  ) : (
                                    <PIcon className={`h-2.5 w-2.5 ${pc.color}`} />
                                  )}
                                  <span className={pc.color}>{pc.label.slice(0, 3)}</span>
                                </div>
                              );
                            })}
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
                                const sStyle = getStatusStyle(s, settings.primaryColor || "#504188", "#f6b317");
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
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
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

      {/* Hidden PDF Template */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={pdfRef}
          style={{
            width: 1200,
            backgroundColor: "#ffffff",
            fontFamily: "'Inter', -apple-system, sans-serif",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Watermark */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-45deg)",
              opacity: 0.04,
              pointerEvents: "none",
              zIndex: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "140%",
            }}
          >
            {settings.logo ? (
              <img
                src={settings.logo}
                alt="watermark"
                crossOrigin="anonymous"
                style={{ width: "100%", height: "auto", filter: "grayscale(100%)" }}
              />
            ) : (
              <div
                style={{
                  fontSize: "240px",
                  fontWeight: 900,
                  color: "#0f172a",
                  textTransform: "uppercase",
                  textAlign: "center",
                  lineHeight: 0.9,
                }}
              >
                {settings.agencyName || "Hirdan"}
              </div>
            )}
          </div>

          {/* Top bar */}
          <div style={{ display: "flex", height: "12px", width: "100%", zIndex: 1, position: "relative" }}>
            <div style={{ flex: 1, background: settings.primaryColor || "#504188" }} />
            <div style={{ width: "30%", background: "#f6b317" }} />
          </div>

          <div
            style={{
              padding: "40px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "40px",
              }}
            >
              <div style={{ flex: 1 }}>
                {settings.logo ? (
                  <img
                    src={settings.logo}
                    alt={settings.agencyName}
                    crossOrigin="anonymous"
                    style={{ height: "100px", width: "auto", objectFit: "contain", maxWidth: "400px" }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: "56px",
                      fontWeight: 900,
                      color: settings.primaryColor || "#504188",
                      letterSpacing: "-1.5px",
                      lineHeight: 1,
                    }}
                  >
                    {settings.agencyName || "Hirdan Marketing"}
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "48px",
                    fontWeight: 900,
                    color: settings.primaryColor || "#504188",
                    letterSpacing: "-1.5px",
                    textTransform: "uppercase",
                    lineHeight: 1,
                    marginBottom: "24px",
                  }}
                >
                  CONTENT PLAN
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                    gap: "12px",
                    justifyContent: "end",
                  }}
                >
                  <div
                    style={{
                      border: `1px solid ${hexToRgba(settings.primaryColor || "#504188", 0.35)}`,
                      background: hexToRgba(settings.primaryColor || "#504188", 0.08),
                      borderRadius: "12px",
                      padding: "10px 12px",
                      textAlign: "left",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 900,
                        color: settings.primaryColor || "#504188",
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        marginBottom: "5px",
                        lineHeight: 1,
                      }}
                    >
                      Client
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 900,
                        color: "#0f172a",
                        lineHeight: 1.15,
                        wordBreak: "break-word",
                      }}
                    >
                      {clientDisplayName}
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(246,179,23,0.45)",
                      background: "rgba(246,179,23,0.12)",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      textAlign: "left",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 900,
                        color: "#a16207",
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        marginBottom: "5px",
                        lineHeight: 1,
                      }}
                    >
                      Schedule
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 900,
                        color: "#0f172a",
                        lineHeight: 1.15,
                      }}
                    >
                      {MONTHS[month - 1]} {year}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div
              style={{
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
                backgroundColor: "#ffffff",
                flex: 1,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {DAYS_OF_WEEK.map((d, i) => (
                  <div
                    key={d}
                    style={{
                      padding: "14px 16px",
                      background: settings.primaryColor || "#504188",
                      color: "#ffffff",
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      borderRight: i < 6 ? "1px solid rgba(255,255,255,0.2)" : "none",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {weeks.map((week, wi) => (
                <div
                  key={wi}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    borderTop: wi === 0 ? "none" : "1px solid #e2e8f0",
                  }}
                >
                  {week.map((day, di) => {
                    const eventsOnDay = getEventsForDay(groupedPosts, day, month, year);
                    const isWeekend = di === 0 || di === 6;

                    return (
                      <div
                        key={di}
                        style={{
                          minHeight: "135px",
                          borderRight: di < 6 ? "1px solid #e2e8f0" : "none",
                          backgroundColor: day ? (isWeekend ? "#fafafa" : "#ffffff") : "#f1f5f9",
                          padding: "12px 10px",
                          boxSizing: "border-box",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {day && (
                          <>
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: 900,
                                color: "#94a3b8",
                                textAlign: "right",
                                marginBottom: "8px",
                                lineHeight: 1,
                              }}
                            >
                              {day}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                flex: 1,
                              }}
                            >
                              {eventsOnDay.map((ev) => {
                                const g = ev.group;
                                const contentType = g.contentType || inferContentType(g.title, g.platforms);
                                const accentColor = CONTENT_TYPE_COLORS[contentType] || "#9b8fd4";
                                const statusDotColor = PDF_STATUS_DOT_COLORS[g.status] || PDF_STATUS_DOT_COLORS.DRAFT;

                                // Inline SVG platform icons (html2canvas-safe)
                                const PlatformIconSvg = ({ platform }: { platform: string }) => {
                                  const iconColor = "#64748b";
                                  const size = 13;
                                  // Simple brand-recognisable glyphs via path / text
                                  if (platform === "INSTAGRAM") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                                        <circle cx="12" cy="12" r="4"/>
                                        <circle cx="17.5" cy="6.5" r="1" fill={iconColor} stroke="none"/>
                                      </svg>
                                    );
                                  }
                                  if (platform === "FACEBOOK") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor}>
                                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                                      </svg>
                                    );
                                  }
                                  if (platform === "TIKTOK") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor}>
                                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.98a8.14 8.14 0 0 0 4.77 1.53V7.07a4.85 4.85 0 0 1-1-.38z"/>
                                      </svg>
                                    );
                                  }
                                  if (platform === "LINKEDIN") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor}>
                                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                                        <rect x="2" y="9" width="4" height="12"/>
                                        <circle cx="4" cy="4" r="2"/>
                                      </svg>
                                    );
                                  }
                                  if (platform === "YOUTUBE") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor}>
                                        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                                        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff"/>
                                      </svg>
                                    );
                                  }
                                  if (platform === "X") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor}>
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                      </svg>
                                    );
                                  }
                                  if (platform === "PINTEREST") {
                                    return (
                                      <svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor}>
                                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.63 11.16-.1-.95-.19-2.41.04-3.45.21-.93 1.37-5.82 1.37-5.82s-.35-.7-.35-1.74c0-1.63.95-2.85 2.13-2.85 1.01 0 1.49.75 1.49 1.66 0 1.01-.64 2.53-.98 3.93-.28 1.18.59 2.14 1.75 2.14 2.1 0 3.72-2.22 3.72-5.42 0-2.84-2.04-4.82-4.94-4.82-3.37 0-5.34 2.53-5.34 5.14 0 1.02.39 2.11.88 2.71a.36.36 0 0 1 .08.34c-.1.4-.3.1.33.56c-.04.16-.16.28-.27.32-.47-.22-1.12-1.07-1.12-2.12 0-3.36 2.44-6.44 7.03-6.44 3.69 0 6.56 2.63 6.56 6.15 0 3.67-2.31 6.62-5.52 6.62-1.08 0-2.1-.56-2.44-1.22 0 0-.53 2.04-.66 2.54-.24.92-.89 2.08-1.32 2.79C10.02 23.82 11.01 24 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/>
                                      </svg>
                                    );
                                  }
                                  // Fallback: a simple circle with first letter
                                  const label = (PLATFORM_CONFIG[platform]?.label || platform).slice(0, 1).toUpperCase();
                                  return (
                                    <svg width={size} height={size} viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="11" fill="none" stroke={iconColor} strokeWidth="2"/>
                                      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill={iconColor}>{label}</text>
                                    </svg>
                                  );
                                };

                                return (
                                  <div
                                    key={ev.id}
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      borderLeft: `4px solid ${accentColor}`,
                                      borderTop: "0.5px solid #e2e8f0",
                                      borderRight: "0.5px solid #e2e8f0",
                                      borderBottom: "0.5px solid #e2e8f0",
                                      borderRadius: "0 8px 8px 0",
                                      padding: "8px 10px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "4px",
                                      boxSizing: "border-box",
                                      position: "relative",
                                    }}
                                  >
                                    {/* Status dot — top right */}
                                    <span
                                      style={{
                                        position: "absolute",
                                        top: "8px",
                                        right: "8px",
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        backgroundColor: statusDotColor,
                                        display: "inline-block",
                                        flexShrink: 0,
                                      }}
                                    />

                                    {/* Platform icons row */}
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        flexWrap: "wrap",
                                        paddingRight: "14px", // avoid overlap with status dot
                                      }}
                                    >
                                      {g.platforms.map((pl: string) => (
                                        <span key={pl} style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}>
                                          <PlatformIconSvg platform={pl} />
                                        </span>
                                      ))}
                                    </div>

                                     {/* Title — bottom, most prominent, with emoji in front */}
                                     <div
                                       style={{
                                         fontSize: "11px",
                                         fontWeight: 500,
                                         color: "#1f2937",
                                         lineHeight: 1.3,
                                         marginTop: "auto",
                                         fontFamily: "'Inter', -apple-system, sans-serif",
                                         display: "flex",
                                         alignItems: "center",
                                         gap: "4px",
                                       }}
                                     >
                                       <span style={{ fontSize: "12px", lineHeight: 1, flexShrink: 0 }}>
                                         {CONTENT_TYPE_CONFIG[contentType]?.emoji || "🎨"}
                                       </span>
                                       <span>{g.title}</span>
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

          {/* Footer */}
          <div
            style={{
              marginTop: "auto",
              background: settings.primaryColor || "#504188",
              color: "#ffffff",
              padding: "24px 40px",
              zIndex: 1,
              position: "relative",
            }}
          >
            <div
              style={{
                width: "70%",
                height: "5px",
                background: "#f6b317",
                borderRadius: "4px",
                position: "absolute",
                top: 0,
                left: "15%",
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", flexDirection: "column", justifyContent: "center" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    opacity: 0.9,
                    lineHeight: 1,
                  }}
                >
                  PREPARED BY {settings.agencyName?.toUpperCase() || "HIRDAN MARKETING"}
                </div>

                <div
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.5)",
                    fontWeight: 600,
                    fontStyle: "italic",
                    lineHeight: 1,
                  }}
                >
                  Plan generated{" "}
                  {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>

              <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "32px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "28px",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    opacity: 0.95,
                    flexWrap: "wrap",
                  }}
                >
                  {settings.phone && (
                    <PdfFooterItem
                      iconSrc="/pdf-icons/phone.png"
                      text={settings.phone}
                    />
                  )}

                  {settings.adminEmail && (
                    <PdfFooterItem
                      iconSrc="/pdf-icons/email.png"
                      text={settings.adminEmail}
                    />
                  )}

                  {settings.website && (
                    <PdfFooterItem
                      iconSrc="/pdf-icons/web.png"
                      text={settings.website.replace(/^https?:\/\//, "")}
                      color="#f6b317"
                      fontWeight={900}
                    />
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display">{editingPost ? "Edit Post" : "Add Content Post"}</DialogTitle>
            <DialogDescription className="text-xs">
              {MONTHS[month - 1]} {year} • {clientDisplayName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <Label className="text-xs font-bold">Post Title *</Label>
              <Input
                placeholder="e.g. Publishing Video 1"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            {/* ── Content Type Selector ── */}
            <div>
              <Label className="text-xs font-bold block mb-2">Content Type *</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(CONTENT_TYPE_CONFIG).map(([key, cfg]) => {
                  const isSelected = form.contentType === key;
                  const dotColor = CONTENT_TYPE_COLORS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, contentType: key }))}
                      className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-all duration-150 ${
                        isSelected
                          ? "border-current shadow-sm scale-[1.03]"
                          : "border-border/60 hover:border-border bg-muted/20 hover:bg-muted/40"
                      }`}
                      style={isSelected ? { borderColor: dotColor, backgroundColor: `${dotColor}12` } : {}}
                    >
                      <span className="text-xl leading-none">{cfg.emoji}</span>
                      <span
                        className="text-[11px] font-bold leading-none"
                        style={isSelected ? { color: dotColor } : { color: "var(--muted-foreground)" }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        className="text-[9px] leading-tight opacity-70"
                        style={isSelected ? { color: dotColor } : { color: "var(--muted-foreground)" }}
                      >
                        {cfg.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold block mb-2">Platforms *</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map(pl => {
                    const pc = PLATFORM_CONFIG[pl];
                    const PIcon = pc.icon;
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected
                          ? `${pc.bg} border-current ${pc.color} shadow-sm ring-1 ring-current`
                          : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                          }`}
                      >
                        {pl === "PINTEREST" ? (
                          <img src="/social-icons/pinterest.png" className="h-3.5 w-3.5 object-contain" alt="Pinterest" />
                        ) : (
                          <PIcon className="h-3.5 w-3.5" />
                        )}
                        {pc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Shooting Date *</Label>
                <Input
                  type="date"
                  value={form.shootingDate}
                  onChange={e => setForm(p => ({ ...p, shootingDate: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Publish Date *</Label>
                <Input
                  type="date"
                  value={form.publishDate}
                  onChange={e => setForm(p => ({ ...p, publishDate: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Notes</Label>
              <Textarea
                placeholder="Optional notes or content brief..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="mt-1.5 min-h-[80px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between w-full">
            {editingPost ? (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto gap-1.5 text-xs font-semibold"
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this post?")) {
                    await handleDelete(editingPost.postIds);
                    setShowAddDialog(false);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            ) : null}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
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
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Publish: {post.publishDate}</span>
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

  useEffect(() => {
    if (clients.length === 0) fetchClients();
  }, [clients.length, fetchClients]);

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
                  {clients.map(c => (
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
          <Calendar className="h-12 w-12 text-muted-foreground/25 mx-auto mb-4" />
          <p className="text-sm font-bold text-muted-foreground">Select a client to start planning</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Monthly content calendars are linked to individual clients
          </p>
        </div>
      )}
    </div>
  );
}