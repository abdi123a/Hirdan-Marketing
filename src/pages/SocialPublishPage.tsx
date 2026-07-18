import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { CardGridSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth-store";
import { useAgencyStore } from "@/lib/store";
import {
  Plus, Calendar, Clock, RefreshCw, Trash2, Sparkles, Image as ImageIcon, Loader2, Heart, MessageSquare, Share2, HelpCircle, ArrowLeft, X, Settings,
  Tag, Tags, ChevronDown, Zap, Music, ShoppingBag, Eye, Link as LinkIcon, Link2, Link2Off, Maximize2, Minimize2, ChevronUp, MoreHorizontal, Search, Disc, Volume2, Smile, FileText, Check, Bookmark,
  ImagePlus, Hash, ThumbsUp, ThumbsDown, MessageCircle, Repeat2, Send, Play, BarChart2, MapPin, Info, SquarePen, Grid, List, ArrowUpDown, User, Copy, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2
} from "lucide-react";

/* ---------------- Brand glyphs (simple, generic mono icons from user design) ---------------- */
const XGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M18.9 2H22l-7.6 8.7L23 22h-6.6l-5.2-6.8L5.2 22H2l8.1-9.3L1.5 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
  </svg>
);
const FacebookGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
  </svg>
);
const InstagramGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" style={style}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
const LinkedInGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M6.9 8.6H3.4V21h3.5V8.6ZM5.2 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM21 21h-3.5v-6.4c0-1.5 0-3.5-2.1-3.5s-2.5 1.7-2.5 3.4V21H9.4V8.6h3.4v1.7h.05c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5V21Z" />
  </svg>
);
const TikTokGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M16.6 3c.4 2 1.7 3.4 3.9 3.7v2.6c-1.4 0-2.7-.4-3.9-1.3v6.6a5.6 5.6 0 1 1-4.8-5.5v2.7a3 3 0 1 0 2.1 2.8V3h2.7Z" />
  </svg>
);
const YouTubeGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M9.8 15.5V8.5l6 3.5-6 3.5Z" />
  </svg>
);
const ThreadsGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" style={style}>
    <path d="M12 21c-4.5 0-7.5-2.6-7.5-8.9C4.5 5.9 7.6 3 12 3s7.2 2.6 7.4 6.7c.1 2.7-1.1 4-3 4-1.7 0-2.6-1-2.7-2.3-.1-1.7.9-2.6.9-2.6M12.2 12.4c2 .1 3.4 1 3.3 2.8-.1 2-2 3-4 2.9-1.7-.1-3-1-2.9-2.5.1-1.8 2-2.5 3.6-2.5.6 0 1.2.1 1.7.3" />
  </svg>
);
const YouTubeIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
  const isContrast = style?.color === "#fff" || style?.color === "white" || className?.includes("text-white");
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <rect x="2" y="4.7" width="20" height="14.6" rx="4.5" fill="currentColor" />
      <path d="M9.8 15.5V8.5l6 3.5-6 3.5Z" fill={isContrast ? "#FF0000" : "white"} />
    </svg>
  );
};

const PLATFORMS_CONFIG = [
  { id: "x", label: "Twitter / X", color: "#000000", icon: XGlyph, limit: 280, hasThread: true },
  { id: "facebook", label: "Facebook", color: "#1877F2", icon: FacebookGlyph, limit: 63206, postTypes: ["Post", "Reel", "Story"] },
  { id: "instagram", label: "Instagram", color: "#D6249F", icon: InstagramGlyph, limit: 2200, postTypes: ["Post", "Reel", "Story"] },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", icon: LinkedInGlyph, limit: 3000 },
  { id: "tiktok", label: "TikTok", color: "#000000", icon: TikTokGlyph, limit: 4000 },
  { id: "youtube", label: "YouTube", color: "#FF0000", icon: YouTubeIcon, limit: 5000 },
  { id: "threads", label: "Threads", color: "#000000", icon: ThreadsGlyph, limit: 500, hasThread: true },
];

const TRENDING_TOPICS = ["Coffee Break", "Monday Motivation", "Tech News", "More..."];

interface SocialPost {
  id: string;
  clientId: string;
  caption: string;
  platformContent: any;
  mediaUrls: any;
  mediaType: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  campaignId: string | null;
  createdAt: string;
  updatedAt: string;
  destinations: Array<{
    id: string;
    socialAccountId: string;
    platform: string;
    status: string;
    lastError: string | null;
    socialAccount: { displayName: string; platformUsername?: string };
  }>;
}

interface SocialAccount {
  id: string;
  platform: string;
  displayName: string;
  platformUsername: string;
  avatarUrl?: string;
}

interface Client {
  id: string;
  name: string;
  company: string;
}

interface SocialCampaign {
  id: string;
  clientId: string;
  name: string;
  status: string;
}

interface UploadProgressFile {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "failed";
  url?: string;
  type: string;
}

// Helpers
const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return `rgba(80, 65, 136, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${isNaN(r) ? 80 : r}, ${isNaN(g) ? 65 : g}, ${isNaN(b) ? 136 : b}, ${alpha})`;
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case "DRAFT":
      return { text: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800", dot: "bg-slate-400" };
    case "AWAITING_APPROVAL":
      return { text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/20", border: "border-sky-200 dark:border-sky-900/50", dot: "bg-sky-500" };
    case "SCHEDULED":
      return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/50", dot: "bg-amber-500" };
    case "PUBLISHED":
      return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/50", dot: "bg-emerald-500" };
    case "FAILED":
      return { text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-900/50", dot: "bg-rose-500" };
    default:
      return { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400" };
  }
};

function inferContentType(title: string, platforms: string[]): string {
  const t = title.toLowerCase();
  if (/\\bvideo\\b|\\breel\\b|\\btiktok\\b|\\bshort\\b|\\bfilm\\b|\\bfilmed\\b|\\brecord/.test(t)) return "video";
  if (/\\bstory\\b|\\bstories\\b/.test(t)) return "story";
  if (/\\bphoto\\b|\\bpicture\\b|\\bimage\\b|\\bpic\\b|\\bshot\\b/.test(t)) return "photo";
  if (platforms.some(p => p === "TIKTOK" || p === "YOUTUBE")) return "video";
  return "graphic";
}

function buildCalendarGrid(month: number, year: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function getWeekDays(date: Date) {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  startOfWeek.setDate(diff);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(startOfWeek);
    nextDay.setDate(startOfWeek.getDate() + i);
    days.push(nextDay);
  }
  return days;
}

export default function SocialPublishPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active view & navigation
  const [activeTab, setActiveTab] = useState<"posts" | "calendar">("posts");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [calendarView, setCalendarView] = useState<"month" | "week" | "agenda">("month");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(false);

  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [campaignFilter, setCampaignFilter] = useState("ALL");
  const [contentTypeFilter, setContentTypeFilter] = useState("ALL");
  const [writerFilter, setWriterFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("scheduled_desc");

  // Selection & Details Side panel
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isReschedulingOpen, setIsReschedulingOpen] = useState(false);

  // Composer modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [alreadyPublishedAccountIds, setAlreadyPublishedAccountIds] = useState<string[]>([]);
  const [composerClient, setComposerClient] = useState("");
  const [composerCampaign, setComposerCampaign] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [composerCaption, setComposerCaption] = useState("");
  const [composerMediaUrls, setComposerMediaUrls] = useState<string[]>([]);
  const [composerMediaType, setComposerMediaType] = useState("image");
  const [composerAccounts, setComposerAccounts] = useState<string[]>([]);
  const [composerScheduledFor, setComposerScheduledFor] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitType, setSubmitType] = useState<"draft" | "publish" | null>(null);

  // platform overrides
  const [showOverrides, setShowOverrides] = useState(false);
  const [platformOverrides, setPlatformOverrides] = useState<Record<string, string>>({});

  // Preview account selection state
  const [activePreviewAccount, setActivePreviewAccount] = useState<string>("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  // AI helper state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiTargetPlatform, setAiTargetPlatform] = useState("instagram");

  // Media uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressFiles, setUploadProgressFiles] = useState<UploadProgressFile[]>([]);

  // Redesigned composer states
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [activePlatform, setActivePlatform] = useState<string>("");
  const [showPreview, setShowPreview] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedComposerPlatform, setExpandedComposerPlatform] = useState<string | null>(null);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [postTags, setPostTags] = useState<string[]>([]);

  // Platform-specific content link/sync state
  const [syncedPlatforms, setSyncedPlatforms] = useState<Record<string, boolean>>({
    x: true, facebook: true, instagram: true, linkedin: true, tiktok: true, youtube: true, threads: true
  });

  // Platform specific options states
  const [instagramType, setInstagramType] = useState<"post" | "reel" | "story">("post");
  const [instagramMusic, setInstagramMusic] = useState(false);
  const [instagramTagProducts, setInstagramTagProducts] = useState(false);
  const [instagramStickerMode, setInstagramStickerMode] = useState("automatic");
  const [instagramFirstComment, setInstagramFirstComment] = useState("");
  const [instagramAiGenerated, setInstagramAiGenerated] = useState(false);

  const [facebookType, setFacebookType] = useState<"post" | "reel" | "story">("post");
  const [facebookMusic, setFacebookMusic] = useState(false);
  const [facebookTagProducts, setFacebookTagProducts] = useState(false);
  const [facebookStickerMode, setFacebookStickerMode] = useState("automatic");
  const [facebookFirstComment, setFacebookFirstComment] = useState("");
  const [facebookAiGenerated, setFacebookAiGenerated] = useState(false);

  const [tiktokTitle, setTiktokTitle] = useState("");
  const [tiktokAutomatic, setTiktokAutomatic] = useState("automatic");

  const [linkedinFirstComment, setLinkedinFirstComment] = useState("");

  const [pinterestTitle, setPinterestTitle] = useState("");
  const [pinterestLink, setPinterestLink] = useState("");

  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeType, setYoutubeType] = useState<"short" | "video">("short");
  const [threadsTopic, setThreadsTopic] = useState("");
  const [threadsLocation, setThreadsLocation] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [postsData, clientsData, campaignsData, teamData] = await Promise.all([
        apiFetch<{ posts: SocialPost[] }>("/social/posts?limit=1000"),
        apiFetch<any>("/clients"),
        apiFetch<any>("/social/campaigns"),
        apiFetch<any>("/team"),
      ]);
      setPosts(postsData?.posts || []);
      const clientsList = Array.isArray(clientsData)
        ? clientsData
        : (clientsData && Array.isArray(clientsData.clients) ? clientsData.clients : []);
      setClients(clientsList);
      setCampaigns(campaignsData || []);
      setTeamMembers(teamData?.team || []);
    } catch (err: any) {
      toast({
        title: "Error loading publisher workspace",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load client's connected accounts in composer
  useEffect(() => {
    if (composerClient) {
      apiFetch<SocialAccount[]>(`/social/accounts/by-client/${composerClient}`)
        .then((res) => {
          setAccounts(res || []);
          if (!editingPostId) {
            if (res && res.length > 0) {
              const connectedPlatforms = Array.from(new Set(res.map(acc => acc.platform.toLowerCase())));
              setSelectedPlatforms(connectedPlatforms);
              setComposerAccounts(res.map(acc => acc.id));
              setActivePlatform(connectedPlatforms[0]);
              setActivePreviewAccount(res[0].id);
            } else {
              setSelectedPlatforms(["instagram"]);
              setActivePlatform("instagram");
              setComposerAccounts([]);
              setActivePreviewAccount("");
            }
          }
        })
        .catch(() => {
          if (!editingPostId) {
            setSelectedPlatforms(["instagram"]);
            setActivePlatform("instagram");
            setComposerAccounts([]);
            setActivePreviewAccount("");
          }
        });
    } else {
      setAccounts([]);
      if (!editingPostId) {
        setSelectedPlatforms([]);
        setComposerAccounts([]);
        setActivePlatform("");
        setActivePreviewAccount("");
      }
    }
  }, [composerClient, editingPostId]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const uploadId = Math.random().toString(36).substring(7);
      const isVideo = file.type.startsWith("video/");

      const newUploadFile: UploadProgressFile = {
        id: uploadId,
        name: file.name,
        progress: 0,
        status: "uploading",
        type: isVideo ? "video" : "image"
      };

      setUploadProgressFiles(prev => [...prev, newUploadFile]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        let progressVal = 0;
        const interval = setInterval(() => {
          progressVal = Math.min(progressVal + 15, 90);
          setUploadProgressFiles(prev => prev.map(f => {
            if (f.id === uploadId && f.status === "uploading") {
              return { ...f, progress: progressVal };
            }
            return f;
          }));
        }, 150);

        const data = await apiFetch<{ url: string }>("/social/media/upload", {
          method: "POST",
          headers: {
            "Content-Type": "SKIP",
          },
          body: formData,
        });

        clearInterval(interval);

        setComposerMediaUrls(prev => [...prev, data.url]);
        if (isVideo) {
          setComposerMediaType("video");
        }

        setUploadProgressFiles(prev => prev.map(f => {
          if (f.id === uploadId) {
            return { ...f, progress: 100, status: "done", url: data.url };
          }
          return f;
        }));

        toast({ title: "Media Attached", description: "File successfully added to post draft" });
      } catch (err: any) {
        setUploadProgressFiles(prev => prev.filter(f => f.id !== uploadId));
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      }
    }
    setIsUploading(false);
  };

  const getPlatformCaption = (platform: string) => {
    const isSynced = syncedPlatforms[platform] ?? true;
    if (isSynced) {
      return composerCaption;
    }
    return platformOverrides[platform] ?? "";
  };

  const setPlatformCaption = (platform: string, text: string) => {
    const isSynced = syncedPlatforms[platform] ?? true;
    if (isSynced) {
      setComposerCaption(text);
    } else {
      setPlatformOverrides(prev => ({ ...prev, [platform]: text }));
    }
  };

  const togglePlatformSync = (platform: string) => {
    setSyncedPlatforms(prev => {
      const isSynced = prev[platform] ?? true;
      const nextSynced = !isSynced;
      if (!nextSynced) {
        setPlatformOverrides(o => ({ ...o, [platform]: composerCaption }));
      }
      return { ...prev, [platform]: nextSynced };
    });
  };

  const resetComposer = () => {
    setComposerCaption("");
    setComposerMediaUrls([]);
    setComposerMediaType("image");
    setComposerAccounts([]);
    setComposerScheduledFor("");
    setPublishNow(true);
    setShowOverrides(false);
    setPlatformOverrides({});
    setUploadProgressFiles([]);
    setSelectedPlatforms([]);
    setActivePlatform("");
    setSyncedPlatforms({
      x: true, facebook: true, instagram: true, linkedin: true, tiktok: true, youtube: true, threads: true
    });
    setInstagramType("post");
    setInstagramMusic(false);
    setInstagramTagProducts(false);
    setInstagramFirstComment("");
    setInstagramAiGenerated(false);
    setFacebookType("post");
    setFacebookFirstComment("");
    setFacebookAiGenerated(false);
    setTiktokTitle("");
    setLinkedinFirstComment("");
    setPinterestTitle("");
    setPinterestLink("");
    setYoutubeTitle("");
    setThreadsTopic("");
    setThreadsLocation("");
    setPostTags([]);
    setEditingPostId(null);
    setAlreadyPublishedAccountIds([]);
    setIsEmojiOpen(false);
    setExpandedComposerPlatform(null);
    setIsSubmitting(false);
    setSubmitType(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting) return;
    setIsComposerOpen(open);
    if (!open) {
      resetComposer();
    }
  };

  const getPlatformIcon = (platform?: string, className = "h-4 w-4 rounded-sm object-contain") => {
    if (!platform) return <HelpCircle className={`${className} text-muted-foreground`} />;
    switch (platform.toLowerCase()) {
      case "facebook": return <img src="/social-icons/Facebook.png" className={className} alt="Facebook" />;
      case "instagram": return <img src="/social-icons/instagram.png" className={className} alt="Instagram" />;
      case "threads": return <img src="/social-icons/Threads.png" className={className} alt="Threads" />;
      case "tiktok": return <img src="/social-icons/tiktok.png" className={className} alt="TikTok" />;
      case "linkedin": return <img src="/social-icons/linkedin.png" className={className} alt="LinkedIn" />;
      case "youtube": return <img src="/social-icons/youtube.png" className={className} alt="YouTube" />;
      case "x":
      case "twitter": return <img src="/social-icons/twitter.png" className={className} alt="Twitter" />;
      case "pinterest": return <img src="/social-icons/Pinterest.png" className={className} alt="Pinterest" />;
      default: return <HelpCircle className={`${className} text-muted-foreground`} />;
    }
  };

  const handleCreateCampaign = async () => {
    if (!composerClient) return;
    if (!newCampaignName.trim()) {
      toast({
        title: "Validation Error",
        description: "Campaign name cannot be empty",
        variant: "destructive"
      });
      return;
    }
    setIsSavingCampaign(true);
    try {
      const data = await apiFetch<SocialCampaign>("/social/campaigns", {
        method: "POST",
        body: JSON.stringify({
          clientId: composerClient,
          name: newCampaignName.trim()
        })
      });
      toast({
        title: "Campaign Created",
        description: `Campaign "${data.name}" has been created successfully.`
      });
      setCampaigns(prev => [data, ...prev]);
      setComposerCampaign(data.id);
      setNewCampaignName("");
      setIsCampaignDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const handleCreatePost = async (asDraft = false) => {
    if (!composerClient) {
      toast({
        title: "Validation Error",
        description: "Choose a client first",
        variant: "destructive",
      });
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitType(asDraft ? "draft" : "publish");
    try {
      const payload = {
        clientId: composerClient,
        campaignId: composerCampaign || null,
        caption: composerCaption,
        platformContent: {
          instagram: {
            caption: getPlatformCaption("instagram"),
            type: instagramType,
            music: instagramMusic,
            tagProducts: instagramTagProducts,
            stickerMode: instagramStickerMode,
            firstComment: instagramFirstComment,
            aiGenerated: instagramAiGenerated
          },
          facebook: {
            caption: getPlatformCaption("facebook"),
            type: facebookType,
            music: facebookMusic,
            tagProducts: facebookTagProducts,
            stickerMode: facebookStickerMode,
            firstComment: facebookFirstComment,
            aiGenerated: facebookAiGenerated
          },
          tiktok: {
            caption: getPlatformCaption("tiktok"),
            title: tiktokTitle,
            automatic: tiktokAutomatic
          },
          linkedin: {
            caption: getPlatformCaption("linkedin"),
            firstComment: linkedinFirstComment
          },
          pinterest: {
            caption: getPlatformCaption("pinterest"),
            title: pinterestTitle,
            link: pinterestLink
          },
          youtube: {
            caption: getPlatformCaption("youtube"),
            title: youtubeTitle,
            type: youtubeType
          },
          x: {
            caption: getPlatformCaption("x")
          },
          threads: {
            caption: getPlatformCaption("threads")
          },
          tags: postTags,
          syncedPlatforms,
          comments: editingPostId ? (posts.find(p => p.id === editingPostId)?.platformContent?.comments || []) : [],
          activities: editingPostId ? (posts.find(p => p.id === editingPostId)?.platformContent?.activities || []) : [
            {
              id: Math.random().toString(36).substring(7),
              type: "system",
              message: "Draft post created in Publisher",
              createdAt: new Date().toISOString()
            }
          ]
        },
        mediaUrls: composerMediaUrls,
        mediaType: composerMediaType,
        accountIds: composerAccounts,
        scheduledFor: (publishNow || asDraft) ? null : composerScheduledFor,
        status: asDraft ? "DRAFT" : (publishNow ? "PUBLISHED" : "SCHEDULED"),
      };

      if (publishNow && !asDraft) {
        if (editingPostId) {
          await apiFetch<any>(`/social/posts/${editingPostId}`, {
            method: "PUT",
            body: JSON.stringify({ ...payload, status: "DRAFT" }),
          });
          await apiFetch<any>(`/social/posts/${editingPostId}/publish-now`, { method: "POST" });
        } else {
          const post = await apiFetch<SocialPost>("/social/posts", {
            method: "POST",
            body: JSON.stringify({ ...payload, status: "DRAFT" }),
          });
          await apiFetch<any>(`/social/posts/${post.id}/publish-now`, { method: "POST" });
        }
        toast({ title: "Post Published", description: "Your post has been distributed to selected accounts" });
      } else {
        if (editingPostId) {
          await apiFetch<any>(`/social/posts/${editingPostId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          await apiFetch<any>("/social/posts", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        toast({ title: asDraft ? "Draft Saved" : "Post Scheduled", description: asDraft ? "Your post has been saved as draft" : "Your post has been added to content queue" });
      }

      setIsComposerOpen(false);
      resetComposer();
      fetchData();
    } catch (err: any) {
      toast({
        title: "Error creating post",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setSubmitType(null);
    }
  };

  const handleRetryPost = async (postId: string) => {
    try {
      await apiFetch<any>(`/social/posts/${postId}/retry`, { method: "POST" });
      toast({ title: "Retry Triggered", description: "Retrying publishing to failed platforms" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Retry Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (confirm("Are you sure you want to permanently delete this post?")) {
      try {
        await apiFetch<any>(`/social/posts/${postId}`, { method: "DELETE" });
        toast({ title: "Post Deleted", description: "Scheduled post was successfully removed" });
        if (activePostId === postId) setActivePostId(null);
        fetchData();
      } catch (err: any) {
        toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleEditPost = (post: SocialPost) => {
    setEditingPostId(post.id);
    setComposerClient(post.clientId);
    setComposerCampaign(post.campaignId || "");
    setComposerCaption(post.caption || "");
    setComposerMediaUrls(post.mediaUrls || []);
    setComposerMediaType(post.mediaType || "image");

    const toLocalISOString = (dateString: string | Date) => {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().slice(0, 16);
    };

    setComposerScheduledFor(post.scheduledFor ? toLocalISOString(post.scheduledFor) : "");
    setPublishNow(!post.scheduledFor);

    const pc = (post.platformContent || {}) as any;
    const overrides: Record<string, string> = {};
    for (const plat of ["x", "facebook", "instagram", "linkedin", "tiktok", "youtube", "threads"]) {
      if (pc[plat] && pc[plat].caption !== undefined) {
        overrides[plat] = pc[plat].caption;
      }
    }
    setPlatformOverrides(overrides);
    if (pc.syncedPlatforms) {
      setSyncedPlatforms(pc.syncedPlatforms);
    } else {
      setSyncedPlatforms({
        x: true, facebook: true, instagram: true, linkedin: true, tiktok: true, youtube: true, threads: true
      });
    }

    if (pc.instagram) {
      setInstagramType(pc.instagram.type || "post");
      setInstagramMusic(pc.instagram.music || false);
      setInstagramTagProducts(pc.instagram.tagProducts || false);
      setInstagramFirstComment(pc.instagram.firstComment || "");
      setInstagramAiGenerated(pc.instagram.aiGenerated || false);
    }
    if (pc.facebook) {
      setFacebookType(pc.facebook.type || "post");
      setFacebookFirstComment(pc.facebook.firstComment || "");
      setFacebookAiGenerated(pc.facebook.aiGenerated || false);
    }
    if (pc.tiktok) {
      setTiktokTitle(pc.tiktok.title || "");
      setTiktokAutomatic(pc.tiktok.automatic || "automatic");
    }
    if (pc.linkedin) {
      setLinkedinFirstComment(pc.linkedin.firstComment || "");
    }
    if (pc.youtube) {
      setYoutubeTitle(pc.youtube.title || "");
      setYoutubeType(pc.youtube.type || "short");
    }
    if (pc.threads) {
      setThreadsTopic(pc.threads.topic || "");
      setThreadsLocation(pc.threads.location || "");
    }
    if (pc.tags) {
      setPostTags(pc.tags || []);
    }

    const accIds = (post.destinations || []).map(d => d.socialAccountId).filter(Boolean);
    setComposerAccounts(accIds);

    const publishedIds = (post.destinations || [])
      .filter(d => d.status === "PUBLISHED")
      .map(d => d.socialAccountId)
      .filter(Boolean);
    setAlreadyPublishedAccountIds(publishedIds);

    const validPlatforms = ["x", "facebook", "instagram", "linkedin", "tiktok", "youtube", "threads"];
    const platList = Array.from(
      new Set(
        post.destinations.map(d => d.platform.toLowerCase()).filter(p => validPlatforms.includes(p))
      )
    );
    setSelectedPlatforms(platList);
    if (platList.length > 0) {
      setActivePlatform(platList[0]);
    }
    if (accIds.length > 0) {
      setActivePreviewAccount(accIds[0]);
    }
    setIsComposerOpen(true);
  };

  const handleDuplicatePost = async (post: SocialPost) => {
    try {
      const payload = {
        clientId: post.clientId,
        campaignId: post.campaignId,
        caption: post.caption,
        platformContent: {
          ...(post.platformContent || {}),
          comments: [],
          activities: [
            {
              id: Math.random().toString(36).substring(7),
              type: "system",
              message: `Duplicate post created from ${post.id.substring(0, 8)}`,
              createdAt: new Date().toISOString()
            }
          ]
        },
        mediaUrls: getMediaUrls(post),
        mediaType: post.mediaType,
        accountIds: post.destinations.map(d => d.socialAccountId),
        scheduledFor: post.scheduledFor,
        status: "DRAFT"
      };

      await apiFetch("/social/posts", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast({ title: "Post Duplicated", description: "Created new Draft clone of this post" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Duplication Failed", description: err.message, variant: "destructive" });
    }
  };

  // Rescheduling handler for calendar / panel
  const handleReschedulePost = async (postId: string, date: Date) => {
    const originalPosts = [...posts];
    const postToUpdate = posts.find(p => p.id === postId);
    if (!postToUpdate) return;

    let targetDate = new Date(date);
    if (postToUpdate.scheduledFor) {
      const orig = new Date(postToUpdate.scheduledFor);
      targetDate.setHours(orig.getHours());
      targetDate.setMinutes(orig.getMinutes());
      targetDate.setSeconds(0);
    } else {
      targetDate.setHours(10);
      targetDate.setMinutes(0);
      targetDate.setSeconds(0);
    }

    // Optimistic Update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          scheduledFor: targetDate.toISOString(),
          status: p.status === "DRAFT" ? "SCHEDULED" : p.status
        };
      }
      return p;
    }));

    try {
      const payload = {
        clientId: postToUpdate.clientId,
        campaignId: postToUpdate.campaignId,
        caption: postToUpdate.caption,
        platformContent: {
          ...(postToUpdate.platformContent || {}),
          activities: [
            ...(postToUpdate.platformContent?.activities || []),
            {
              id: Math.random().toString(36).substring(7),
              type: "system",
              message: `Post rescheduled to ${targetDate.toLocaleString()}`,
              createdAt: new Date().toISOString()
            }
          ]
        },
        mediaUrls: getMediaUrls(postToUpdate),
        mediaType: postToUpdate.mediaType,
        accountIds: postToUpdate.destinations.map(d => d.socialAccountId),
        status: postToUpdate.status === "DRAFT" ? "SCHEDULED" : postToUpdate.status,
        scheduledFor: targetDate.toISOString()
      };

      await apiFetch(`/social/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      toast({ title: "Post Rescheduled", description: `Schedule updated to ${targetDate.toLocaleString()}` });
      fetchData();
    } catch (err: any) {
      setPosts(originalPosts);
      toast({ title: "Reschedule Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleReschedulePostWithTime = async (postId: string, date: Date, timeStr: string) => {
    const postToUpdate = posts.find(p => p.id === postId);
    if (!postToUpdate) return;

    const [hours, minutes] = timeStr.split(":").map(Number);
    const targetDate = new Date(date);
    targetDate.setHours(hours || 0);
    targetDate.setMinutes(minutes || 0);
    targetDate.setSeconds(0);

    const originalPosts = [...posts];
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          scheduledFor: targetDate.toISOString(),
          status: p.status === "DRAFT" ? "SCHEDULED" : p.status
        };
      }
      return p;
    }));

    try {
      const payload = {
        clientId: postToUpdate.clientId,
        campaignId: postToUpdate.campaignId,
        caption: postToUpdate.caption,
        platformContent: {
          ...(postToUpdate.platformContent || {}),
          activities: [
            ...(postToUpdate.platformContent?.activities || []),
            {
              id: Math.random().toString(36).substring(7),
              type: "system",
              message: `Post rescheduled to ${targetDate.toLocaleString()}`,
              createdAt: new Date().toISOString()
            }
          ]
        },
        mediaUrls: getMediaUrls(postToUpdate),
        mediaType: postToUpdate.mediaType,
        accountIds: postToUpdate.destinations.map(d => d.socialAccountId),
        status: postToUpdate.status === "DRAFT" ? "SCHEDULED" : postToUpdate.status,
        scheduledFor: targetDate.toISOString()
      };

      await apiFetch(`/social/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      toast({ title: "Post Rescheduled", description: `Scheduled for ${targetDate.toLocaleString()}` });
      fetchData();
    } catch (err: any) {
      setPosts(originalPosts);
      toast({ title: "Reschedule Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleMovePostToUnscheduled = async (postId: string) => {
    const postToUpdate = posts.find(p => p.id === postId);
    if (!postToUpdate) return;

    const originalPosts = [...posts];
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          scheduledFor: null,
          status: "DRAFT"
        };
      }
      return p;
    }));

    try {
      const payload = {
        clientId: postToUpdate.clientId,
        campaignId: postToUpdate.campaignId,
        caption: postToUpdate.caption,
        platformContent: {
          ...(postToUpdate.platformContent || {}),
          activities: [
            ...(postToUpdate.platformContent?.activities || []),
            {
              id: Math.random().toString(36).substring(7),
              type: "system",
              message: "Post moved to unscheduled drafts pool",
              createdAt: new Date().toISOString()
            }
          ]
        },
        mediaUrls: getMediaUrls(postToUpdate),
        mediaType: postToUpdate.mediaType,
        accountIds: postToUpdate.destinations.map(d => d.socialAccountId),
        status: "DRAFT",
        scheduledFor: null
      };

      await apiFetch(`/social/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      toast({ title: "Post Unschedulded", description: "Moved post back to Draft sidebar" });
      fetchData();
    } catch (err: any) {
      setPosts(originalPosts);
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim()) return;
    const postToUpdate = posts.find(p => p.id === postId);
    if (!postToUpdate) return;

    const newComment = {
      id: Math.random().toString(36).substring(7),
      author: user?.name || user?.email || "Agency Admin",
      text,
      createdAt: new Date().toISOString()
    };

    const currentPc = postToUpdate.platformContent || {};
    const commentsList = Array.isArray(currentPc.comments) ? currentPc.comments : [];
    const activitiesList = Array.isArray(currentPc.activities) ? currentPc.activities : [];

    const updatedPc = {
      ...currentPc,
      comments: [...commentsList, newComment],
      activities: [
        ...activitiesList,
        {
          id: Math.random().toString(36).substring(7),
          type: "comment",
          message: `Comment added by ${user?.name || user?.email}`,
          createdAt: new Date().toISOString()
        }
      ]
    };

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, platformContent: updatedPc };
      }
      return p;
    }));
    setCommentText("");

    try {
      const payload = {
        clientId: postToUpdate.clientId,
        campaignId: postToUpdate.campaignId,
        caption: postToUpdate.caption,
        platformContent: updatedPc,
        mediaUrls: getMediaUrls(postToUpdate),
        mediaType: postToUpdate.mediaType,
        accountIds: postToUpdate.destinations.map(d => d.socialAccountId),
        status: postToUpdate.status,
        scheduledFor: postToUpdate.scheduledFor
      };
      await apiFetch(`/social/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      fetchData();
    } catch (err: any) {
      toast({ title: "Comment failed", description: err.message, variant: "destructive" });
      fetchData();
    }
  };

  // Bulk Selection Operations
  const handleToggleSelect = (postId: string) => {
    setSelectedPostIds(prev =>
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedPostIds.length} selected posts?`)) {
      try {
        await Promise.all(selectedPostIds.map(id => apiFetch(`/social/posts/${id}`, { method: "DELETE" })));
        toast({ title: "Posts Deleted", description: `Successfully deleted ${selectedPostIds.length} posts` });
        setSelectedPostIds([]);
        fetchData();
      } catch (err: any) {
        toast({ title: "Bulk Delete Failed", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleBulkDuplicate = async () => {
    try {
      await Promise.all(selectedPostIds.map(async (id) => {
        const p = posts.find(post => post.id === id);
        if (p) {
          const payload = {
            clientId: p.clientId,
            campaignId: p.campaignId,
            caption: p.caption,
            platformContent: { ...(p.platformContent || {}), comments: [], activities: [] },
            mediaUrls: getMediaUrls(p),
            mediaType: p.mediaType,
            accountIds: p.destinations.map(d => d.socialAccountId),
            status: "DRAFT",
            scheduledFor: p.scheduledFor
          };
          await apiFetch("/social/posts", { method: "POST", body: JSON.stringify(payload) });
        }
      }));
      toast({ title: "Bulk Duplicated", description: `Cloned ${selectedPostIds.length} posts as Drafts` });
      setSelectedPostIds([]);
      fetchData();
    } catch (err: any) {
      toast({ title: "Duplication Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    try {
      await Promise.all(selectedPostIds.map(async (id) => {
        const p = posts.find(post => post.id === id);
        if (p) {
          const payload = {
            clientId: p.clientId,
            campaignId: p.campaignId,
            caption: p.caption,
            platformContent: {
              ...(p.platformContent || {}),
              activities: [
                ...(p.platformContent?.activities || []),
                {
                  id: Math.random().toString(36).substring(7),
                  type: "system",
                  message: `Bulk status update to ${newStatus}`,
                  createdAt: new Date().toISOString()
                }
              ]
            },
            mediaUrls: getMediaUrls(p),
            mediaType: p.mediaType,
            accountIds: p.destinations.map(d => d.socialAccountId),
            status: newStatus,
            scheduledFor: p.scheduledFor
          };
          await apiFetch(`/social/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        }
      }));
      toast({ title: "Status Updated", description: `Updated status of ${selectedPostIds.length} posts` });
      setSelectedPostIds([]);
      fetchData();
    } catch (err: any) {
      toast({ title: "Status Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkMoveSchedule = async (days: number) => {
    try {
      await Promise.all(selectedPostIds.map(async (id) => {
        const p = posts.find(post => post.id === id);
        if (p && p.scheduledFor) {
          const date = new Date(p.scheduledFor);
          date.setDate(date.getDate() + days);
          const payload = {
            clientId: p.clientId,
            campaignId: p.campaignId,
            caption: p.caption,
            platformContent: {
              ...(p.platformContent || {}),
              activities: [
                ...(p.platformContent?.activities || []),
                {
                  id: Math.random().toString(36).substring(7),
                  type: "system",
                  message: `Bulk shifted schedule by ${days} days`,
                  createdAt: new Date().toISOString()
                }
              ]
            },
            mediaUrls: getMediaUrls(p),
            mediaType: p.mediaType,
            accountIds: p.destinations.map(d => d.socialAccountId),
            status: p.status,
            scheduledFor: date.toISOString()
          };
          await apiFetch(`/social/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        }
      }));
      toast({ title: "Schedule Shifted", description: `Moved ${selectedPostIds.length} posts by ${days} days` });
      setSelectedPostIds([]);
      fetchData();
    } catch (err: any) {
      toast({ title: "Shift Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkAssignWriter = async (writer: string) => {
    try {
      await Promise.all(selectedPostIds.map(async (id) => {
        const p = posts.find(post => post.id === id);
        if (p) {
          const payload = {
            clientId: p.clientId,
            campaignId: p.campaignId,
            caption: p.caption,
            platformContent: {
              ...(p.platformContent || {}),
              assignedWriter: writer,
              activities: [
                ...(p.platformContent?.activities || []),
                {
                  id: Math.random().toString(36).substring(7),
                  type: "system",
                  message: `Assigned writer: ${writer}`,
                  createdAt: new Date().toISOString()
                }
              ]
            },
            mediaUrls: getMediaUrls(p),
            mediaType: p.mediaType,
            accountIds: p.destinations.map(d => d.socialAccountId),
            status: p.status,
            scheduledFor: p.scheduledFor
          };
          await apiFetch(`/social/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        }
      }));
      toast({ title: "Writer Assigned", description: `Assigned ${writer} to ${selectedPostIds.length} posts` });
      setSelectedPostIds([]);
      fetchData();
    } catch (err: any) {
      toast({ title: "Assign Writer Failed", description: err.message, variant: "destructive" });
    }
  };

  const generateAiCaption = async () => {
    if (!aiPrompt) return;
    setIsGeneratingAi(true);
    try {
      const data = await apiFetch<{ caption: string }>("/social/ai/caption", {
        method: "POST",
        body: JSON.stringify({ prompt: aiPrompt, platform: aiTargetPlatform }),
      });
      setComposerCaption(data.caption);
      setIsAiOpen(false);
      setAiPrompt("");
      toast({ title: "AI Copywriter", description: "Caption generated successfully" });
    } catch (err: any) {
      toast({ title: "AI Writer Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const togglePlatformSelection = (platformName: string) => {
    const plat = platformName.toLowerCase();
    const isSelected = selectedPlatforms.includes(plat);

    if (isSelected) {
      setSelectedPlatforms(prev => prev.filter(p => p !== plat));
      const accountsOfPlat = accounts.filter(acc => acc.platform.toLowerCase() === plat).map(acc => acc.id);
      setComposerAccounts(prev => prev.filter(id => !accountsOfPlat.includes(id)));
      if (activePlatform === plat) {
        const remaining = selectedPlatforms.filter(p => p !== plat);
        setActivePlatform(remaining.length > 0 ? remaining[0] : "");
      }
    } else {
      setSelectedPlatforms(prev => [...prev, plat]);
      const accountsOfPlat = accounts.filter(acc => acc.platform.toLowerCase() === plat).map(acc => acc.id);
      if (accountsOfPlat.length > 0) {
        setComposerAccounts(prev => [...prev, ...accountsOfPlat]);
      }
      setActivePlatform(plat);
    }
  };

  const activeClientName = clients.find(c => c.id === composerClient)?.company || "Acme Agency";
  const activeClientInitials = activeClientName ? activeClientName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() : "AC";

  // Determine if mockup section should be visible
  const hasUploadedMedia = composerMediaUrls.length > 0 || uploadProgressFiles.some(f => f.status === "uploading");

  // Get current active preview account platform and caption details
  const previewAccountObj = accounts.find(a => a.id === activePreviewAccount);
  const getPreviewCaption = () => {
    if (!previewAccountObj || !previewAccountObj.platform) return composerCaption || "What's on your mind?";
    const override = platformOverrides[previewAccountObj.platform.toLowerCase()];
    return override || composerCaption || "What's on your mind?";
  };

  const getCharLimit = () => {
    if (!previewAccountObj || !previewAccountObj.platform) return { limit: 3000, label: "" };
    switch (previewAccountObj.platform.toLowerCase()) {
      case "x":
      case "twitter":
        return { limit: 280, label: "X" };
      case "pinterest":
        return { limit: 500, label: "Pinterest" };
      case "tiktok":
        return { limit: 2200, label: "TikTok" };
      case "instagram":
        return { limit: 2200, label: "Instagram" };
      default:
        return { limit: 3000, label: previewAccountObj.displayName };
    }
  };

  const getCharLimitForPlatform = (platformName: string) => {
    if (!platformName) return 3000;
    switch (platformName.toLowerCase()) {
      case "x":
      case "twitter":
        return 280;
      case "pinterest":
        return 500;
      case "tiktok":
      case "instagram":
        return 2200;
      case "facebook":
        return 63206;
      case "threads":
        return 500;
      default:
        return 3000;
    }
  };

  const charInfo = getCharLimit();

  // Helper to securely parse JSON media urls safely
  const getMediaUrls = (post: SocialPost): string[] => {
    if (!post.mediaUrls) return [];
    if (Array.isArray(post.mediaUrls)) {
      return post.mediaUrls.filter(item => typeof item === "string");
    }
    if (typeof post.mediaUrls === "string") {
      try {
        const parsed = JSON.parse(post.mediaUrls);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === "string");
        }
      } catch (e) { }
      return [post.mediaUrls];
    }
    return [];
  };

  const getContentTypeLabel = (post: SocialPost) => {
    const mediaUrls = getMediaUrls(post);
    if (post.mediaType === "video") {
      const pc = post.platformContent as any;
      if (pc?.instagram?.type === "reel") return "Reel";
      return "Video";
    }
    if (mediaUrls.length > 1) return "Carousel";
    return "Image";
  };

  const getClientDetails = (clientId: string) => {
    return clients.find(c => c.id === clientId) || { name: "Unknown Client", company: "Unassigned Client" };
  };

  const getCampaignName = (campaignId?: string | null) => {
    if (!campaignId) return "";
    return campaigns.find(c => c.id === campaignId)?.name || "";
  };

  const getWriterName = (post: SocialPost) => {
    const writerId = post.platformContent?.assignedWriter;
    if (!writerId) return "";
    return teamMembers.find(t => t.id === writerId || t.name === writerId)?.name || writerId;
  };

  // Filter posts instantly in memory (Sub-millisecond)
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // 1. Search Query
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(post => {
        const captionMatch = post.caption?.toLowerCase().includes(q);
        const cDetails = getClientDetails(post.clientId);
        const clientMatch = cDetails.company?.toLowerCase().includes(q) || cDetails.name?.toLowerCase().includes(q);
        const campaignMatch = getCampaignName(post.campaignId).toLowerCase().includes(q);
        return captionMatch || clientMatch || campaignMatch;
      });
    }

    // 2. Client Filter
    if (clientFilter !== "ALL") {
      result = result.filter(post => post.clientId === clientFilter);
    }

    // 3. Platform Filter
    if (platformFilter !== "ALL") {
      result = result.filter(post =>
        (post.destinations || []).some(d => d.platform?.toLowerCase() === platformFilter.toLowerCase())
      );
    }

    // 4. Status Filter
    if (statusFilter !== "ALL") {
      result = result.filter(post => post.status === statusFilter);
    }

    // 5. Campaign Filter
    if (campaignFilter !== "ALL") {
      result = result.filter(post => post.campaignId === campaignFilter);
    }

    // 6. Content Type Filter
    if (contentTypeFilter !== "ALL") {
      result = result.filter(post => getContentTypeLabel(post).toLowerCase() === contentTypeFilter.toLowerCase());
    }

    // 7. Writer Filter
    if (writerFilter !== "ALL") {
      result = result.filter(post => post.platformContent?.assignedWriter === writerFilter);
    }

    // 8. Date Range Filter
    if (dateFilter !== "ALL") {
      const now = new Date();
      result = result.filter(post => {
        const dateStr = post.scheduledFor || post.publishedAt || post.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;

        if (dateFilter === "today") {
          return d.toDateString() === now.toDateString();
        } else if (dateFilter === "week") {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          return d >= oneWeekAgo && d <= now;
        } else if (dateFilter === "month") {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // 9. Sorting
    result.sort((a, b) => {
      if (sortBy === "scheduled_desc") {
        const da = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
        const db = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
        return db - da;
      } else if (sortBy === "scheduled_asc") {
        const da = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Infinity;
        const db = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Infinity;
        return da - db;
      } else if (sortBy === "created_desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === "created_asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });

    return result;
  }, [posts, debouncedSearch, clientFilter, platformFilter, statusFilter, campaignFilter, contentTypeFilter, writerFilter, dateFilter, sortBy, campaigns]);

  // Unscheduled drafts list (drafts with no date)
  const unscheduledDrafts = useMemo(() => {
    return posts.filter(p => !p.scheduledFor && p.status === "DRAFT");
  }, [posts]);

  // Calendar cells generation
  const calendarCells = useMemo(() => {
    return buildCalendarGrid(calendarDate.getMonth(), calendarDate.getFullYear());
  }, [calendarDate]);

  const activePost = useMemo(() => {
    return posts.find(p => p.id === activePostId) || null;
  }, [posts, activePostId]);

  // Initialize reschedule inputs when panel post changes
  useEffect(() => {
    if (activePost) {
      if (activePost.scheduledFor) {
        const dateObj = new Date(activePost.scheduledFor);
        setRescheduleDate(dateObj.toISOString().split("T")[0]);
        setRescheduleTime(dateObj.toTimeString().slice(0, 5));
      } else {
        setRescheduleDate("");
        setRescheduleTime("");
      }
    }
  }, [activePost]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setClientFilter("ALL");
    setPlatformFilter("ALL");
    setStatusFilter("ALL");
    setCampaignFilter("ALL");
    setContentTypeFilter("ALL");
    setWriterFilter("ALL");
    setDateFilter("ALL");
    setSortBy("scheduled_desc");
  };


  return (
    <div className="flex flex-col min-h-screen text-left gap-0">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/40 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Publisher</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agency-grade content management across clients, campaigns &amp; platforms.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUnscheduledOpen(!isUnscheduledOpen)}
            className={`rounded-xl flex items-center gap-2 text-sm font-semibold transition-all h-9 px-4 ${isUnscheduledOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-4 w-4" />
            Drafts ({unscheduledDrafts.length})
          </Button>
          <Button
            onClick={() => { resetComposer(); setIsComposerOpen(true); }}
            className="rounded-xl flex items-center gap-2 h-9 px-5 font-semibold text-sm shadow-md"
          >
            <Plus className="h-4 w-4" />
            Create Post
          </Button>
        </div>
      </div>

      {/* ── TABS + VIEW TOGGLE ── */}
      <div className="flex justify-between items-center border-b border-border/60 pb-0 shrink-0 mb-3">
        <div className="flex">
          <button
            onClick={() => setActiveTab("posts")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 ${activeTab === "posts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <Grid className="h-4 w-4" />
            Posts
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === "posts" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {filteredPosts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 ${activeTab === "calendar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <Calendar className="h-4 w-4" />
            Calendar
          </button>
        </div>
        <div className="flex items-center gap-2 pb-2">
          {activeTab === "posts" ? (
            <div className="flex border border-border rounded-lg p-0.5 bg-muted/30">
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Grid View">
                <Grid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} title="List View">
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex border border-border rounded-lg p-0.5 bg-muted/30 text-xs font-semibold">
              {(["month", "week", "agenda"] as const).map(v => (
                <button key={v} onClick={() => setCalendarView(v)} className={`px-3 py-1.5 rounded-md capitalize transition-all ${calendarView === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SHARED FILTER TOOLBAR ── */}
      <div className="bg-card border border-border/60 rounded-xl p-3 shadow-sm mb-4 shrink-0">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative min-w-[180px] flex-1 max-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs rounded-lg border-border/50 bg-muted/20"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[100px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[100px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Platforms</SelectItem>
              {["instagram", "facebook", "linkedin", "tiktok", "youtube", "threads", "x"].map(p => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[100px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {["DRAFT", "AWAITING_APPROVAL", "SCHEDULED", "PUBLISHED", "FAILED"].map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[100px]">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Campaigns</SelectItem>
              {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[100px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {["image", "video", "reel", "story", "carousel"].map(t => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[100px]">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/50 bg-muted/20 w-auto min-w-[110px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled_desc">Newest Scheduled</SelectItem>
              <SelectItem value="scheduled_asc">Oldest Scheduled</SelectItem>
              <SelectItem value="created_desc">Recently Created</SelectItem>
              <SelectItem value="created_asc">Oldest Created</SelectItem>
            </SelectContent>
          </Select>
          {writerFilter !== "ALL" || clientFilter !== "ALL" || platformFilter !== "ALL" || statusFilter !== "ALL" || campaignFilter !== "ALL" || contentTypeFilter !== "ALL" || dateFilter !== "ALL" || searchQuery ? (
            <Button variant="ghost" size="sm" onClick={resetAllFilters} className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 ml-auto">
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── WORKSPACE (Sidebar | Content | Detail Panel) ── */}
      <div className="flex flex-1 gap-4 min-h-0 relative items-start">

        {/* LEFT: Unscheduled Drafts Sidebar */}
        {isUnscheduledOpen && (
          <div className="w-60 shrink-0 bg-card border border-border/70 rounded-xl p-3 flex flex-col gap-3 animate-in slide-in-from-left duration-200 sticky top-20 max-h-[calc(100vh-200px)] overflow-hidden select-none">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Unscheduled ({unscheduledDrafts.length})
              </h3>
              <button onClick={() => setIsUnscheduledOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 hover:bg-muted rounded">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {unscheduledDrafts.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60 italic text-center py-8">No unscheduled drafts.<br />Drag posts here to unschedule.</p>
              ) : (
                unscheduledDrafts.map(post => {
                  const mUrls = getMediaUrls(post);
                  const client = getClientDetails(post.clientId);
                  return (
                    <div
                      key={post.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("postId", post.id); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => setActivePostId(post.id)}
                      className={`p-2.5 bg-muted/20 border border-border/60 rounded-lg cursor-grab hover:shadow-sm hover:border-primary/30 active:cursor-grabbing transition-all ${activePostId === post.id ? "ring-1 ring-primary/50 border-primary/50 bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {mUrls.length > 0 ? (
                          <img src={mUrls[0]} className="w-9 h-9 object-cover rounded-md shrink-0" alt="" loading="lazy" />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate leading-tight">{client.company || client.name}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">{post.caption || "No caption"}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex gap-0.5">
                        {post.destinations.map(d => <span key={d.id}>{getPlatformIcon(d.platform, "h-3 w-3 opacity-60")}</span>)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* CENTER: Main Content */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <CardGridSkeleton />
          ) : (
            <>
              {/* ── POSTS LIST ── */}
              {activeTab === "posts" && (
                <>
                  {filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl py-24 px-6 text-center bg-card/40">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 shadow-sm">
                        <ImageIcon className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground">No posts found</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">No posts match your current filters. Try resetting or create your first post.</p>
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={resetAllFilters} className="rounded-xl text-sm font-semibold h-9">Reset Filters</Button>
                        <Button onClick={() => { resetComposer(); setIsComposerOpen(true); }} className="rounded-xl flex items-center gap-2 text-sm font-semibold h-9">
                          <Plus className="h-4 w-4" />Create Post
                        </Button>
                      </div>
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredPosts.map(post => {
                        const mUrls = getMediaUrls(post);
                        const hasMedia = mUrls.length > 0;
                        const client = getClientDetails(post.clientId);
                        const cLabel = getContentTypeLabel(post);
                        const campaign = getCampaignName(post.campaignId);
                        const ss = getStatusStyle(post.status);
                        const isSelected = selectedPostIds.includes(post.id);
                        const isActive = activePostId === post.id;
                        const statusAccent =
                          post.status === "PUBLISHED" ? "#10b981" :
                            post.status === "SCHEDULED" ? "#f59e0b" :
                              post.status === "AWAITING_APPROVAL" ? "#0ea5e9" :
                                post.status === "FAILED" ? "#f43f5e" : "#94a3b8";
                        return (
                          <div
                            key={post.id}
                            draggable
                            onDragStart={e => e.dataTransfer.setData("postId", post.id)}
                            onClick={() => setActivePostId(post.id)}
                            style={{ borderLeftColor: statusAccent, borderLeftWidth: "3px" }}
                            className={`group relative flex flex-col border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none text-left ${isSelected ? "ring-2 ring-primary/40" : ""} ${isActive ? "ring-2 ring-primary/30 border-primary/40" : "border-border/60 hover:border-border"}`}
                          >
                            {/* Thumbnail */}
                            <div className="relative bg-muted overflow-hidden" style={{ aspectRatio: "16/9" }}>
                              {hasMedia ? (
                                post.mediaType === "video" ? (
                                  <video src={mUrls[0]} className="w-full h-full object-cover" preload="metadata" />
                                ) : (
                                  <img src={mUrls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                                )
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/60">
                                  <ImageIcon className="h-8 w-8 text-muted-foreground/25" />
                                </div>
                              )}
                              <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-[9px] font-bold text-white px-2 py-0.5 rounded uppercase tracking-wider">
                                {cLabel}
                              </span>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <Checkbox checked={isSelected} onCheckedChange={() => handleToggleSelect(post.id)} className="bg-white/90 shadow-sm rounded-md" />
                              </div>
                            </div>
                            {/* Body */}
                            <div className="p-3 flex-1 space-y-1.5">
                              <div className="flex items-start justify-between gap-1.5">
                                <h4 className="text-sm font-bold text-foreground truncate leading-tight">{client.company || client.name}</h4>
                                {campaign && (
                                  <span className="shrink-0 text-[9px] font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 px-1.5 py-0.5 rounded-full truncate max-w-[90px]" title={campaign}>
                                    {campaign}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[28px]">
                                {post.caption || <span className="italic opacity-40">No caption written</span>}
                              </p>
                              <div className="flex items-center justify-between pt-1.5 border-t border-border/25">
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                                  <Clock className="h-3 w-3 opacity-50 shrink-0" />
                                  {post.scheduledFor
                                    ? new Date(post.scheduledFor).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                                    : post.publishedAt
                                      ? new Date(post.publishedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                                      : "Unscheduled"}
                                </p>
                                <div className="flex gap-0.5 shrink-0">
                                  {post.destinations.map(d => (
                                    <TooltipProvider key={d.id}>
                                      <Tooltip delayDuration={200}>
                                        <TooltipTrigger asChild>
                                          <span className="hover:scale-110 transition-transform inline-flex">{getPlatformIcon(d.platform, "h-3.5 w-3.5")}</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs p-2 rounded-lg">
                                          <p className="font-semibold">{d.socialAccount?.displayName || d.platform}</p>
                                          <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{d.status}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {/* Footer */}
                            <div className="px-3 py-2 border-t border-border/25 bg-muted/5 flex items-center justify-between min-h-[38px]">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-full flex items-center gap-1 ${ss.text} ${ss.bg} ${ss.border}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                                {post.status.replace(/_/g, " ")}
                              </span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => handleEditPost(post)} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="Edit">
                                  <SquarePen className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDuplicatePost(post)} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="Duplicate">
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setActivePostId(post.id); setIsReschedulingOpen(true); }} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="Reschedule">
                                  <Calendar className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)} className="h-6 w-6 rounded-md text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/30" title="Delete">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* LIST VIEW */
                    <Card className="border border-border/60 rounded-xl overflow-hidden shadow-sm bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
                              <th className="p-3 w-9" />
                              <th className="p-3">Media</th>
                              <th className="p-3">Client · Campaign</th>
                              <th className="p-3">Platforms</th>
                              <th className="p-3 max-w-[200px]">Caption</th>
                              <th className="p-3 whitespace-nowrap">Schedule</th>
                              <th className="p-3">Writer</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPosts.map(post => {
                              const mUrls = getMediaUrls(post);
                              const client = getClientDetails(post.clientId);
                              const campaign = getCampaignName(post.campaignId);
                              const ss = getStatusStyle(post.status);
                              const isSelected = selectedPostIds.includes(post.id);
                              const isActive = activePostId === post.id;
                              const statusAccent = post.status === "PUBLISHED" ? "#10b981" : post.status === "SCHEDULED" ? "#f59e0b" : post.status === "AWAITING_APPROVAL" ? "#0ea5e9" : post.status === "FAILED" ? "#f43f5e" : "#94a3b8";
                              return (
                                <tr
                                  key={post.id}
                                  draggable
                                  onDragStart={e => e.dataTransfer.setData("postId", post.id)}
                                  onClick={() => setActivePostId(post.id)}
                                  style={{ borderLeft: `3px solid ${statusAccent}` }}
                                  className={`border-b border-border/30 hover:bg-muted/10 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : ""} ${isActive ? "bg-primary/5" : ""}`}
                                >
                                  <td className="p-3" onClick={e => e.stopPropagation()}>
                                    <Checkbox checked={isSelected} onCheckedChange={() => handleToggleSelect(post.id)} />
                                  </td>
                                  <td className="p-3">
                                    {mUrls.length > 0 ? (
                                      <img src={mUrls[0]} className="w-9 h-9 object-cover rounded-lg bg-muted" alt="" loading="lazy" />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase">{getContentTypeLabel(post).slice(0, 2)}</div>
                                    )}
                                  </td>
                                  <td className="p-3 min-w-[140px]">
                                    <div className="font-bold text-foreground">{client.company || client.name}</div>
                                    {campaign && <div className="text-[10px] text-violet-500 mt-0.5 font-medium">{campaign}</div>}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex gap-1 flex-wrap">
                                      {post.destinations.map(d => (
                                        <TooltipProvider key={d.id}>
                                          <Tooltip delayDuration={200}>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex">{getPlatformIcon(d.platform, "h-4 w-4")}</span>
                                            </TooltipTrigger>
                                            <TooltipContent className="text-xs p-2">
                                              <p className="font-semibold">{d.socialAccount?.displayName || d.platform}</p>
                                              <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{d.status}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-3 max-w-[200px]">
                                    <p className="truncate text-muted-foreground">{post.caption || <span className="italic opacity-40">No caption</span>}</p>
                                  </td>
                                  <td className="p-3 text-muted-foreground font-semibold whitespace-nowrap">
                                    {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "Draft"}
                                  </td>
                                  <td className="p-3 text-muted-foreground">{getWriterName(post) || "—"}</td>
                                  <td className="p-3">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-full flex items-center gap-1 w-fit ${ss.text} ${ss.bg} ${ss.border}`}>
                                      <span className={`h-1 w-1 rounded-full ${ss.dot}`} />
                                      {post.status.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => handleEditPost(post)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"><SquarePen className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDuplicatePost(post)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)} className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </>
              )}

              {/* ── CALENDAR VIEW ── */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-base text-foreground capitalize">
                        {calendarView === "month" && calendarDate.toLocaleString("default", { month: "long", year: "numeric" })}
                        {calendarView === "week" && `Week of ${getWeekDays(calendarDate)[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                        {calendarView === "agenda" && "Post Agenda"}
                      </h3>
                      <div className="flex border border-border/50 rounded-lg p-0.5 bg-muted/20">
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (calendarView === "month") setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
                          else if (calendarView === "week") { const d = new Date(calendarDate); d.setDate(d.getDate() - 7); setCalendarDate(d); }
                          else { const d = new Date(calendarDate); d.setDate(d.getDate() - 30); setCalendarDate(d); }
                        }} className="h-7 w-7 rounded-md">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setCalendarDate(new Date())} className="h-7 text-[11px] font-bold px-2 rounded-md">Today</Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (calendarView === "month") setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
                          else if (calendarView === "week") { const d = new Date(calendarDate); d.setDate(d.getDate() + 7); setCalendarDate(d); }
                          else { const d = new Date(calendarDate); d.setDate(d.getDate() + 30); setCalendarDate(d); }
                        }} className="h-7 w-7 rounded-md">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Status Legend */}
                    <div className="hidden md:flex items-center gap-2 text-[9px] font-bold text-muted-foreground">
                      {(["DRAFT", "AWAITING_APPROVAL", "SCHEDULED", "PUBLISHED"] as const).map(s => {
                        const ss = getStatusStyle(s);
                        return (
                          <span key={s} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${ss.text} ${ss.bg} ${ss.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                            {s.replace(/_/g, " ")}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Month View */}
                  {calendarView === "month" && (
                    <Card className="border border-border/60 shadow-sm bg-card rounded-xl overflow-hidden p-0">
                      <div className="grid grid-cols-7 bg-muted/10 text-center py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 border-l border-border/20 divide-x divide-y divide-border/20">
                        {calendarCells.map((week, wI) =>
                          week.map((cellDate, dI) => {
                            if (!cellDate) return <div key={`e-${wI}-${dI}`} className="min-h-32 bg-muted/10" />;
                            const postsForDay = posts.filter(p => {
                              if (!p.scheduledFor) return false;
                              const d = new Date(p.scheduledFor);
                              return d.getDate() === cellDate.getDate() && d.getMonth() === cellDate.getMonth() && d.getFullYear() === cellDate.getFullYear();
                            });
                            const visiblePosts = postsForDay.filter(p => statusFilter === "PUBLISHED" || statusFilter === "ALL" ? true : p.status !== "PUBLISHED");
                            const uniqueClients = new Set(postsForDay.map(p => p.clientId)).size;
                            const isToday = cellDate.toDateString() === new Date().toDateString();
                            const shown = visiblePosts.slice(0, 3);
                            const overflow = Math.max(0, visiblePosts.length - 3);
                            return (
                              <div
                                key={cellDate.toISOString()}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => { e.preventDefault(); const pid = e.dataTransfer.getData("postId"); if (pid) handleReschedulePost(pid, cellDate); }}
                                className={`group min-h-32 p-2 flex flex-col hover:bg-muted/10 transition-all cursor-default relative ${isToday ? "bg-primary/5 ring-inset ring-1 ring-primary/20" : "bg-card"}`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[11px] font-bold select-none ${isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] leading-none" : "text-muted-foreground/70"}`}>
                                    {cellDate.getDate()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      resetComposer();
                                      const ld = new Date(cellDate); ld.setHours(10, 0);
                                      const lDate = new Date(ld.getTime() - ld.getTimezoneOffset() * 60000);
                                      setComposerScheduledFor(lDate.toISOString().slice(0, 16));
                                      setPublishNow(false); setIsComposerOpen(true);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 rounded p-0.5 cursor-pointer shrink-0"
                                    title="Quick add"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="flex-1 space-y-0.5 overflow-hidden">
                                  {shown.map(p => {
                                    const client = getClientDetails(p.clientId);
                                    const timeStr = p.scheduledFor ? new Date(p.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
                                    const ss = getStatusStyle(p.status);
                                    const dashed = p.status === "DRAFT" ? "border-dashed" : "border-solid";
                                    return (
                                      <div
                                        key={p.id}
                                        draggable
                                        onDragStart={e => e.dataTransfer.setData("postId", p.id)}
                                        onClick={e => { e.stopPropagation(); setActivePostId(p.id); }}
                                        className={`text-[9px] font-semibold px-1.5 py-1 rounded border flex items-center gap-1 cursor-grab hover:shadow-sm active:cursor-grabbing truncate ${ss.text} ${ss.bg} ${ss.border} ${dashed} ${activePostId === p.id ? "ring-1 ring-primary/40" : ""}`}
                                        title={`${client.company}: ${p.caption}`}
                                      >
                                        <span className="text-[8px] font-black opacity-50 shrink-0 tabular-nums">{timeStr}</span>
                                        <span className="truncate flex-1">{client.company || client.name}</span>
                                        <div className="flex gap-0.5 shrink-0 ml-0.5">
                                          {p.destinations.slice(0, 2).map(d => <span key={d.id}>{getPlatformIcon(d.platform, "h-2 w-2")}</span>)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {overflow > 0 && (
                                    <div className="text-[8px] font-bold text-muted-foreground/60 text-center pt-0.5 hover:text-primary transition-colors cursor-pointer select-none">
                                      +{overflow} more
                                    </div>
                                  )}
                                </div>
                                {postsForDay.length > 0 && (
                                  <div className="mt-1 pt-1 border-t border-border/20 flex justify-between text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wide select-none">
                                    <span>{postsForDay.length} post{postsForDay.length !== 1 ? "s" : ""}</span>
                                    <span>{uniqueClients} client{uniqueClients !== 1 ? "s" : ""}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Week View */}
                  {calendarView === "week" && (
                    <Card className="border border-border/60 shadow-sm bg-card rounded-xl overflow-hidden p-0">
                      <div className="grid grid-cols-8 divide-x divide-border/30">
                        <div className="flex flex-col divide-y divide-border/20 bg-muted/10 text-muted-foreground text-[10px] font-bold text-center select-none pt-[42px]">
                          {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"].map(h => (
                            <div key={h} className="h-24 flex items-center justify-center">{h}</div>
                          ))}
                        </div>
                        {getWeekDays(calendarDate).map(dayDate => {
                          const isToday = dayDate.toDateString() === new Date().toDateString();
                          return (
                            <div key={dayDate.toISOString()} className="flex flex-col divide-y divide-border/20">
                              <div className={`p-2 text-center border-b border-border/30 text-xs font-bold ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/5 text-muted-foreground"}`}>
                                <div>{dayDate.toLocaleDateString(undefined, { weekday: "short" })}</div>
                                <div className="text-[10px] font-semibold mt-0.5">{dayDate.getDate()}</div>
                              </div>
                              {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"].map(hourStr => {
                                const postsInSlot = posts.filter(p => {
                                  if (!p.scheduledFor) return false;
                                  const d = new Date(p.scheduledFor);
                                  const matchDate = d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth() && d.getFullYear() === dayDate.getFullYear();
                                  if (!matchDate) return false;
                                  const hr = d.getHours();
                                  const slotHr = parseInt(hourStr.split(":")[0]);
                                  return hr >= slotHr && hr < slotHr + 2;
                                });
                                return (
                                  <div
                                    key={hourStr}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => { e.preventDefault(); const pid = e.dataTransfer.getData("postId"); if (pid) handleReschedulePostWithTime(pid, dayDate, hourStr); }}
                                    className="h-24 p-1 bg-card hover:bg-muted/5 relative group flex flex-col gap-1 overflow-y-auto select-none"
                                  >
                                    <button
                                      onClick={() => {
                                        resetComposer();
                                        const ld = new Date(dayDate);
                                        const [hrs] = hourStr.split(":").map(Number);
                                        ld.setHours(hrs, 0);
                                        const lDate = new Date(ld.getTime() - ld.getTimezoneOffset() * 60000);
                                        setComposerScheduledFor(lDate.toISOString().slice(0, 16));
                                        setPublishNow(false); setIsComposerOpen(true);
                                      }}
                                      className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 rounded p-0.5 cursor-pointer z-10"
                                    >
                                      <Plus className="h-2.5 w-2.5" />
                                    </button>
                                    {postsInSlot.map(p => {
                                      const client = getClientDetails(p.clientId);
                                      const ss = getStatusStyle(p.status);
                                      return (
                                        <div key={p.id} draggable onDragStart={e => e.dataTransfer.setData("postId", p.id)} onClick={() => setActivePostId(p.id)}
                                          className={`text-[8px] font-bold p-1 border rounded truncate cursor-grab active:cursor-grabbing ${ss.text} ${ss.bg} ${ss.border} ${activePostId === p.id ? "ring-1 ring-primary/40" : ""}`}>
                                          {client.company || client.name}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Agenda View */}
                  {calendarView === "agenda" && (
                    <Card className="border border-border/60 shadow-sm bg-card rounded-xl p-5">
                      {filteredPosts.filter(p => p.scheduledFor).length === 0 ? (
                        <div className="text-center py-12 text-sm text-muted-foreground italic">No scheduled posts in agenda.</div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(
                            filteredPosts.filter(p => p.scheduledFor).reduce((acc, p) => {
                              const key = new Date(p.scheduledFor!).toDateString();
                              if (!acc[key]) acc[key] = [];
                              acc[key].push(p);
                              return acc;
                            }, {} as Record<string, SocialPost[]>)
                          ).map(([dateStr, postsList]) => (
                            <div key={dateStr}>
                              <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30 pb-2 mb-3 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                {dateStr}
                                <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold">{postsList.length} posts</span>
                              </h4>
                              <div className="space-y-2">
                                {postsList.map(p => {
                                  const client = getClientDetails(p.clientId);
                                  const time = new Date(p.scheduledFor!).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                                  const ss = getStatusStyle(p.status);
                                  return (
                                    <div key={p.id} onClick={() => setActivePostId(p.id)}
                                      className={`p-3 bg-muted/10 border rounded-xl flex items-center justify-between cursor-pointer transition-colors hover:border-primary/30 ${activePostId === p.id ? "border-primary/50 bg-primary/5" : "border-border/40"}`}>
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-muted-foreground bg-muted border px-2.5 py-1 rounded-lg shrink-0 tabular-nums">{time}</span>
                                        <div>
                                          <div className="font-bold text-xs text-foreground">{client.company || client.name}</div>
                                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{p.caption}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <div className="flex gap-1">
                                          {p.destinations.map(d => <span key={d.id}>{getPlatformIcon(d.platform, "h-3.5 w-3.5")}</span>)}
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-full ${ss.text} ${ss.bg} ${ss.border}`}>
                                          {p.status.replace(/_/g, " ")}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Detail Side Panel */}
        {activePost && (
          <div className="w-80 shrink-0 bg-card border border-border/60 rounded-xl shadow-lg overflow-y-auto sticky top-20 max-h-[calc(100vh-160px)] flex flex-col gap-3 animate-in slide-in-from-right duration-200 text-left select-none p-4">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-border/30 pb-3">
              <div className="min-w-0">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Post Details</span>
                <h3 className="font-bold text-sm text-foreground truncate mt-0.5">{getClientDetails(activePost.clientId).company}</h3>
              </div>
              <button onClick={() => setActivePostId(null)} className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg shrink-0 cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Status */}
            {(() => {
              const ss = getStatusStyle(activePost.status);
              return (
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 border rounded-full flex items-center gap-1.5 w-fit ${ss.text} ${ss.bg} ${ss.border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                  {activePost.status.replace(/_/g, " ")}
                </span>
              );
            })()}

            {/* Media */}
            {getMediaUrls(activePost).length > 0 && (
              <div className="aspect-video bg-muted border border-border/40 rounded-xl overflow-hidden">
                {activePost.mediaType === "video" ? (
                  <video src={getMediaUrls(activePost)[0]} className="w-full h-full object-cover" controls preload="metadata" />
                ) : (
                  <img src={getMediaUrls(activePost)[0]} className="w-full h-full object-cover" alt="Media preview" />
                )}
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/20 border border-border/30 rounded-lg p-2.5">
                <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider block">Campaign</span>
                <span className="text-xs font-semibold text-foreground block mt-0.5 truncate">
                  {getCampaignName(activePost.campaignId) || <span className="italic text-muted-foreground/40 font-normal">None</span>}
                </span>
              </div>
              <div className="bg-muted/20 border border-border/30 rounded-lg p-2.5">
                <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider block">Writer</span>
                <span className="text-xs font-semibold text-foreground block mt-0.5 truncate">
                  {getWriterName(activePost) || <span className="italic text-muted-foreground/40 font-normal">Unassigned</span>}
                </span>
              </div>
            </div>

            {/* Caption */}
            <div className="bg-muted/10 border border-border/30 rounded-lg p-3">
              <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider block mb-1">Caption</span>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap select-text">{activePost.caption || <span className="italic text-muted-foreground/40">No caption</span>}</p>
            </div>

            {/* Platforms */}
            <div>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block border-b border-border/20 pb-1 mb-2">Destinations</span>
              <div className="space-y-1.5">
                {activePost.destinations.map(d => (
                  <div key={d.id} className="flex justify-between items-center bg-muted/10 border border-border/30 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(d.platform, "h-4 w-4 shrink-0")}
                      <div>
                        <span className="text-xs font-bold text-foreground leading-tight block">{d.socialAccount?.displayName || d.platform}</span>
                        <span className="text-[9px] text-muted-foreground capitalize">{d.platform}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border rounded-full ${d.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40" :
                          d.status === "FAILED" ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40" :
                            "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800"
                        }`}>{d.status}</span>
                      {d.status === "FAILED" && (
                        <Button variant="ghost" size="icon" onClick={() => handleRetryPost(activePost.id)} className="h-6 w-6 rounded-md text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/30" title="Retry">
                          <RefreshCw className="h-2.5 w-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block border-b border-border/20 pb-1 mb-2">Timeline</span>
              <div className="space-y-1.5 text-xs pl-4 border-l-2 border-border/30 ml-1">
                <div className="relative">
                  <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-slate-400 border-2 border-background" />
                  <span className="text-muted-foreground">Created · </span>
                  <span className="font-semibold text-foreground">{new Date(activePost.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {activePost.scheduledFor && (
                  <div className="relative">
                    <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-amber-500 border-2 border-background" />
                    <span className="text-muted-foreground">Scheduled · </span>
                    <span className="font-semibold text-foreground">{new Date(activePost.scheduledFor).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                )}
                {activePost.publishedAt && (
                  <div className="relative">
                    <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-emerald-500 border-2 border-background" />
                    <span className="text-muted-foreground">Published · </span>
                    <span className="font-semibold text-foreground">{new Date(activePost.publishedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Log */}
            {(activePost.platformContent?.activities || []).length > 0 && (
              <div>
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block border-b border-border/20 pb-1 mb-2">Activity</span>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {(activePost.platformContent.activities as any[]).map(act => (
                    <div key={act.id} className="text-[10px] flex justify-between bg-muted/15 p-1.5 rounded-lg border border-border/20">
                      <span className="text-foreground font-medium">{act.message}</span>
                      <span className="text-muted-foreground/60 shrink-0 text-[8px] font-bold ml-2">{new Date(act.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block border-b border-border/20 pb-1 mb-2">
                Comments ({(activePost.platformContent?.comments || []).length})
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 mb-2">
                {(activePost.platformContent?.comments || []).length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 italic py-1">No comments yet.</p>
                ) : (
                  (activePost.platformContent.comments as any[]).map(c => (
                    <div key={c.id} className="bg-muted/20 border border-border/25 p-2 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-foreground truncate">{c.author}</span>
                        <span className="text-[8px] text-muted-foreground/60 shrink-0">{new Date(c.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={e => { e.preventDefault(); handleAddComment(activePost.id, commentText); }} className="flex gap-1.5">
                <Input placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} className="h-8 text-xs rounded-lg flex-1" />
                <Button type="submit" size="sm" className="h-8 rounded-lg px-3 text-xs font-semibold shrink-0">Send</Button>
              </form>
            </div>

            {/* Actions */}
            <div className="border-t border-border/25 pt-3 space-y-2">
              {isReschedulingOpen ? (
                <div className="bg-muted/20 border border-border p-3 rounded-xl space-y-3">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Reschedule Post</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground font-semibold block mb-1">Date</label>
                      <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground font-semibold block mb-1">Time</label>
                      <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsReschedulingOpen(false)} className="h-8 text-xs">Cancel</Button>
                    <Button size="sm" onClick={() => {
                      if (rescheduleDate) handleReschedulePost(activePost.id, new Date(`${rescheduleDate}T${rescheduleTime || "10:00"}`));
                      setIsReschedulingOpen(false);
                    }} className="h-8 text-xs font-semibold">Save</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditPost(activePost)} className="h-8 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <SquarePen className="h-3 w-3" />Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDuplicatePost(activePost)} className="h-8 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <Copy className="h-3 w-3" />Duplicate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsReschedulingOpen(true)} className="h-8 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />Reschedule
                  </Button>
                  {activePost.scheduledFor && (
                    <Button variant="outline" size="sm" onClick={() => handleMovePostToUnscheduled(activePost.id)} className="h-8 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />Unschedule
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDeletePost(activePost.id)} className="h-8 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 col-span-2 mt-1 flex items-center gap-1.5">
                    <Trash2 className="h-3 w-3" />Delete Post
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING BULK ACTIONS BAR ── */}
      {selectedPostIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-slate-700/80 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 select-none">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-4 shrink-0">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none">{selectedPostIds.length}</span>
            <span className="text-xs font-semibold text-slate-300">selected</span>
          </div>
          <div className="flex items-center gap-2">
            <select onChange={e => { if (e.target.value) { handleBulkChangeStatus(e.target.value); e.target.value = ""; } }}
              className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-1.5 px-2.5 font-semibold outline-none hover:bg-slate-700 cursor-pointer">
              <option value="">Change Status...</option>
              {["DRAFT", "AWAITING_APPROVAL", "SCHEDULED", "PUBLISHED"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <select onChange={e => { if (e.target.value) { handleBulkMoveSchedule(Number(e.target.value)); e.target.value = ""; } }}
              className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-1.5 px-2.5 font-semibold outline-none hover:bg-slate-700 cursor-pointer">
              <option value="">Shift Schedule...</option>
              <option value="1">+1 Day</option><option value="2">+2 Days</option><option value="7">+1 Week</option>
              <option value="-1">-1 Day</option><option value="-7">-1 Week</option>
            </select>
            <select onChange={e => { if (e.target.value) { handleBulkAssignWriter(e.target.value); e.target.value = ""; } }}
              className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-1.5 px-2.5 font-semibold outline-none hover:bg-slate-700 cursor-pointer">
              <option value="">Assign Writer...</option>
              {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <Button variant="ghost" size="sm" onClick={handleBulkDuplicate} className="text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Copy className="h-3 w-3" />Duplicate
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Trash2 className="h-3 w-3" />Delete
            </Button>
          </div>
          <button onClick={() => setSelectedPostIds([])} className="text-slate-400 hover:text-white text-xs font-semibold border-l border-slate-700 pl-4 cursor-pointer hover:underline shrink-0">
            Clear
          </button>
        </div>
      )}

      {/* ── REDESIGNED COMPOSER DIALOG ── */}
      <Dialog open={isComposerOpen} onOpenChange={handleOpenChange}>
        <DialogContent className={`rounded-2xl overflow-hidden p-0 max-h-[92vh] flex flex-col bg-background border border-border transition-all duration-200 ${isFullscreen ? "max-w-[98vw] h-[95vh]" : "max-w-5xl md:max-w-6xl w-full"}`}>

          {/* Composer Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-bold text-foreground">{editingPostId ? "Edit Post" : "Create Post"}</h2>
              {selectedPlatforms.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <span>{selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""}</span>
                  <span className="opacity-40">·</span>
                  <span>{composerAccounts.length} account{composerAccounts.length !== 1 ? "s" : ""}</span>
                  {Object.values(syncedPlatforms).filter(v => !v).length > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-amber-500">{Object.values(syncedPlatforms).filter(v => !v).length} customized</span>
                    </>
                  )}
                </div>
              )}
              {/* Tags */}
              <div className="relative">
                <button type="button" onClick={() => setIsTagsOpen(!isTagsOpen)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer bg-transparent transition-colors">
                  <Tags size={13} />Tags
                  {postTags.length > 0 && <span className="bg-primary text-primary-foreground rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">{postTags.length}</span>}
                </button>
                {isTagsOpen && (
                  <div className="absolute left-0 mt-1 w-40 bg-background border border-border rounded-xl shadow-lg p-2 z-50 space-y-0.5">
                    {["Marketing", "Social", "Promo", "Announcement", "Event", "Update"].map(tag => {
                      const checked = postTags.includes(tag);
                      return (
                        <label key={tag} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs select-none">
                          <input type="checkbox" checked={checked} onChange={() => checked ? setPostTags(p => p.filter(t => t !== tag)) : setPostTags(p => [...p, tag])} className="accent-primary rounded" />
                          {tag}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border-none ${showPreview ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                <Eye size={13} />Preview
              </button>
              <button type="button" onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-1 hover:bg-muted rounded-lg transition-colors">
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button type="button" onClick={() => handleOpenChange(false)}
                className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-1 hover:bg-muted rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Composer Body */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* LEFT: Editor (scrollable) */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-5">

                {/* Client + Campaign */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Client *</label>
                    <Select value={composerClient || "none"} onValueChange={val => setComposerClient(val === "none" ? "" : val)}>
                      <SelectTrigger className="w-full border border-border/60 bg-background rounded-xl px-3 py-2 text-sm outline-none focus:border-primary cursor-pointer font-medium transition-colors h-10">
                        <SelectValue placeholder="Select a Client..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none">Select a Client...</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Campaign</label>
                      {composerClient && (
                        <button
                          type="button"
                          onClick={() => setIsCampaignDialogOpen(true)}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                        >
                          <Plus size={11} /> New Campaign
                        </button>
                      )}
                    </div>
                    <Select value={composerCampaign || "none"} onValueChange={val => setComposerCampaign(val === "none" ? "" : val)} disabled={!composerClient}>
                      <SelectTrigger className="w-full border border-border/60 bg-background rounded-xl px-3 py-2 text-sm outline-none focus:border-primary cursor-pointer font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10">
                        <SelectValue placeholder="No Campaign" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none">No Campaign</SelectItem>
                        {campaigns.filter(c => c.clientId === composerClient).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Account Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Publishing To</label>
                  {!composerClient ? (
                    <div className="text-xs text-muted-foreground/70 italic bg-muted/20 rounded-xl p-4 border border-dashed border-border text-center">
                      Select a client above to view their connected social accounts.
                    </div>
                  ) : accounts.length > 0 ? (
                    <div className="flex flex-wrap gap-4 py-2">
                      {accounts.map(account => {
                        const platId = account.platform.toLowerCase();
                        const pConfig = PLATFORMS_CONFIG.find(p => p.id === platId) || { label: account.platform, color: "#8E8E93", icon: HelpCircle };
                        const isAccSelected = composerAccounts.includes(account.id);
                        const isAlreadyPublished = alreadyPublishedAccountIds.includes(account.id);
                        const initials = (account.displayName || account.platformUsername || "?")
                          .split(" ")
                          .map(n => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <TooltipProvider key={account.id}>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  disabled={isAlreadyPublished}
                                  onClick={() => {
                                    if (isAccSelected) {
                                      setComposerAccounts(prev => prev.filter(id => id !== account.id));
                                      const remaining = composerAccounts.filter(id => id !== account.id);
                                      const hasMore = accounts.some(acc => remaining.includes(acc.id) && acc.platform.toLowerCase() === platId);
                                      if (!hasMore) {
                                        setSelectedPlatforms(prev => prev.filter(p => p !== platId));
                                        if (activePlatform === platId) {
                                          const rPlats = selectedPlatforms.filter(p => p !== platId);
                                          setActivePlatform(rPlats.length > 0 ? rPlats[0] : "");
                                        }
                                      }
                                    } else {
                                      setComposerAccounts(prev => [...prev, account.id]);
                                      if (!selectedPlatforms.includes(platId)) setSelectedPlatforms(prev => [...prev, platId]);
                                      setActivePlatform(platId);
                                      setExpandedComposerPlatform(platId);
                                    }
                                  }}
                                  className={`relative w-12 h-12 rounded-full outline-none flex items-center justify-center shrink-0 ${
                                    isAlreadyPublished
                                      ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background scale-105 opacity-85 cursor-not-allowed"
                                      : isAccSelected
                                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 opacity-100 cursor-pointer transition-all duration-200"
                                        : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:scale-105 cursor-pointer transition-all duration-200"
                                  }`}
                                >
                                  {/* Avatar or Initials */}
                                  {account.avatarUrl ? (
                                    <img
                                      src={account.avatarUrl}
                                      alt={account.displayName}
                                      className="w-full h-full rounded-full object-cover border border-border/40"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = "flex";
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="w-full h-full rounded-full bg-muted/60 dark:bg-muted/30 border border-border/40 text-[11px] font-bold text-muted-foreground flex items-center justify-center uppercase"
                                    style={{ display: account.avatarUrl ? "none" : "flex" }}
                                  >
                                    {initials}
                                  </div>

                                  {/* Platform Badge */}
                                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-border shadow-sm flex items-center justify-center z-10 p-0.5">
                                    {getPlatformIcon(platId, "w-full h-full rounded-sm object-contain")}
                                  </div>

                                  {/* Selected Checkmark indicator */}
                                  {isAccSelected && (
                                    <div className={`absolute -top-1 -right-1 text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center z-20 shadow-sm border border-background ${
                                      isAlreadyPublished ? "bg-emerald-500" : "bg-primary"
                                    }`}>
                                      <Check className="h-2.5 w-2.5 stroke-[3px]" />
                                    </div>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs p-2">
                                <p className="font-semibold">{account.displayName || account.platformUsername}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{pConfig.label}</p>
                                {isAlreadyPublished && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">✔ Already published</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/70 italic bg-muted/20 rounded-xl p-4 border border-dashed border-border text-center">
                      No social accounts connected for this client. Connect accounts in Social Accounts settings.
                    </div>
                  )}
                </div>

                {/* Master Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Master Content</label>
                    <span className="text-[10px] text-muted-foreground/60 italic">All platforms inherit unless customized</span>
                  </div>
                  <div className="border border-border/60 rounded-xl overflow-hidden focus-within:border-primary/50 transition-colors">
                    <textarea
                      value={composerCaption}
                      onChange={e => setComposerCaption(e.target.value)}
                      placeholder="Write your main caption here. All platforms will inherit this unless customized..."
                      rows={4}
                      className="w-full resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground/40 p-4 bg-transparent focus:ring-0 border-0"
                    />
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/30 bg-muted/5">
                      <button type="button" onClick={() => document.getElementById("media-file")?.click()} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Add Media">
                        <ImagePlus size={16} />
                      </button>
                      <div className="relative">
                        <button type="button" onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center" title="Emoji">
                          <Smile size={16} />
                        </button>
                        {isEmojiOpen && (
                          <div className="absolute left-0 bottom-full mb-2 w-44 bg-background border border-border rounded-xl shadow-lg p-2 z-50 grid grid-cols-4 gap-1">
                            {["😊", "🔥", "🚀", "✨", "👍", "🎉", "❤️", "👏", "🙌", "💡", "📌", "📢", "😍", "🤩", "💯", "😎"].map(emoji => (
                              <button key={emoji} type="button" onClick={() => { setComposerCaption(prev => prev + emoji); setIsEmojiOpen(false); }}
                                className="h-8 w-8 text-lg flex items-center justify-center hover:bg-muted rounded cursor-pointer border-none bg-transparent">{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setComposerCaption(prev => prev + " #")} className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer bg-transparent border-none" title="Hashtag">#</button>
                      <button type="button" onClick={() => setIsAiOpen(true)} className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none">
                        <Sparkles size={13} />AI
                      </button>
                      <input id="media-file" type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
                    </div>
                  </div>
                </div>

                {/* Media Grid */}
                {(composerMediaUrls.length > 0 || uploadProgressFiles.some(f => f.status === "uploading")) && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Media</label>
                    <div className="flex gap-2 flex-wrap">
                      {composerMediaUrls.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group border border-border/50 shrink-0">
                          {composerMediaType === "video" ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} alt="" className="w-full h-full object-cover" />}
                          <button type="button" onClick={() => setComposerMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 border-none cursor-pointer">×</button>
                        </div>
                      ))}
                      {uploadProgressFiles.filter(f => f.status === "uploading").map(f => (
                        <div key={f.id} className="w-20 h-20 rounded-lg border border-border/50 bg-muted/30 flex items-center justify-center shrink-0">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ))}
                      <button type="button" onClick={() => document.getElementById("media-file")?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/20 cursor-pointer bg-transparent transition-colors shrink-0">
                        <ImagePlus size={17} className="text-muted-foreground/50" />
                        <span className="text-[9px] text-muted-foreground/50 font-medium">Add</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Platform Accordion Editors */}
                {selectedPlatforms.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Per-Platform Settings</label>
                    <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/30">
                      {selectedPlatforms.map(plat => {
                        const pConf = PLATFORMS_CONFIG.find(p => p.id === plat);
                        if (!pConf) return null;
                        const PlatIcon = pConf.icon;
                        const isSynced = syncedPlatforms[plat] ?? true;
                        const isExpanded = expandedComposerPlatform === plat;
                        const captionPreview = getPlatformCaption(plat);
                        const charCount = getCharLimitForPlatform(plat) - captionPreview.length;

                        return (
                          <div key={plat}>
                            {/* Accordion Header */}
                            <button type="button"
                              onClick={() => setExpandedComposerPlatform(isExpanded ? null : plat)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer text-left">
                              <PlatIcon className="h-5 w-5 shrink-0" style={{ color: pConf.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{pConf.label}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isSynced
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                                      : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                                    }`}>
                                    {isSynced ? "Using Master" : "Customized"}
                                  </span>
                                </div>
                                {!isExpanded && captionPreview && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-[320px]">{captionPreview}</p>
                                )}
                              </div>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            {/* Accordion Content */}
                            <div style={{ maxHeight: isExpanded ? "600px" : "0px", overflow: "hidden", transition: "max-height 0.25s ease-in-out" }}>
                              <div className="px-4 pb-4 pt-2 space-y-4 bg-muted/5 border-t border-border/20">
                                {/* Post type selector + sync toggle */}
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-4">
                                    {(plat === "instagram" || plat === "facebook") && (
                                      ["Post", "Reel", "Story"].map(opt => (
                                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-foreground">
                                          <input type="radio" name={`${plat}-type`}
                                            checked={(plat === "instagram" ? instagramType : facebookType) === opt.toLowerCase()}
                                            onChange={() => plat === "instagram" ? setInstagramType(opt.toLowerCase() as any) : setFacebookType(opt.toLowerCase() as any)}
                                            className="accent-primary" />
                                          {opt}
                                        </label>
                                      ))
                                    )}
                                    {plat === "youtube" && (
                                      (["Short", "Video"] as const).map(opt => (
                                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-foreground">
                                          <input type="radio" name="youtube-type"
                                            checked={youtubeType === opt.toLowerCase()}
                                            onChange={() => setYoutubeType(opt.toLowerCase() as "short" | "video")}
                                            className="accent-primary" />
                                          {opt}
                                        </label>
                                      ))
                                    )}
                                  </div>
                                  <button type="button" onClick={() => togglePlatformSync(plat)}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${isSynced
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                                        : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                                      }`}>
                                    {isSynced ? <><Link2 size={11} />Using Master</> : <><Link2Off size={11} />Customized</>}
                                  </button>
                                </div>

                                {/* Caption */}
                                <div className="border border-border/50 rounded-lg overflow-hidden focus-within:border-primary/40 transition-colors">
                                  <textarea
                                    value={getPlatformCaption(plat)}
                                    onChange={e => setPlatformCaption(plat, e.target.value)}
                                    placeholder={isSynced ? "Inheriting master caption..." : `Custom caption for ${pConf.label}...`}
                                    rows={3}
                                    className="w-full resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground/40 p-3 bg-transparent focus:ring-0 border-0"
                                  />
                                  <div className="flex items-center gap-3 px-3 py-2 border-t border-border/20 bg-muted/5">
                                    <button type="button" onClick={() => setPlatformCaption(plat, getPlatformCaption(plat) + " #")}
                                      className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer bg-transparent border-none">#</button>
                                    <span className={`text-xs ml-auto tabular-nums ${charCount < 0 ? "text-rose-500 font-bold" : charCount < 50 ? "text-amber-500" : "text-muted-foreground"}`}>
                                      {charCount}
                                    </span>
                                  </div>
                                </div>

                                {/* Platform-specific fields */}
                                {(plat === "instagram" || plat === "facebook" || plat === "linkedin") && (
                                  <div className="space-y-3">
                                    {plat === "instagram" && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-muted-foreground w-20 shrink-0">Stickers</span>
                                        <button type="button" onClick={() => setInstagramMusic(!instagramMusic)}
                                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${instagramMusic ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:bg-muted/50 bg-background"}`}>
                                          <Music size={11} />Music
                                        </button>
                                        <button type="button" onClick={() => setInstagramTagProducts(!instagramTagProducts)}
                                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${instagramTagProducts ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:bg-muted/50 bg-background"}`}>
                                          <ShoppingBag size={11} />Products
                                        </button>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground w-20 shrink-0">First Comment</span>
                                      <input
                                        value={plat === "instagram" ? instagramFirstComment : plat === "facebook" ? facebookFirstComment : linkedinFirstComment}
                                        onChange={e => plat === "instagram" ? setInstagramFirstComment(e.target.value) : plat === "facebook" ? setFacebookFirstComment(e.target.value) : setLinkedinFirstComment(e.target.value)}
                                        placeholder="Scheduled first comment..."
                                        className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background"
                                      />
                                    </div>
                                  </div>
                                )}
                                {plat === "tiktok" && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-16 shrink-0">Title</span>
                                    <input value={tiktokTitle} onChange={e => setTiktokTitle(e.target.value)} placeholder="TikTok title..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                  </div>
                                )}
                                {plat === "youtube" && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-16 shrink-0">Title</span>
                                    <input value={youtubeTitle} onChange={e => setYoutubeTitle(e.target.value)} placeholder="Video title..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                  </div>
                                )}
                                {plat === "threads" && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground w-16 shrink-0">Topic</span>
                                      <input value={threadsTopic} onChange={e => setThreadsTopic(e.target.value)} placeholder="Thread topic..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                    </div>
                                    <div className="flex items-center gap-2 pl-20">
                                      <span className="text-[10px] text-muted-foreground shrink-0">Trending:</span>
                                      {TRENDING_TOPICS.map(t => (
                                        <button key={t} type="button" onClick={() => setThreadsTopic(t === "More..." ? threadsTopic : t)}
                                          className="px-2 py-0.5 rounded-full border border-border text-[10px] text-muted-foreground whitespace-nowrap cursor-pointer hover:bg-muted/50 bg-background">{t}</button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* RIGHT: Live Preview (fixed, non-scrolling relative to dialog) */}
            {showPreview && (
              <div className="w-[360px] shrink-0 border-l border-border/40 bg-muted/20 flex flex-col overflow-hidden">
                {/* Preview platform tabs */}
                {selectedPlatforms.length > 0 && (
                  <div className="flex gap-1 p-3 border-b border-border/30 bg-background/50 overflow-x-auto flex-nowrap shrink-0">
                    {selectedPlatforms.map(plat => {
                      const pConf = PLATFORMS_CONFIG.find(p => p.id === plat);
                      if (!pConf) return null;
                      const PlatIcon = pConf.icon;
                      const isActive = activePlatform === plat;
                      return (
                        <button key={plat} type="button" onClick={() => setActivePlatform(plat)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-none shrink-0 ${isActive ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 bg-transparent"
                            }`}>
                          <PlatIcon className="h-3.5 w-3.5" style={{ color: isActive ? "inherit" : pConf.color }} />
                          {pConf.label.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Eye size={11} />
                    {activePlatform ? `${PLATFORMS_CONFIG.find(p => p.id === activePlatform)?.label || activePlatform} Preview` : "Live Preview"}
                  </div>
                  {activePlatform ? (
                    <PreviewCard
                      platform={activePlatform}
                      text={getPlatformCaption(activePlatform) || "What would you like to share?"}
                      image={composerMediaUrls[0] || null}
                      mediaType={composerMediaType}
                      accountName={accounts.find(a => a.platform.toLowerCase() === activePlatform)?.displayName || accounts.find(a => a.platform.toLowerCase() === activePlatform)?.platformUsername || activePlatform}
                      postType={activePlatform === "instagram" ? instagramType : activePlatform === "facebook" ? facebookType : activePlatform === "youtube" ? youtubeType : "post"}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs italic text-center py-12">
                      Select a platform to see the live preview.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Composer Sticky Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 shrink-0 bg-background">
            <div className="flex items-center gap-3">
              <select value={publishNow ? "now" : "schedule"} onChange={e => setPublishNow(e.target.value === "now")}
                disabled={isSubmitting}
                className="border border-border/50 bg-background rounded-xl px-3 py-2 text-sm outline-none focus:border-primary cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="now">Publish Now</option>
                <option value="schedule">Schedule</option>
              </select>
              {!publishNow && (
                <div className="flex items-center gap-2 border border-border/50 bg-muted/20 rounded-xl px-3 py-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input type="datetime-local" value={composerScheduledFor} onChange={e => setComposerScheduledFor(e.target.value)}
                    disabled={isSubmitting}
                    className="bg-transparent border-none text-xs focus:ring-0 outline-none cursor-pointer text-foreground disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>
              )}
              <button type="button" disabled={!composerClient || isSubmitting || isUploading} onClick={() => handleCreatePost(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border flex items-center gap-2 ${!composerClient || isSubmitting || isUploading ? "bg-muted text-muted-foreground/40 border-border/30 cursor-not-allowed" : "text-foreground bg-muted/30 hover:bg-muted border-border/50 cursor-pointer"
                  }`}>
                {isSubmitting && submitType === "draft" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                Save Draft
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="rounded-xl px-5 font-semibold text-sm h-9" disabled={isSubmitting || isUploading} onClick={() => handleOpenChange(false)}>Cancel</Button>
              {(() => {
                const disabled = !composerClient || composerAccounts.length === 0 || isSubmitting || isUploading;
                const label = !composerClient ? "Select Client" : composerAccounts.length === 0 ? "Select Accounts" : isUploading ? "Uploading Media..." : isSubmitting && submitType === "publish" ? (publishNow ? "Publishing..." : "Scheduling...") : publishNow ? "Publish Now" : "Schedule Post";
                return (
                  <button type="button" disabled={disabled} onClick={() => handleCreatePost()}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors border-none h-9 flex items-center justify-center gap-2 ${disabled ? "bg-muted text-muted-foreground/40 cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-sm"
                      }`}>
                    {isSubmitting && submitType === "publish" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
                    )}
                    {isUploading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                    <span>{label}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Caption Generator Modal */}
      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-background">
          <DialogHeader>
            <DialogTitle className="font-bold text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Caption Generator
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">Generate platform-optimized captions using AI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What is your post about?</label>
              <Textarea placeholder="e.g. Announcing our brand new feature release next week! Highlight the productivity gains." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="rounded-xl h-24 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Optimize Tone For</label>
              <select value={aiTargetPlatform} onChange={e => setAiTargetPlatform(e.target.value)} className="w-full border border-border bg-background rounded-xl p-2.5 text-sm outline-none focus:border-primary">
                <option value="instagram">Instagram (Engaging, hashtags, spacing)</option>
                <option value="facebook">Facebook (Friendly, informational)</option>
                <option value="linkedin">LinkedIn (Professional, thought-provoking)</option>
                <option value="x">X / Twitter (Short, high impact)</option>
                <option value="tiktok">TikTok (Trendy, short, action-focused)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsAiOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={generateAiCaption} disabled={isGeneratingAi || !aiPrompt}>
              {isGeneratingAi ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</> : "Generate Caption"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Campaign Dialog */}
      <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="font-bold text-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create Campaign
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">Add a new campaign for this client to categorize posts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Campaign Name</label>
              <Input
                placeholder="e.g. Summer Sale 2026"
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                className="rounded-xl h-10 text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCampaign();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsCampaignDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleCreateCampaign} disabled={isSavingCampaign || !newCampaignName.trim()}>
              {isSavingCampaign ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── PREVIEW RENDERERS ─────────────────────────── */
interface PreviewCardProps {
  platform: string;
  text: string;
  image: string | null;
  mediaType?: string;
  accountName?: string;
  postType?: "post" | "reel" | "story" | "short" | "video";
}

function PreviewCard({ platform, text, image, mediaType = "image", accountName, postType = "post" }: PreviewCardProps) {
  const avatar = "https://api.dicebear.com/7.x/identicon/svg?seed=hirdanmarketing";
  const displayName = accountName || "Your Account";
  const handle = displayName.toLowerCase().replace(/\s+/g, "");

  if (platform === "x" || platform === "twitter") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 w-full select-none text-left">
        <div className="flex gap-3">
          <img src={avatar} className="w-10 h-10 rounded-full" alt="Avatar" />
          <div className="flex-1 min-w-0">
            <div className="text-sm"><span className="font-semibold text-neutral-900">{displayName}</span>{" "}<span className="text-neutral-400">@{handle}</span></div>
            <p className="text-sm text-neutral-800 mt-1 whitespace-pre-wrap">{text}</p>
            {image && (
              mediaType === "video" ? (
                <video src={image} controls className="mt-3 rounded-xl w-full object-cover max-h-64" muted playsInline />
              ) : (
                <img src={image} className="mt-3 rounded-xl w-full object-cover max-h-64" alt="X preview" />
              )
            )}
            <div className="flex justify-between mt-3 text-neutral-400 max-w-[280px]">
              <MessageCircle size={16} /><Repeat2 size={16} /><Heart size={16} /><BarChart2 size={16} /><Bookmark size={16} /><Share2 size={16} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    if (postType === "reel") {
      return (
        <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800" style={{ aspectRatio: "9/16" }}>
          {image ? (
            mediaType === "video" ? (
              <video src={image} className="absolute inset-0 w-full h-full object-cover opacity-80" muted loop autoPlay playsInline />
            ) : (
              <img src={image} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Facebook Reel" />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2"><Play className="h-10 w-10" /><span className="text-[10px]">Upload a video for Reel</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          <div className="absolute top-4 left-4 text-white text-xs font-bold flex items-center gap-1.5 z-10"><FacebookGlyph className="w-4 h-4" /><span>Reels</span></div>
          <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white z-10">
            <img src={avatar} className="w-9 h-9 rounded-full border-2 border-white" alt="Avatar" />
            <span className="flex flex-col items-center gap-0.5 text-[10px]"><Heart size={22} />Like</span>
            <span className="flex flex-col items-center gap-0.5 text-[10px]"><MessageCircle size={22} />Comment</span>
            <span className="flex flex-col items-center gap-0.5 text-[10px]"><Share2 size={22} />Share</span>
          </div>
          <div className="absolute left-3 bottom-4 right-16 text-white text-xs z-10">
            <div className="font-semibold mb-1">{displayName}</div>
            <div className="line-clamp-3 leading-snug whitespace-pre-wrap opacity-90">{text}</div>
          </div>
        </div>
      );
    }
    if (postType === "story") {
      return (
        <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800" style={{ aspectRatio: "9/16" }}>
          {image ? (
            mediaType === "video" ? (
              <video src={image} className="absolute inset-0 w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <img src={image} className="absolute inset-0 w-full h-full object-cover" alt="Facebook Story" />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2"><ImageIcon className="h-10 w-10" /><span className="text-[10px]">Upload media for Story</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-white/30 rounded-full z-10"><div className="h-full w-1/3 bg-white rounded-full" /></div>
          <div className="absolute top-6 left-3 flex items-center gap-2 z-10"><img src={avatar} className="w-8 h-8 rounded-full border-2 border-white" alt="Avatar" /><span className="text-white text-xs font-semibold">{displayName}</span></div>
          <div className="absolute bottom-6 left-3 right-3 z-10"><div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-white text-xs text-center border border-white/30">Reply to {displayName}...</div></div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden w-full select-none text-left">
        <div className="flex items-center gap-3 p-4 pb-2">
          <img src={avatar} className="w-9 h-9 rounded-full" alt="Avatar" />
          <div><div className="text-sm font-semibold text-neutral-900">{displayName}</div><div className="text-xs text-neutral-400">Just Now · 🌐</div></div>
        </div>
        <p className="px-4 pb-3 text-sm text-neutral-800 whitespace-pre-wrap">{text}</p>
        {image && (
          mediaType === "video" ? (
            <video src={image} controls className="w-full object-cover max-h-64" muted playsInline />
          ) : (
            <img src={image} className="w-full object-cover max-h-64" alt="Facebook preview" />
          )
        )}
        <div className="flex justify-around py-2 border-t border-neutral-100 text-sm text-neutral-500 font-medium bg-neutral-50/50">
          <span className="flex items-center gap-1"><ThumbsUp size={15} />Like</span>
          <span className="flex items-center gap-1"><MessageCircle size={15} />Comment</span>
          <span className="flex items-center gap-1"><Share2 size={15} />Share</span>
        </div>
      </div>
    );
  }

  if (platform === "instagram") {
    if (postType === "reel") {
      return (
        <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800" style={{ aspectRatio: "9/16" }}>
          {image ? (
            mediaType === "video" ? (
              <video src={image} className="absolute inset-0 w-full h-full object-cover opacity-90" muted loop autoPlay playsInline />
            ) : (
              <img src={image} className="absolute inset-0 w-full h-full object-cover opacity-90" alt="Instagram Reel" />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2"><Play className="h-10 w-10" /><span className="text-[10px]">Upload a video for Reel</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 text-white text-xs font-bold flex items-center gap-1 z-10"><InstagramGlyph className="w-4 h-4" />Reels</div>
          <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4 text-white z-10">
            <img src={avatar} className="w-9 h-9 rounded-full border-2 border-white" alt="Avatar" />
            <span className="flex flex-col items-center gap-0.5 text-[10px]"><Heart size={22} />Like</span>
            <span className="flex flex-col items-center gap-0.5 text-[10px]"><MessageCircle size={22} />Comment</span>
            <span className="flex flex-col items-center gap-0.5 text-[10px]"><Share2 size={22} />Share</span>
          </div>
          <div className="absolute left-3 bottom-4 right-16 text-white text-xs z-10">
            <div className="font-semibold mb-1">@{handle}</div>
            <div className="line-clamp-3 leading-snug whitespace-pre-wrap opacity-90">{text}</div>
          </div>
        </div>
      );
    }
    if (postType === "story") {
      return (
        <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800" style={{ aspectRatio: "9/16" }}>
          {image ? (
            mediaType === "video" ? (
              <video src={image} className="absolute inset-0 w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <img src={image} className="absolute inset-0 w-full h-full object-cover" alt="Instagram Story" />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2"><ImageIcon className="h-10 w-10" /><span className="text-[10px]">Upload media for Story</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30" />
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-white/30 rounded-full z-10"><div className="h-full w-1/2 bg-white rounded-full" /></div>
          <div className="absolute top-6 left-3 flex items-center gap-2 z-10"><img src={avatar} className="w-8 h-8 rounded-full border-2 border-white" alt="Avatar" /><span className="text-white text-xs font-semibold">@{handle}</span></div>
          <div className="absolute bottom-6 left-3 right-3 z-10"><div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-white text-xs text-center border border-white/30">Send message...</div></div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden w-full select-none text-left">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2"><img src={avatar} className="w-8 h-8 rounded-full" alt="Avatar" /><span className="text-sm font-semibold">@{handle}</span></div>
          <MoreHorizontal size={16} className="text-neutral-500" />
        </div>
        {image ? (
          mediaType === "video" ? (
            <video src={image} controls className="w-full aspect-square object-cover" muted playsInline />
          ) : (
            <img src={image} className="w-full aspect-square object-cover" alt="Instagram preview" />
          )
        ) : (
          <div className="w-full aspect-square bg-neutral-100 flex items-center justify-center text-neutral-300"><ImageIcon size={36} /></div>
        )}
        <div className="flex items-center gap-3 px-3 pt-3 text-neutral-700"><Heart size={19} /><MessageCircle size={19} /><Send size={19} /><div className="flex-1" /><Bookmark size={19} /></div>
        <p className="px-3 pb-3 pt-1 text-sm"><span className="font-semibold mr-1.5">@{handle}</span><span className="whitespace-pre-wrap">{text}</span></p>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 w-full select-none text-left">
        <div className="flex items-center gap-3 mb-2">
          <img src={avatar} className="w-10 h-10 rounded-full" alt="Avatar" />
          <div><div className="text-sm font-semibold text-neutral-900">{displayName}</div><div className="text-xs text-neutral-400">1h · 🌐</div></div>
        </div>
        <p className="text-sm text-neutral-800 mb-3 whitespace-pre-wrap">{text}</p>
        {image && (
          mediaType === "video" ? (
            <video src={image} controls className="w-full rounded-lg object-cover max-h-64" muted playsInline />
          ) : (
            <img src={image} className="w-full rounded-lg object-cover max-h-64" alt="LinkedIn preview" />
          )
        )}
        <div className="flex justify-around pt-3 mt-3 border-t border-neutral-100 text-xs text-neutral-500">
          <span className="flex flex-col items-center gap-1"><ThumbsUp size={16} />Like</span>
          <span className="flex flex-col items-center gap-1"><MessageCircle size={16} />Comment</span>
          <span className="flex flex-col items-center gap-1"><Repeat2 size={16} />Repost</span>
          <span className="flex flex-col items-center gap-1"><Send size={16} />Send</span>
        </div>
      </div>
    );
  }

  if (platform === "tiktok") {
    return (
      <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800 text-left" style={{ aspectRatio: "9/16" }}>
        <div className="flex justify-center gap-6 pt-4 text-white text-xs relative z-10">
          <span className="text-neutral-400">Following</span>
          <span className="font-semibold border-b-2 border-white pb-1">For You</span>
          <Search size={14} className="text-white ml-2" />
        </div>
        {image ? (
          mediaType === "video" ? (
            <video src={image} className="absolute inset-0 w-full h-full object-cover top-12" style={{ height: "calc(100% - 3rem)", top: "3rem" }} muted loop autoPlay playsInline />
          ) : (
            <img src={image} className="absolute inset-0 w-full h-full object-cover top-12" style={{ height: "calc(100% - 3rem)", top: "3rem" }} alt="TikTok preview" />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2"><ImageIcon className="h-8 w-8" /><span className="text-[10px]">No media attached</span></div>
        )}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white z-10">
          <img src={avatar} className="w-9 h-9 rounded-full border-2 border-white" alt="Avatar" />
          <Heart size={24} /><MessageCircle size={24} /><Bookmark size={24} /><Share2 size={24} />
        </div>
        <div className="absolute left-3 bottom-4 text-white text-xs z-10 pr-12">
          <div className="font-semibold flex items-center gap-2">@{handle}<span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">Video</span></div>
          <div className="mt-1 line-clamp-3 leading-snug whitespace-pre-wrap">{text}</div>
        </div>
      </div>
    );
  }

  if (platform === "youtube") {
    if (postType === "short" || postType === "post") {
      return (
        <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800 text-left" style={{ aspectRatio: "9/16" }}>
          {image ? (
            mediaType === "video" ? (
              <video src={image} className="absolute inset-0 w-full h-full object-cover opacity-80" muted loop autoPlay playsInline />
            ) : (
              <img src={image} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="YouTube Short" />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2"><Play className="h-8 w-8" /><span className="text-[10px]">Upload a video for Short</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          <div className="absolute top-3 left-3 text-white text-[10px] font-bold flex items-center gap-1 z-10"><YouTubeIcon className="w-5 h-5" style={{ color: "#FF0000" }} />Shorts</div>
          <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4 text-white text-[10px] z-10">
            <span className="flex flex-col items-center gap-0.5"><ThumbsUp size={20} />Like</span>
            <span className="flex flex-col items-center gap-0.5"><ThumbsDown size={20} />Dislike</span>
            <span className="flex flex-col items-center gap-0.5"><MessageCircle size={20} />Comment</span>
            <span className="flex flex-col items-center gap-0.5"><Share2 size={20} />Share</span>
          </div>
          <div className="absolute left-3 bottom-4 right-16 text-white text-xs z-10">
            <div className="flex items-center gap-2 mb-1">
              <img src={avatar} className="w-6 h-6 rounded-full" alt="Avatar" />
              <span className="font-medium">@{handle}</span>
              <span className="bg-white text-black text-[9px] px-2 py-0.5 rounded-full font-bold">Subscribe</span>
            </div>
            <div className="line-clamp-2 leading-snug whitespace-pre-wrap">{text}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden w-full select-none text-left">
        <div className="relative bg-black aspect-video flex items-center justify-center">
          {image ? (
            mediaType === "video" ? (
              <video src={image} className="w-full h-full object-cover opacity-80" muted loop autoPlay playsInline />
            ) : (
              <img src={image} className="w-full h-full object-cover opacity-80" alt="YouTube Video" />
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-neutral-500 gap-2 w-full h-full"><Play className="h-10 w-10" /><span className="text-[10px]">Upload a thumbnail or video</span></div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow"><Play size={18} className="text-black ml-0.5 fill-black" /></div>
          </div>
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">0:00</span>
        </div>
        <div className="p-3 flex gap-3">
          <img src={avatar} className="w-9 h-9 rounded-full shrink-0 mt-0.5" alt="Avatar" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug">{text || "Your video title here"}</p>
            <p className="text-xs text-neutral-500 mt-1">{displayName} · Just now · 0 views</p>
          </div>
          <MoreHorizontal size={16} className="text-neutral-400 shrink-0 mt-0.5" />
        </div>
        <div className="flex justify-around px-3 pb-3 text-xs text-neutral-500 border-t border-neutral-100 pt-2">
          <span className="flex items-center gap-1"><ThumbsUp size={14} />Like</span>
          <span className="flex items-center gap-1"><ThumbsDown size={14} />Dislike</span>
          <span className="flex items-center gap-1"><Share2 size={14} />Share</span>
          <span className="flex items-center gap-1"><Bookmark size={14} />Save</span>
        </div>
      </div>
    );
  }

  if (platform === "threads") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 w-full select-none text-left">
        <div className="flex gap-3">
          <img src={avatar} className="w-9 h-9 rounded-full" alt="Avatar" />
          <div className="flex-1 min-w-0">
            <div className="text-sm"><span className="font-semibold text-neutral-900">{displayName}</span>{" "}<span className="text-neutral-400 text-xs">21h</span></div>
            <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{text}</p>
            {image && (
              mediaType === "video" ? (
                <video src={image} controls className="mt-3 rounded-xl w-full object-cover max-h-64" muted playsInline />
              ) : (
                <img src={image} className="mt-3 rounded-xl w-full object-cover max-h-64" alt="Threads preview" />
              )
            )}
            <div className="flex gap-4 mt-3 text-neutral-500 max-w-[200px]">
              <Heart size={17} /><MessageCircle size={17} /><Repeat2 size={17} /><Send size={17} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
