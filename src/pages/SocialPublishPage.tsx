import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch, apiUpload } from "@/lib/api-client";
import { CardGridSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth-store";
import { useAgencyStore } from "@/lib/store";
import { contentTypesFor, validateContentTypeMedia, TIKTOK_POST_MODES, type TikTokPostMode, type ContentType } from "@/lib/platform-capabilities";
import PostGrid from "@/components/social/PostGrid";
import CalendarViews from "@/components/social/CalendarViews";
import PostComposer, { type PinterestBoardState } from "@/components/social/PostComposer";
import { PublishProgressDialog } from "@/components/social/PublishProgressDialog";
import {
  WEEK_VIEW_SLOTS,
  type SocialPost, type SocialAccount, type Client, type SocialCampaign, type UploadProgressFile,
} from "@/lib/social/types";
import { PLATFORMS_CONFIG, FacebookGlyph, InstagramGlyph, YouTubeIcon } from "@/lib/social/platform";
import { getStatusStyle, formatPostStatus } from "@/lib/social/post-status";
import { createUploadTracker } from "@/lib/social/upload-progress";
import {
  Plus, Calendar, RefreshCw, Trash2, Sparkles, Image as ImageIcon, Loader2, Heart, MessageSquare, Share2, HelpCircle, ArrowLeft, X, Settings,
  Tag, Link as LinkIcon, ChevronUp, MoreHorizontal, Search, Disc, Volume2, FileText, Check, Bookmark,
  Hash, ThumbsUp, ThumbsDown, MessageCircle, Repeat2, Send, Play, BarChart2, MapPin, Info, SquarePen, Grid, List, ArrowUpDown, User, Copy, AlertCircle, CheckCircle2
} from "lucide-react";

// Helpers
const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return `rgba(90, 66, 138, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${isNaN(r) ? 80 : r}, ${isNaN(g) ? 65 : g}, ${isNaN(b) ? 136 : b}, ${alpha})`;
};

function inferContentType(title: string, platforms: string[]): string {
  const t = title.toLowerCase();
  if (/\bvideo\b|\breel\b|\btiktok\b|\bshort\b|\bfilm\b|\bfilmed\b|\brecord/.test(t)) return "video";
  if (/\bstory\b|\bstories\b/.test(t)) return "story";
  if (/\bphoto\b|\bpicture\b|\bimage\b|\bpic\b|\bshot\b/.test(t)) return "photo";
  if (platforms.some(p => p === "TIKTOK" || p === "YOUTUBE")) return "video";
  return "graphic";
}

function isTikTokDraft(dest: { platform?: string; platformPostId?: string | null; error?: string | null }, platformContent?: any): boolean {
  if ((dest.platform || "").toLowerCase() !== "tiktok") return false;
  if (dest.platformPostId?.includes("v_inbox_url") || dest.platformPostId?.includes("v_inbox_")) return true;
  if (/^v_(pub|inbox)_/i.test(dest.platformPostId || "")) return true;
  if (platformContent?.tiktok?.postMode === "draft") return true;
  return false;
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

export function getWeekDays(date: Date) {
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientIdsWithAccounts, setClientIdsWithAccounts] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);

  const clientsWithAccounts = useMemo(() => {
    return clients.filter(c => {
      const hasInSet = clientIdsWithAccounts.has(c.id);
      const count = (c as any)._count?.socialAccounts;
      const hasInCount = typeof count === "number" && count > 0;
      return hasInSet || hasInCount;
    });
  }, [clients, clientIdsWithAccounts]);
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

  // Publishing progress modal state
  const [isPublishProgressOpen, setIsPublishProgressOpen] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{
    postId: string | null;
    status: 'idle' | 'publishing' | 'success' | 'failed';
    totalDestinations: number;
    completedDestinations: number;
    failedDestinations: number;
    destinations: Array<{
      id: string;
      platform: string;
      accountName: string;
      /** The client's own logo, so the modal shows who is being posted for. */
      avatarUrl?: string | null;
      status: string;
      error: string | null;
      platformPostId?: string | null;
    }>;
  }>({
    postId: null,
    status: 'idle',
    totalDestinations: 0,
    completedDestinations: 0,
    failedDestinations: 0,
    destinations: []
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPublishProgressOpen && publishStatus.status === 'publishing') {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPublishProgressOpen, publishStatus.status]);

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
  const [tiktokPostMode, setTiktokPostMode] = useState<TikTokPostMode>("direct");
  const [tiktokType, setTiktokType] = useState<"video" | "photo">("video");

  const [linkedinFirstComment, setLinkedinFirstComment] = useState("");
  const [linkedinType, setLinkedinType] = useState<string>("post");

  const [pinterestTitle, setPinterestTitle] = useState("");
  const [pinterestLink, setPinterestLink] = useState("");
  const [pinterestType, setPinterestType] = useState<string>("pin");
  // Board choice per Pinterest account. Board ids are account-scoped, so this is
  // keyed by socialAccountId rather than being a single flat value.
  const [pinterestBoards, setPinterestBoards] = useState<Record<string, PinterestBoardState>>({});

  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeType, setYoutubeType] = useState<"short" | "video">("short");
  const [youtubePrivacy, setYoutubePrivacy] = useState<string>("public");
  const [threadsTopic, setThreadsTopic] = useState("");
  const [threadsLocation, setThreadsLocation] = useState("");
  const [threadsType, setThreadsType] = useState<string>("post");
  const [xType, setXType] = useState<string>("post");

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
      const [postsData, clientsData, campaignsData, teamData, socialAccountsData] = await Promise.all([
        apiFetch<{ posts: SocialPost[] }>("/social/posts?limit=1000"),
        apiFetch<any>("/clients"),
        apiFetch<any>("/social/campaigns"),
        apiFetch<any>("/team"),
        apiFetch<any>("/social/accounts?limit=1000").catch(() => null),
      ]);
      setPosts(postsData?.posts || []);
      const clientsList = Array.isArray(clientsData)
        ? clientsData
        : (clientsData && Array.isArray(clientsData.clients) ? clientsData.clients : []);
      setClients(clientsList);
      setCampaigns(campaignsData || []);
      setTeamMembers(teamData?.team || []);

      const accs = Array.isArray(socialAccountsData)
        ? socialAccountsData
        : (socialAccountsData?.accounts || []);
      const accountClientIds = new Set<string>();
      accs.forEach((acc: any) => {
        if (acc.clientId) accountClientIds.add(acc.clientId);
      });
      setClientIdsWithAccounts(accountClientIds);
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
        type: isVideo ? "video" : "image",
        loadedBytes: 0,
        totalBytes: file.size,
        speedBps: null,
        etaSeconds: null,
      };

      setUploadProgressFiles(prev => [...prev, newUploadFile]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const tracker = createUploadTracker(performance.now());
        let lastPaintedPct = -1;
        let lastPaintAt = 0;

        const data = await apiUpload<{ url: string }>(
          "/social/media/upload",
          formData,
          (percent, { loaded, total }) => {
            const now = performance.now();
            const s = tracker.sample(loaded, total, now);

            // The browser fires hundreds of progress events on a large video;
            // repaint only when the percentage moves or ~250ms has passed.
            if (!s.isTransferComplete && percent === lastPaintedPct && now - lastPaintAt < 250) return;
            lastPaintedPct = percent;
            lastPaintAt = now;

            setUploadProgressFiles(prev => prev.map(f => {
              // "processing" is not terminal here: a 401 mid-upload makes
              // apiUpload re-send the whole file, and those bytes have to be
              // able to pull the tile back out of the processing state.
              if (f.id !== uploadId || (f.status !== "uploading" && f.status !== "processing")) return f;
              // Once the bytes are all on the wire the API is still streaming
              // them to storage, so switch to "processing" rather than leaving a
              // full bar sitting there looking frozen.
              return {
                ...f,
                status: s.isTransferComplete ? "processing" : "uploading",
                progress: s.progress,
                loadedBytes: s.loadedBytes,
                totalBytes: s.totalBytes,
                speedBps: s.speedBps,
                etaSeconds: s.isTransferComplete ? null : s.etaSeconds,
              };
            }));
          }
        );

        setComposerMediaUrls(prev => [...prev, data.url]);
        if (isVideo) {
          setComposerMediaType("video");
        }

        setUploadProgressFiles(prev => prev.map(f => {
          if (f.id === uploadId) {
            return { ...f, progress: 100, status: "done", url: data.url, etaSeconds: null };
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
    // Let the same file be re-picked after a failure; without this the input
    // keeps the old value and the change event never fires again.
    e.target.value = "";
  };

  const loadPinterestBoards = useCallback(async (accountId: string) => {
    setPinterestBoards(prev => ({
      ...prev,
      [accountId]: { boards: [], selectedId: null, ...prev[accountId], loading: true, error: null },
    }));
    try {
      const res = await apiFetch<{ boards: { id: string; name: string }[] }>(
        `/social/accounts/${accountId}/pinterest/boards`
      );
      setPinterestBoards(prev => ({
        ...prev,
        [accountId]: {
          boards: res.boards || [],
          selectedId: prev[accountId]?.selectedId ?? null,
          loading: false,
          error: null,
        },
      }));
    } catch (err: any) {
      setPinterestBoards(prev => ({
        ...prev,
        [accountId]: {
          boards: [],
          selectedId: prev[accountId]?.selectedId ?? null,
          loading: false,
          error: err.message || "Could not load boards",
        },
      }));
    }
  }, []);

  const setPinterestBoard = (accountId: string, boardId: string | null) => {
    setPinterestBoards(prev => ({
      ...prev,
      [accountId]: { boards: [], loading: false, error: null, ...prev[accountId], selectedId: boardId },
    }));
  };

  // Fetch boards for each selected Pinterest account, once per account.
  useEffect(() => {
    if (!isComposerOpen) return;
    for (const acct of accounts) {
      if (acct.platform.toLowerCase() !== "pinterest") continue;
      if (!composerAccounts.includes(acct.id)) continue;
      if (pinterestBoards[acct.id]) continue;
      loadPinterestBoards(acct.id);
    }
  }, [isComposerOpen, composerAccounts, accounts, pinterestBoards, loadPinterestBoards]);

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
    setTiktokAutomatic("automatic");
    setTiktokPostMode("direct");
    setTiktokType("video");
    setLinkedinFirstComment("");
    setLinkedinType("post");
    setXType("post");
    setThreadsTopic("");
    setThreadsLocation("");
    setThreadsType("post");
    setPinterestTitle("");
    setPinterestLink("");
    setPinterestType("pin");
    setPinterestBoards({});
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
      case "pinterest": return <img src="/social-icons/pinterest.png" className={className} alt="Pinterest" />;
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

    // Catch content-type/media mismatches (e.g. a Reel with no video attached)
    // before submitting, instead of letting the platform reject it mid-publish
    // after other destinations may have already gone live.
    if (!asDraft) {
      const selectedPlatforms = new Set(
        accounts.filter(a => composerAccounts.includes(a.id)).map(a => a.platform.toLowerCase())
      );
      const typeByPlatform: Record<string, string> = {
        instagram: instagramType,
        facebook: facebookType,
        tiktok: tiktokType,
        youtube: youtubeType,
      };
      for (const platform of selectedPlatforms) {
        const typeId = typeByPlatform[platform];
        if (!typeId) continue;
        const contentType = contentTypesFor(platform).find(t => t.id === typeId);
        const mediaError = validateContentTypeMedia(contentType, composerMediaUrls, composerMediaType);
        if (mediaError) {
          toast({
            title: "Validation Error",
            description: `${platform[0].toUpperCase()}${platform.slice(1)}: ${mediaError}`,
            variant: "destructive",
          });
          return;
        }
      }
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
            type: tiktokType,
            automatic: tiktokAutomatic,
            postMode: tiktokPostMode,
          },
          linkedin: {
            caption: getPlatformCaption("linkedin"),
            firstComment: linkedinFirstComment
          },
          pinterest: {
            caption: getPlatformCaption("pinterest"),
            title: pinterestTitle,
            link: pinterestLink,
            type: pinterestType,
            // Keyed by socialAccountId — a board id only exists on the account
            // that owns it, so two Pinterest accounts cannot share one value.
            boards: Object.fromEntries(
              Object.entries(pinterestBoards)
                .filter(([, s]) => s.selectedId)
                .map(([accountId, s]) => [
                  accountId,
                  { id: s.selectedId, name: s.boards.find(b => b.id === s.selectedId)?.name || "" },
                ])
            )
          },
          youtube: {
            caption: getPlatformCaption("youtube"),
            title: youtubeTitle,
            type: youtubeType,
            privacy: youtubePrivacy
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
        // composerScheduledFor is a timezone-less "datetime-local" string (the
        // browser's own local wall-clock reading). Re-parsing it as a Date
        // interprets it in the browser's timezone (correct), then toISOString()
        // converts to an unambiguous UTC timestamp the server can parse the same
        // way regardless of which timezone it runs in.
        scheduledFor: (publishNow || asDraft) ? null : (composerScheduledFor ? new Date(composerScheduledFor).toISOString() : null),
        status: asDraft ? "DRAFT" : (publishNow ? "PUBLISHED" : "SCHEDULED"),
      };

      if (publishNow && !asDraft) {
        let createdPostId = editingPostId;

        // Already-published destinations must not be re-sent. Backend also skips
        // them, but we only target unpublished accounts from the client.
        const publishTargetAccountIds = composerAccounts.filter(
          (id) => !alreadyPublishedAccountIds.includes(id),
        );

        if (editingPostId && publishTargetAccountIds.length === 0) {
          toast({
            title: "Nothing to publish",
            description: "All selected accounts were already published. Use Retry only for failed platforms, or pick additional accounts.",
          });
          return;
        }
        
        if (editingPostId) {
          await apiFetch<any>(`/social/posts/${editingPostId}`, {
            method: "PUT",
            body: JSON.stringify({ ...payload, status: "DRAFT" }),
          });
        } else {
          const post = await apiFetch<SocialPost>("/social/posts", {
            method: "POST",
            body: JSON.stringify({ ...payload, status: "DRAFT" }),
          });
          createdPostId = post.id;
        }

        if (!createdPostId) {
          throw new Error("Could not determine post ID");
        }

        const progressAccountIds =
          publishTargetAccountIds.length > 0 ? publishTargetAccountIds : composerAccounts;

        // Close composer, reset form, and reload background list immediately
        setIsComposerOpen(false);
        resetComposer();
        fetchData();

        // Initialize and open publishing progress modal
        setIsPublishProgressOpen(true);
        setPublishStatus({
          postId: createdPostId,
          status: 'publishing',
          totalDestinations: progressAccountIds.length,
          completedDestinations: 0,
          failedDestinations: 0,
          destinations: progressAccountIds.map(accId => {
            const acc = accounts.find(a => a.id === accId);
            return {
              id: accId,
              platform: acc?.platform || 'UNKNOWN',
              accountName: acc?.displayName || acc?.platformUsername || 'Unknown Account',
              avatarUrl: acc?.avatarUrl ?? null,
              status: 'QUEUED',
              error: null
            };
          })
        });

        // Start background status polling
        const pollInterval = setInterval(async () => {
          try {
            const updatedPost = await apiFetch<SocialPost>(`/social/posts/${createdPostId}`);
            if (updatedPost && updatedPost.destinations) {
              const relevant = updatedPost.destinations.filter(
                (d) => progressAccountIds.includes(d.socialAccountId) || d.status === 'PUBLISHING' || d.status === 'FAILED',
              );
              const tracked = relevant.length > 0 ? relevant : updatedPost.destinations;
              const total = tracked.length;
              const completed = tracked.filter(d => d.status === 'PUBLISHED').length;
              const failed = tracked.filter(d => d.status === 'FAILED').length;
              
              setPublishStatus(prev => ({
                ...prev,
                postId: createdPostId,
                totalDestinations: total,
                completedDestinations: completed,
                failedDestinations: failed,
                destinations: tracked.map(d => ({
                  id: d.id,
                  platform: d.platform,
                  accountName: d.socialAccount?.displayName || d.socialAccount?.platformUsername || 'Unknown Account',
                  avatarUrl: d.socialAccount?.avatarUrl ?? null,
                  status: d.status,
                  error: d.lastError,
                  platformPostId: d.platformPostId
                }))
              }));
            }
          } catch (pollErr) {
            console.error("Polling error", pollErr);
          }
        }, 1500);

        try {
          // Trigger the synchronous publish-now API call (unpublished targets only)
          const finalPost = await apiFetch<SocialPost>(`/social/posts/${createdPostId}/publish-now`, {
            method: "POST",
            body: JSON.stringify({ accountIds: progressAccountIds }),
          });
          clearInterval(pollInterval);

          const total = finalPost.destinations.length;
          const completed = finalPost.destinations.filter(d => d.status === 'PUBLISHED').length;
          const failed = finalPost.destinations.filter(d => d.status === 'FAILED').length;
          
          setPublishStatus(prev => ({
            ...prev,
            status: failed > 0 ? 'failed' : 'success',
            completedDestinations: completed,
            failedDestinations: failed,
            destinations: finalPost.destinations.map(d => ({
              id: d.id,
              platform: d.platform,
              accountName: d.socialAccount?.displayName || d.socialAccount?.platformUsername || 'Unknown Account',
                  avatarUrl: d.socialAccount?.avatarUrl ?? null,
              status: d.status,
              error: d.lastError,
              platformPostId: d.platformPostId
            }))
          }));

          fetchData(); // Final refresh of dashboard

          if (failed > 0 && completed > 0) {
            toast({
              title: "Partially Published",
              description: `${completed} platform(s) went live. Failed: ${finalPost.errorMessage || 'see destination errors'}. Use Retry for failed accounts only.`,
              variant: "destructive",
            });
          } else if (failed > 0) {
            toast({ 
              title: "Publishing Finished with Errors", 
              description: `Some destinations failed: ${finalPost.errorMessage || ''}`, 
              variant: "destructive" 
            });
          } else {
            const hasTikTokDraft = finalPost.destinations?.some(d => isTikTokDraft(d, finalPost.platformContent));
            toast({ 
              title: hasTikTokDraft ? "Saved to TikTok Drafts" : "Post Published", 
              description: hasTikTokDraft 
                ? "Uploaded to your TikTok mobile inbox! Open the TikTok app on your phone to complete & post."
                : "Your post has been distributed to selected accounts" 
            });
            setTimeout(() => {
              setIsPublishProgressOpen(false);
            }, 3000);
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setPublishStatus(prev => ({
            ...prev,
            status: 'failed'
          }));
          fetchData(); // Make sure dashboard is updated
          throw err;
        }
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
        setIsComposerOpen(false);
        resetComposer();
        fetchData();
      }
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
      const existing = posts.find((p) => p.id === postId);
      const failedDests = (existing?.destinations || []).filter((d) => d.status === "FAILED");
      if (failedDests.length === 0) {
        toast({ title: "Nothing to retry", description: "No failed platforms on this post." });
        return;
      }

      setIsPublishProgressOpen(true);
      setPublishStatus({
        postId,
        status: "publishing",
        totalDestinations: failedDests.length,
        completedDestinations: 0,
        failedDestinations: 0,
        destinations: failedDests.map((d) => ({
          id: d.id,
          platform: d.platform,
          accountName: d.socialAccount?.displayName || d.socialAccount?.platformUsername || "Unknown Account",
          avatarUrl: d.socialAccount?.avatarUrl ?? null,
          status: "QUEUED",
          error: null,
        })),
      });

      const finalPost = await apiFetch<SocialPost>(`/social/posts/${postId}/retry`, { method: "POST" });
      const tracked = finalPost.destinations.filter((d) =>
        failedDests.some((f) => f.socialAccountId === d.socialAccountId) || d.status === "FAILED",
      );
      const completed = tracked.filter((d) => d.status === "PUBLISHED").length;
      const failed = tracked.filter((d) => d.status === "FAILED").length;

      setPublishStatus({
        postId,
        status: failed > 0 ? "failed" : "success",
        totalDestinations: tracked.length,
        completedDestinations: completed,
        failedDestinations: failed,
        destinations: tracked.map((d) => ({
          id: d.id,
          platform: d.platform,
          accountName: d.socialAccount?.displayName || d.socialAccount?.platformUsername || "Unknown Account",
          avatarUrl: d.socialAccount?.avatarUrl ?? null,
          status: d.status,
          error: d.lastError,
          platformPostId: d.platformPostId,
        })),
      });

      toast({
        title: failed > 0 ? "Retry Finished with Errors" : "Retry Complete",
        description: failed > 0
          ? `Still failing: ${finalPost.errorMessage || "see destination errors"}`
          : "Failed platforms were published successfully",
        variant: failed > 0 ? "destructive" : undefined,
      });
      fetchData();
    } catch (err: any) {
      setPublishStatus((prev) => ({ ...prev, status: "failed" }));
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
      setTiktokPostMode(pc.tiktok.postMode || "direct");
      setTiktokType(pc.tiktok.type || "video");
    }
    if (pc.linkedin) {
      setLinkedinFirstComment(pc.linkedin.firstComment || "");
      setLinkedinType(pc.linkedin.type || "post");
    }
    if (pc.x) {
      setXType(pc.x.type || "post");
    }
    if (pc.youtube) {
      setYoutubeTitle(pc.youtube.title || "");
      setYoutubeType(pc.youtube.type || "short");
      setYoutubePrivacy(pc.youtube.privacy || "public");
    } else {
      setYoutubePrivacy("public");
    }
    if (pc.threads) {
      setThreadsTopic(pc.threads.topic || "");
      setThreadsLocation(pc.threads.location || "");
      setThreadsType(pc.threads.type || "post");
    }
    if (pc.pinterest) {
      setPinterestTitle(pc.pinterest.title || "");
      setPinterestLink(pc.pinterest.link || "");
      setPinterestType(pc.pinterest.type || "pin");
      // Seed the saved choice; the board list itself is refetched when the
      // composer opens, which then fills in the names.
      const saved = pc.pinterest.boards || {};
      setPinterestBoards(
        Object.fromEntries(
          Object.entries(saved).map(([accountId, b]: [string, any]) => [
            accountId,
            { boards: b?.name ? [{ id: b.id, name: b.name }] : [], selectedId: b?.id || null, loading: false, error: null },
          ])
        )
      );
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
      // Send ONLY what this action changes. Anything omitted is left untouched by
      // the server, so a stale copy of the post in local state can no longer
      // clobber a caption, media list or destination someone else just edited.
      const payload = {
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
        // Only promote a draft. Re-sending the current status would write a stale
        // value back over whatever the scheduler has since set.
        status: postToUpdate.status === "DRAFT" ? "SCHEDULED" : undefined,
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
      // Send ONLY what this action changes. Anything omitted is left untouched by
      // the server, so a stale copy of the post in local state can no longer
      // clobber a caption, media list or destination someone else just edited.
      const payload = {
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
        // Only promote a draft. Re-sending the current status would write a stale
        // value back over whatever the scheduler has since set.
        status: postToUpdate.status === "DRAFT" ? "SCHEDULED" : undefined,
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
      // A comment changes nothing but platformContent. It used to resend status,
      // scheduledFor and the account list too, which is how commenting on a post
      // whose destinations had already FAILED could quietly re-queue and republish it.
      const payload = { platformContent: updatedPc };
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
            status: newStatus
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
            }
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
  const hasUploadedMedia = composerMediaUrls.length > 0 || uploadProgressFiles.some(f => f.status === "uploading" || f.status === "processing");

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
              {clientsWithAccounts.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
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
              {["DRAFT", "AWAITING_APPROVAL", "SCHEDULED", "PUBLISHED", "PARTIAL", "FAILED"].map(s => (
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
                <PostGrid
                  filteredPosts={filteredPosts}
                  viewMode={viewMode}
                  selectedPostIds={selectedPostIds}
                  activePostId={activePostId}
                  setActivePostId={setActivePostId}
                  setIsReschedulingOpen={setIsReschedulingOpen}
                  setIsComposerOpen={setIsComposerOpen}
                  resetAllFilters={resetAllFilters}
                  resetComposer={resetComposer}
                  handleToggleSelect={handleToggleSelect}
                  handleEditPost={handleEditPost}
                  handleDuplicatePost={handleDuplicatePost}
                  handleDeletePost={handleDeletePost}
                  getMediaUrls={getMediaUrls}
                  getClientDetails={getClientDetails}
                  getContentTypeLabel={getContentTypeLabel}
                  getCampaignName={getCampaignName}
                  getWriterName={getWriterName}
                  getPlatformIcon={getPlatformIcon}
                />
              )}

              {/* ── CALENDAR VIEW ── */}
              {activeTab === "calendar" && (
                <CalendarViews
                  calendarView={calendarView}
                  calendarDate={calendarDate}
                  setCalendarDate={setCalendarDate}
                  calendarCells={calendarCells}
                  filteredPosts={filteredPosts}
                  activePostId={activePostId}
                  setActivePostId={setActivePostId}
                  resetComposer={resetComposer}
                  setComposerScheduledFor={setComposerScheduledFor}
                  setPublishNow={setPublishNow}
                  setIsComposerOpen={setIsComposerOpen}
                  handleReschedulePost={handleReschedulePost}
                  handleReschedulePostWithTime={handleReschedulePostWithTime}
                  getClientDetails={getClientDetails}
                  getPlatformIcon={getPlatformIcon}
                />
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
                  {formatPostStatus(activePost.status)}
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
                      {isTikTokDraft(d, activePost.platformContent) ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border rounded-full bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/40">
                            Draft in TikTok App
                          </span>
                        </div>
                      ) : (
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border rounded-full ${d.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40" :
                            d.status === "FAILED" ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40" :
                              "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800"
                          }`}>{d.status}</span>
                      )}
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
            <Select onValueChange={v => { handleBulkChangeStatus(v); }}>
              <SelectTrigger size="xs" className="w-auto bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600 shadow-none">
                <SelectValue placeholder="Change Status..." />
              </SelectTrigger>
              <SelectContent>
                {/* PUBLISHED intentionally excluded — this just PUTs a status field with
                    no actual publish call, so it would mark posts as live without ever
                    posting them, corrupting publishing stats and client reports. */}
                {["DRAFT", "AWAITING_APPROVAL", "SCHEDULED"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={v => { handleBulkMoveSchedule(Number(v)); }}>
              <SelectTrigger size="xs" className="w-auto bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600 shadow-none">
                <SelectValue placeholder="Shift Schedule..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">+1 Day</SelectItem><SelectItem value="2">+2 Days</SelectItem><SelectItem value="7">+1 Week</SelectItem>
                <SelectItem value="-1">-1 Day</SelectItem><SelectItem value="-7">-1 Week</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={v => { handleBulkAssignWriter(v); }}>
              <SelectTrigger size="xs" className="w-auto bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:border-slate-600 shadow-none">
                <SelectValue placeholder="Assign Writer..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
      <PostComposer
        isComposerOpen={isComposerOpen}
        handleOpenChange={handleOpenChange}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        editingPostId={editingPostId}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        isTagsOpen={isTagsOpen}
        setIsTagsOpen={setIsTagsOpen}
        postTags={postTags}
        setPostTags={setPostTags}
        syncedPlatforms={syncedPlatforms}
        setIsAiOpen={setIsAiOpen}
        composerClient={composerClient}
        setComposerClient={setComposerClient}
        clientsWithAccounts={clientsWithAccounts}
        clients={clients}
        navigate={navigate}
        composerCampaign={composerCampaign}
        setComposerCampaign={setComposerCampaign}
        setIsCampaignDialogOpen={setIsCampaignDialogOpen}
        campaigns={campaigns}
        accounts={accounts}
        composerAccounts={composerAccounts}
        setComposerAccounts={setComposerAccounts}
        alreadyPublishedAccountIds={alreadyPublishedAccountIds}
        selectedPlatforms={selectedPlatforms}
        setSelectedPlatforms={setSelectedPlatforms}
        activePlatform={activePlatform}
        setActivePlatform={setActivePlatform}
        setExpandedComposerPlatform={setExpandedComposerPlatform}
        getPlatformIcon={getPlatformIcon}
        composerCaption={composerCaption}
        setComposerCaption={setComposerCaption}
        isEmojiOpen={isEmojiOpen}
        setIsEmojiOpen={setIsEmojiOpen}
        handleMediaUpload={handleMediaUpload}
        composerMediaUrls={composerMediaUrls}
        setComposerMediaUrls={setComposerMediaUrls}
        composerMediaType={composerMediaType}
        uploadProgressFiles={uploadProgressFiles}
        expandedComposerPlatform={expandedComposerPlatform}
        getPlatformCaption={getPlatformCaption}
        getCharLimitForPlatform={getCharLimitForPlatform}
        setPlatformCaption={setPlatformCaption}
        togglePlatformSync={togglePlatformSync}
        instagramType={instagramType}
        setInstagramType={setInstagramType}
        facebookType={facebookType}
        setFacebookType={setFacebookType}
        youtubeType={youtubeType}
        setYoutubeType={setYoutubeType}
        tiktokType={tiktokType}
        setTiktokType={setTiktokType}
        linkedinType={linkedinType}
        setLinkedinType={setLinkedinType}
        xType={xType}
        setXType={setXType}
        threadsType={threadsType}
        setThreadsType={setThreadsType}
        pinterestType={pinterestType}
        pinterestTitle={pinterestTitle}
        setPinterestTitle={setPinterestTitle}
        pinterestLink={pinterestLink}
        setPinterestLink={setPinterestLink}
        pinterestBoards={pinterestBoards}
        loadPinterestBoards={loadPinterestBoards}
        setPinterestBoard={setPinterestBoard}
        setPinterestType={setPinterestType}
        tiktokPostMode={tiktokPostMode}
        setTiktokPostMode={setTiktokPostMode}
        instagramMusic={instagramMusic}
        setInstagramMusic={setInstagramMusic}
        instagramTagProducts={instagramTagProducts}
        setInstagramTagProducts={setInstagramTagProducts}
        instagramFirstComment={instagramFirstComment}
        setInstagramFirstComment={setInstagramFirstComment}
        facebookFirstComment={facebookFirstComment}
        setFacebookFirstComment={setFacebookFirstComment}
        linkedinFirstComment={linkedinFirstComment}
        setLinkedinFirstComment={setLinkedinFirstComment}
        tiktokTitle={tiktokTitle}
        setTiktokTitle={setTiktokTitle}
        youtubeTitle={youtubeTitle}
        setYoutubeTitle={setYoutubeTitle}
        youtubePrivacy={youtubePrivacy}
        setYoutubePrivacy={setYoutubePrivacy}
        threadsTopic={threadsTopic}
        setThreadsTopic={setThreadsTopic}
        publishNow={publishNow}
        setPublishNow={setPublishNow}
        isSubmitting={isSubmitting}
        composerScheduledFor={composerScheduledFor}
        setComposerScheduledFor={setComposerScheduledFor}
        handleCreatePost={handleCreatePost}
        submitType={submitType}
        isUploading={isUploading}
      />


      {/* Social Publishing Progress Modal */}
      <PublishProgressDialog
        open={isPublishProgressOpen}
        onClose={() => setIsPublishProgressOpen(false)}
        status={publishStatus}
        elapsedSeconds={elapsedSeconds}
        isTikTokDraft={(dest) => isTikTokDraft(dest)}
      />

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
              <Select value={aiTargetPlatform} onValueChange={setAiTargetPlatform}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram (Engaging, hashtags, spacing)</SelectItem>
                  <SelectItem value="facebook">Facebook (Friendly, informational)</SelectItem>
                  <SelectItem value="linkedin">LinkedIn (Professional, thought-provoking)</SelectItem>
                  <SelectItem value="x">X / Twitter (Short, high impact)</SelectItem>
                  <SelectItem value="tiktok">TikTok (Trendy, short, action-focused)</SelectItem>
                </SelectContent>
              </Select>
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
export interface PreviewCardProps {
  platform: string;
  text: string;
  image: string | null;
  mediaType?: string;
  accountName?: string;
  platformUsername?: string;
  avatarUrl?: string | null;
  postType?: string;
}

export function PreviewCard({ platform, text, image, mediaType = "image", accountName, platformUsername, avatarUrl, postType = "post" }: PreviewCardProps) {
  const avatar = avatarUrl || "https://api.dicebear.com/7.x/identicon/svg?seed=hirdanmarketing";
  const displayName = accountName || "Your Account";
  const handle = platformUsername || displayName.toLowerCase().replace(/\s+/g, "");

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
