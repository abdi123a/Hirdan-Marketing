import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { 
  Plus, Calendar, Clock, RefreshCw, Trash2, Sparkles, Image as ImageIcon, Loader2, Heart, MessageSquare, Share2, HelpCircle, ArrowLeft, X, Settings,
  Tag, Tags, ChevronDown, Zap, Music, ShoppingBag, Eye, Link as LinkIcon, Link2, Link2Off, Maximize2, Minimize2, ChevronUp, MoreHorizontal, Search, Disc, Volume2, Smile, FileText, Check, Bookmark,
  ImagePlus, Hash, ThumbsUp, ThumbsDown, MessageCircle, Repeat2, Send, Play, BarChart2, MapPin, Info, SquarePen
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
  destinations: Array<{
    id: string;
    socialAccountId: string;
    platform: string;
    status: string;
    lastError: string | null;
    socialAccount: { displayName: string };
  }>;
}

interface SocialAccount {
  id: string;
  platform: string;
  displayName: string;
  platformUsername: string;
}

interface Client {
  id: string;
  name: string;
  company: string;
}

interface UploadProgressFile {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "failed";
  url?: string;
  type: string;
}

export default function SocialPublishPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active filter state
  const [activeTab, setActiveTab] = useState<"posts" | "calendar">("posts");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Composer modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [composerClient, setComposerClient] = useState("");
  const [composerCaption, setComposerCaption] = useState("");
  const [composerMediaUrls, setComposerMediaUrls] = useState<string[]>([]);
  const [composerMediaType, setComposerMediaType] = useState("image");
  const [composerAccounts, setComposerAccounts] = useState<string[]>([]);
  const [composerScheduledFor, setComposerScheduledFor] = useState("");
  const [publishNow, setPublishNow] = useState(true);

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
  const [threadsTopic, setThreadsTopic] = useState("");
  const [threadsLocation, setThreadsLocation] = useState("");

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = statusFilter === "ALL" ? "/social/posts" : `/social/posts?status=${statusFilter}`;
      const [postsData, clientsData] = await Promise.all([
        apiFetch<{ posts: SocialPost[] }>(url),
        apiFetch<any>("/clients"),
      ]);
      setPosts(postsData?.posts || []);
      const clientsList = Array.isArray(clientsData)
        ? clientsData
        : (clientsData && Array.isArray(clientsData.clients) ? clientsData.clients : []);
      setClients(clientsList);
    } catch (err: any) {
      toast({
        title: "Error loading posts",
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

  const handleCreatePost = async (asDraft = false) => {
    if (!composerClient) {
      toast({
        title: "Validation Error",
        description: "Choose a client first",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        clientId: composerClient,
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
            title: youtubeTitle 
          },
          x: {
            caption: getPlatformCaption("x")
          },
          threads: {
            caption: getPlatformCaption("threads")
          },
          tags: postTags,
          syncedPlatforms
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
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await apiFetch<any>(`/social/posts/${postId}`, { method: "DELETE" });
      toast({ title: "Post Deleted", description: "Queue item removed successfully" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleEditPost = (post: SocialPost) => {
    setEditingPostId(post.id);
    setComposerClient(post.clientId);
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
    
    // Parse platform specific contents
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

    const validPlatforms = ["x", "facebook", "instagram", "linkedin", "tiktok", "youtube", "threads"];
    const platList = Array.from(
      new Set(
        (post.destinations || [])
          .map(d => (d.platform || "").toLowerCase())
          .filter(plat => validPlatforms.includes(plat))
      )
    );
    setSelectedPlatforms(platList);
    setActivePlatform(platList.length > 0 ? platList[0] : "");

    setIsComposerOpen(true);
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
    setIsEmojiOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
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
      } catch (e) {}
      return [post.mediaUrls];
    }
    return [];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Publisher</h1>
          <p className="text-sm text-muted-foreground">Draft, schedule, and review client social media posts across 8 platforms.</p>
        </div>
        <Button onClick={() => setIsComposerOpen(true)} className="rounded-xl flex items-center gap-2 px-5 py-2.5 shadow-md">
          <Plus className="h-5 w-5" />
          <span className="font-semibold text-sm">Create New Post</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/80">
        <button
          onClick={() => setActiveTab("posts")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all ${
            activeTab === "posts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Posts List
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all ${
            activeTab === "calendar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Calendar Schedule
        </button>
      </div>

      {activeTab === "posts" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {["ALL", "DRAFT", "AWAITING_APPROVAL", "SCHEDULED", "PUBLISHED", "FAILED"].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  statusFilter === f 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading posts list...</span>
            </div>
          ) : posts.length === 0 ? (
            <Card className="border-dashed py-16 text-center text-muted-foreground">
              No posts matching filters found.
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => {
                const mediaUrls = getMediaUrls(post);
                const hasMedia = mediaUrls.length > 0;
                
                return (
                  <Card key={post.id} className="rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between border border-border/80 hover:shadow-md transition-shadow bg-card">
                    <div>
                      {hasMedia && (
                        <div className="relative aspect-video bg-muted border-b border-border/40 flex items-center justify-center overflow-hidden">
                          {post.mediaType === "video" ? (
                            <video src={mediaUrls[0]} className="h-full w-full object-cover" controls />
                          ) : (
                            <img src={mediaUrls[0]} alt="Media thumbnail" className="h-full w-full object-cover" />
                          )}
                          <span className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white px-2.5 py-1 rounded-full uppercase">
                            {post.mediaType || 'image'}
                          </span>
                        </div>
                      )}
                      <div className="p-5 space-y-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString() : (post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'Draft')}
                        </p>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">{post.caption}</p>
                        
                        <div className="pt-2 flex flex-wrap gap-1.5">
                          {(post.destinations || []).map((dest) => (
                            <div
                              key={dest.id}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                                dest.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                dest.status === 'FAILED' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-slate-50 text-slate-600 border-slate-100'
                              }`}
                              title={dest.lastError || dest.status}
                            >
                              {getPlatformIcon(dest.platform, "h-3.5 w-3.5 object-contain")}
                              <span className="capitalize">{dest.platform}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-muted/10 border-t border-border/40 flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                        post.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        post.status === 'FAILED' ? 'bg-red-100 text-red-700 border border-red-200' :
                        post.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {post.status.replace("_", " ")}
                      </span>
                      <div className="flex gap-2">
                        {post.status === 'FAILED' && (
                          <Button variant="outline" size="sm" onClick={() => handleRetryPost(post.id)} className="h-8 text-xs font-semibold rounded-xl border-border px-3">
                            Retry
                          </Button>
                        )}
                        {post.status !== 'PUBLISHED' && (
                          <Button variant="ghost" size="icon" onClick={() => handleEditPost(post)} className="h-8.5 w-8.5 rounded-xl text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100" title="Edit Post">
                            <SquarePen className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)} className="h-8.5 w-8.5 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50/50" title="Delete Post">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "calendar" && (
        <Card className="p-6 rounded-2xl border border-border/80 shadow-sm bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Content Schedule Grid</h3>
          </div>
          <div className="grid grid-cols-7 border-t border-l border-border mt-6 rounded-xl overflow-hidden">
            {Array.from({ length: 35 }).map((_, i) => {
              const day = i - 3;
              const hasPost = day > 0 && posts.some(p => {
                if (!p.scheduledFor) return false;
                const d = new Date(p.scheduledFor);
                return !isNaN(d.getTime()) && d.getDate() === day;
              });
              
              return (
                <div key={i} className="min-h-24 p-2.5 border-b border-r border-border hover:bg-muted/10 transition-colors bg-card">
                  <span className="text-[10px] font-bold text-muted-foreground/60">{day > 0 && day <= 30 ? day : ""}</span>
                  {hasPost && (
                    <div className="mt-2 space-y-1">
                      {posts.filter(p => {
                        if (!p.scheduledFor) return false;
                        const d = new Date(p.scheduledFor);
                        return !isNaN(d.getTime()) && d.getDate() === day;
                      }).map(p => (
                        <div key={p.id} className="text-[10px] bg-primary/10 text-primary px-2 py-1.5 rounded-lg font-semibold truncate leading-none border border-primary/20">
                          {p.caption}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Redesigned Composer Dialog matching user mockups */}
      <Dialog open={isComposerOpen} onOpenChange={handleOpenChange}>
        <DialogContent className={`rounded-3xl overflow-hidden p-0 max-h-[94vh] flex flex-col bg-background border border-border transition-all duration-300 ${showPreview ? "max-w-5xl md:max-w-6xl w-full" : "max-w-2xl w-full"} ${isFullscreen ? "max-w-[98vw] h-[95vh]" : ""}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-neutral-200 shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-neutral-900">
                {editingPostId ? "Edit Post" : "Create Post"}
              </h1>
              
              {/* Tags Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTagsOpen(!isTagsOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer bg-transparent"
                >
                  <Tags size={15} /> Tags <ChevronDown size={14} />
                </button>
                
                {isTagsOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-background border border-border rounded-xl shadow-lg p-2.5 z-50 space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Select tags</p>
                    {["Marketing", "Social", "Promo", "Announcement", "Event", "Update"].map(tag => {
                      const isChecked = postTags.includes(tag);
                      return (
                        <label key={tag} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) setPostTags(prev => prev.filter(t => t !== tag));
                              else setPostTags(prev => [...prev, tag]);
                            }}
                            className="accent-emerald-500 rounded"
                          />
                          <span>{tag}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors ${
                  showPreview ? "bg-emerald-100 text-emerald-700 font-semibold" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                <Eye size={15} /> Preview
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-neutral-400 hover:text-neutral-700 bg-transparent border-none cursor-pointer"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left: composer */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              {/* Choose Client selector on top */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-neutral-500 text-left">Choose Client</label>
                <select
                  value={composerClient}
                  onChange={(e) => setComposerClient(e.target.value)}
                  className="w-full border border-neutral-200 bg-background rounded-lg p-2.5 text-sm outline-none focus:border-emerald-400 cursor-pointer font-medium"
                >
                  <option value="">Select a Client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
              </div>

              {/* Connected Social Accounts Row (only visible after a client is selected) */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-neutral-500 text-left">Publish to</label>
                {!composerClient ? (
                  <div className="text-xs text-neutral-400 italic bg-neutral-50 rounded-xl p-4 border border-dashed border-neutral-200 text-center">
                    Select a client above to view their integrated social media accounts.
                  </div>
                ) : accounts.length > 0 ? (
                  <div className="flex gap-3 select-none flex-wrap">
                    {accounts.map((account) => {
                      const platId = account.platform.toLowerCase();
                      const pConfig = PLATFORMS_CONFIG.find(p => p.id === platId) || {
                        label: account.platform,
                        color: "#8E8E93",
                        icon: HelpCircle
                      };
                      const Icon = pConfig.icon;
                      const isSelected = composerAccounts.includes(account.id);
                      
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            const isAccSelected = composerAccounts.includes(account.id);
                            if (isAccSelected) {
                              setComposerAccounts(prev => prev.filter(id => id !== account.id));
                              const remainingAccounts = composerAccounts.filter(id => id !== account.id);
                              const hasMoreOfPlat = accounts.some(acc => remainingAccounts.includes(acc.id) && acc.platform.toLowerCase() === platId);
                              if (!hasMoreOfPlat) {
                                setSelectedPlatforms(prev => prev.filter(p => p !== platId));
                                if (activePlatform === platId) {
                                  const remainingPlats = selectedPlatforms.filter(p => p !== platId);
                                  setActivePlatform(remainingPlats.length > 0 ? remainingPlats[0] : "");
                                }
                              }
                            } else {
                              setComposerAccounts(prev => [...prev, account.id]);
                              if (!selectedPlatforms.includes(platId)) {
                                setSelectedPlatforms(prev => [...prev, platId]);
                              }
                              setActivePlatform(platId);
                            }
                          }}
                          className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors cursor-pointer border shadow-sm"
                          style={{
                            backgroundColor: isSelected ? pConfig.color : "#F3F4F6",
                            color: isSelected ? "#fff" : "#4B5563",
                            borderColor: isSelected ? pConfig.color : "#E5E7EB",
                          }}
                          title={`${account.displayName || account.platformUsername || pConfig.label} (${account.platform})`}
                        >
                          <Icon className="w-5 h-5 shrink-0" style={{ color: isSelected ? "#fff" : pConfig.color }} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 italic bg-neutral-50 rounded-xl p-4 border border-dashed border-neutral-200 text-center">
                    No social accounts connected for this client. Please connect accounts in Social Accounts first.
                  </div>
                )}
              </div>


              {/* Selected Collapsed Rows (Render when multiple channels are selected) */}
              {selectedPlatforms.length > 1 && (
                <div className="space-y-2 mb-4">
                  {selectedPlatforms.filter(p => p !== activePlatform).map(plat => {
                    const captionSnippet = getPlatformCaption(plat);
                    return (
                      <div
                        key={plat}
                        onClick={() => setActivePlatform(plat)}
                        className="flex items-center justify-between p-3.5 bg-background hover:bg-neutral-50 border border-neutral-200 rounded-xl cursor-pointer transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1 rounded bg-neutral-100 flex items-center justify-center">
                            {getPlatformIcon(plat, "h-5 w-5 object-contain")}
                          </div>
                          <span className="text-xs text-neutral-500 truncate max-w-[200px] md:max-w-[320px]">
                            {captionSnippet || <span className="italic opacity-60">No caption written yet</span>}
                          </span>
                        </div>
                        {composerMediaUrls.length > 0 && (
                          <img src={composerMediaUrls[0]} alt="Thumbnail" className="h-8 w-8 rounded-lg object-cover border border-neutral-200" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active Platform Composer Card */}
              {activePlatform ? (
                <div className="border border-neutral-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const activeConf = PLATFORMS_CONFIG.find(p => p.id === activePlatform);
                      if (!activeConf) return null;
                      const ActiveIcon = activeConf.icon;
                      return <ActiveIcon className="w-5 h-5" style={{ color: activeConf.color }} />;
                    })()}
                    
                    {/* Option types for Instagram/Facebook/Threads */}
                    {activePlatform === "instagram" || activePlatform === "facebook" ? (
                      <div className="flex items-center gap-5 text-sm text-neutral-700 ml-2">
                        {["Post", "Reel", "Story"].map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="radio"
                              name={`${activePlatform}-type`}
                              checked={(activePlatform === "instagram" ? instagramType : facebookType) === opt.toLowerCase()}
                              onChange={() => {
                                if (activePlatform === "instagram") {
                                  setInstagramType(opt.toLowerCase() as any);
                                } else {
                                  setFacebookType(opt.toLowerCase() as any);
                                }
                              }}
                              className="sr-only"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border flex items-center justify-center relative transition-all"
                              style={{ borderColor: ((activePlatform === "instagram" ? instagramType : facebookType) === opt.toLowerCase()) ? "#10B981" : "#D1D5DB" }}
                            >
                              {((activePlatform === "instagram" ? instagramType : facebookType) === opt.toLowerCase()) && (
                                <span className="absolute inset-[2.5px] rounded-full bg-emerald-500" />
                              )}
                            </span>
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}

                    {activePlatform === "threads" ? (
                      <div className="flex items-center gap-5 text-sm text-neutral-700 ml-2">
                        {["Thread", "Ghost Post"].map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="threads-type"
                              checked={opt === "Thread"}
                              readOnly
                              className="sr-only"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border flex items-center justify-center relative transition-all"
                              style={{ borderColor: opt === "Thread" ? "#10B981" : "#D1D5DB" }}
                            >
                              {opt === "Thread" && (
                                <span className="absolute inset-[2.5px] rounded-full bg-emerald-500" />
                              )}
                            </span>
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}

                    {activePlatform === "youtube" ? (
                      <label className="flex items-center gap-1.5 text-sm text-neutral-700 ml-2 cursor-pointer select-none">
                        <span className="w-3.5 h-3.5 rounded-full border border-emerald-500 relative flex items-center justify-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                        <span>Short</span>
                      </label>
                    ) : null}
                  </div>

                  <textarea
                    value={getPlatformCaption(activePlatform)}
                    onChange={(e) => setPlatformCaption(activePlatform, e.target.value)}
                    placeholder="What would you like to share?"
                    rows={5}
                    className="w-full resize-none outline-none text-neutral-800 placeholder:text-neutral-400 mb-4 bg-transparent border-0 focus:ring-0 focus:outline-none"
                  />

                  {/* Media list */}
                  <div className="flex gap-3 mb-4 flex-wrap">
                    {composerMediaUrls.map((url, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 group border border-neutral-200">
                        {composerMediaType === "video" ? (
                          <video src={url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => setComposerMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 border-none cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => document.getElementById("media-file")?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center gap-1 text-center px-1 hover:border-emerald-400 shrink-0 cursor-pointer bg-transparent"
                    >
                      <ImagePlus size={20} className="text-neutral-400" />
                      <span className="text-[11px] text-neutral-500 leading-tight">
                        Drag &amp; drop or <span className="text-emerald-600 font-medium">select a file</span>
                      </span>
                    </button>
                    <input
                      id="media-file"
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleMediaUpload}
                    />
                  </div>

                  {/* Toolbar */}
                  <div className="flex items-center gap-4 pb-3 border-b border-neutral-100 text-neutral-400">
                    <button 
                      type="button" 
                      onClick={() => document.getElementById("media-file")?.click()} 
                      className="hover:text-neutral-600 bg-transparent border-none p-0 cursor-pointer" 
                      title="Add Media"
                    >
                      <Plus size={17} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowPreview(!showPreview)} 
                      className="hover:text-neutral-600 bg-transparent border-none p-0 cursor-pointer" 
                      title="Toggle Preview"
                    >
                      <ChevronDown size={17} />
                    </button>
                    <div className="w-px h-4 bg-neutral-200" />
                    <div className="relative">
                      <button 
                        type="button" 
                        onClick={() => setIsEmojiOpen(!isEmojiOpen)}
                        className="hover:text-neutral-600 bg-transparent border-none p-0 cursor-pointer flex items-center" 
                        title="Insert Emoji"
                      >
                        <Smile size={17} />
                      </button>
                      
                      {isEmojiOpen && (
                        <div className="absolute left-0 bottom-full mb-2 w-48 bg-background border border-border rounded-xl shadow-lg p-2.5 z-50 grid grid-cols-4 gap-1.5">
                          {["😊", "🔥", "🚀", "✨", "👍", "🎉", "❤️", "👏", "🙌", "💡", "📌", "📢", "😍", "🤩", "💯", "😎"].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                const current = getPlatformCaption(activePlatform);
                                setPlatformCaption(activePlatform, current + emoji);
                                setIsEmojiOpen(false);
                              }}
                              className="h-8 w-8 text-lg flex items-center justify-center hover:bg-neutral-100 rounded cursor-pointer border-none bg-transparent"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        const current = getPlatformCaption(activePlatform);
                        setPlatformCaption(activePlatform, current + " #");
                      }}
                      className="hover:text-neutral-600 bg-transparent border-none p-0 cursor-pointer font-bold text-[15px] leading-none" 
                      title="Insert Hashtag"
                    >
                      #
                    </button>
                    
                    {/* Synced platforms state */}
                    <button
                      type="button"
                      onClick={() => togglePlatformSync(activePlatform)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer border-none transition-colors ${
                        syncedPlatforms[activePlatform] ?? true 
                          ? "bg-emerald-100 text-emerald-600" 
                          : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
                      }`}
                      title={syncedPlatforms[activePlatform] ?? true ? "Synced with global caption" : "Unlinked - custom caption"}
                    >
                      {syncedPlatforms[activePlatform] ?? true ? <Link2 size={15} /> : <Link2Off size={15} />}
                    </button>
                    
                    <div className="flex-1" />
                    
                    {(() => {
                      const activeConf = PLATFORMS_CONFIG.find(p => p.id === activePlatform);
                      return activeConf?.hasThread ? (
                        <button type="button" className="flex items-center gap-1 text-emerald-600 text-sm font-medium bg-transparent border-none p-0 cursor-pointer">
                          <Plus size={15} /> Start Thread
                        </button>
                      ) : null;
                    })()}
                    
                    <span className={`text-xs px-2 py-1 rounded border ${
                      (getCharLimitForPlatform(activePlatform) - getPlatformCaption(activePlatform).length) < 0 
                        ? "border-red-400 text-red-500 animate-pulse font-bold" 
                        : "border-neutral-200 text-neutral-500"
                    }`}>
                      {getCharLimitForPlatform(activePlatform) - getPlatformCaption(activePlatform).length}
                    </span>
                  </div>

                  {/* Extra fields */}
                  {(activePlatform === "instagram" || activePlatform === "facebook" || activePlatform === "linkedin") && (
                    <div className="pt-4 space-y-4">
                      {activePlatform === "instagram" && (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-neutral-500 w-28">Add Stickers</span>
                          <button
                            type="button"
                            onClick={() => setInstagramMusic(!instagramMusic)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${
                              instagramMusic ? "bg-emerald-500 text-white border-transparent" : "border-neutral-200 text-neutral-600 bg-background hover:bg-neutral-50"
                            }`}
                          >
                            <Music size={14} /> Music
                          </button>
                          <button
                            type="button"
                            onClick={() => setInstagramTagProducts(!instagramTagProducts)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${
                              instagramTagProducts ? "bg-emerald-500 text-white border-transparent" : "border-neutral-200 text-neutral-600 bg-background hover:bg-neutral-50"
                            }`}
                          >
                            <ShoppingBag size={14} /> Tag Products
                          </button>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 w-28">First Comment</span>
                        <input
                          value={activePlatform === "instagram" ? instagramFirstComment : (activePlatform === "facebook" ? facebookFirstComment : linkedinFirstComment)}
                          onChange={(e) => {
                            if (activePlatform === "instagram") setInstagramFirstComment(e.target.value);
                            else if (activePlatform === "facebook") setFacebookFirstComment(e.target.value);
                            else setLinkedinFirstComment(e.target.value);
                          }}
                          placeholder="Your comment"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  )}

                  {activePlatform === "x" && (
                    <div className="pt-4">
                      {/* Empty for X settings */}
                    </div>
                  )}

                  {activePlatform === "tiktok" && (
                    <div className="pt-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 w-20">Title</span>
                        <input
                          value={tiktokTitle}
                          onChange={(e) => setTiktokTitle(e.target.value)}
                          placeholder="Your post title"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <span className="text-sm text-neutral-500">Settings</span>
                        <select
                          value={tiktokAutomatic}
                          onChange={(e) => setTiktokAutomatic(e.target.value)}
                          className="border border-neutral-200 bg-background rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
                        >
                          <option value="automatic">Automatic</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {activePlatform === "threads" && (
                    <div className="pt-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 w-20">Topic</span>
                        <input
                          value={threadsTopic}
                          onChange={(e) => setThreadsTopic(e.target.value)}
                          placeholder="Type the topic"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="flex items-center gap-2 pl-20">
                        <span className="text-xs text-neutral-500 shrink-0">Trending:</span>
                        {TRENDING_TOPICS.map((t) => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => setThreadsTopic(t === "More..." ? threadsTopic : t)}
                            className="px-3 py-1 rounded-full border border-neutral-200 text-xs text-neutral-600 whitespace-nowrap cursor-pointer hover:bg-neutral-50 bg-background"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 w-20 flex items-center gap-1"><MapPin size={13} /> Location</span>
                        <input
                          value={threadsLocation}
                          onChange={(e) => setThreadsLocation(e.target.value)}
                          placeholder="Type the location"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  )}

                  {activePlatform === "youtube" && (
                    <div className="pt-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 w-20">Title</span>
                        <input
                          value={youtubeTitle}
                          onChange={(e) => setYoutubeTitle(e.target.value)}
                          placeholder="Your post title"
                          className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm text-neutral-500 w-20">Category</span>
                          <select className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400 bg-background">
                            {["Autos & Vehicles", "Education", "Entertainment", "Gaming", "Music", "Tech"].map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm text-neutral-500 w-20">Visibility</span>
                          <select className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400 bg-background">
                            {["Public", "Unlisted", "Private"].map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-500 w-20">License</span>
                        <select className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400 bg-background">
                          <option>Standard YouTube License</option>
                          <option>Creative Commons</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-neutral-200 rounded-xl p-10 text-neutral-500 text-xs italic">
                  Select a social media channel above to start editing.
                </div>
              )}
            </div>

            {/* Right: preview */}
            {showPreview && activePlatform && (
              <div className="w-[420px] shrink-0 border-l border-neutral-200 bg-[#F7F5F0] overflow-y-auto px-8 py-6 flex flex-col justify-start">
                <div className="flex items-center gap-2 mb-5">
                  <h2 className="text-lg font-medium text-neutral-900">
                    {PLATFORMS_CONFIG.find(p => p.id === activePlatform)?.label} Preview
                  </h2>
                  <Info size={15} className="text-neutral-400" />
                </div>
                <PreviewCard 
                  platform={activePlatform} 
                  text={getPlatformCaption(activePlatform) || "What would you like to share?"} 
                  image={composerMediaUrls[0] || null} 
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-8 py-5 border-t border-neutral-200 shrink-0 bg-white">
            {/* Scheduling timing selector */}
            <div className="flex items-center gap-3">
              <select
                value={publishNow ? "now" : "schedule"}
                onChange={(e) => setPublishNow(e.target.value === "now")}
                className="border border-neutral-200 bg-background rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400 cursor-pointer"
              >
                <option value="now">Post Now</option>
                <option value="schedule">Schedule Later</option>
              </select>

              {!publishNow && (
                <div className="flex items-center gap-2 border border-neutral-200 bg-background rounded-lg px-3 py-1.5">
                  <Clock className="h-4 w-4 text-neutral-400" />
                  <input
                    type="datetime-local"
                    value={composerScheduledFor}
                    onChange={(e) => setComposerScheduledFor(e.target.value)}
                    className="bg-transparent border-none text-xs focus:ring-0 outline-none p-0.5 cursor-pointer text-neutral-800"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={!composerClient}
                onClick={() => handleCreatePost(true)}
                className={`relative px-5 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  !composerClient
                    ? "bg-neutral-50 text-neutral-300 border-neutral-100 cursor-not-allowed"
                    : "text-neutral-600 bg-background hover:bg-neutral-50 border-neutral-200 cursor-pointer"
                }`}
              >
                Save Draft
                {composerClient && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="rounded-lg px-5 border-neutral-200 hover:bg-neutral-50 font-semibold text-sm"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>

              {(() => {
                let btnLabel = publishNow ? "Publish Post" : "Schedule Post";
                let isDisabled = false;

                if (!composerClient) {
                  btnLabel = "Select Client";
                  isDisabled = true;
                } else if (composerAccounts.length === 0) {
                  btnLabel = "Select Channels";
                  isDisabled = true;
                }

                return (
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleCreatePost()}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors border-none ${
                      isDisabled 
                        ? "bg-neutral-100 text-neutral-400 cursor-not-allowed" 
                        : "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
                    }`}
                  >
                    {btnLabel}
                  </button>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Modal */}
      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-background">
          <DialogHeader>
            <DialogTitle className="font-bold text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>AI Caption Generator</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What is your post about?</label>
              <Textarea
                placeholder="e.g. Announcing our brand new feature release next week! Highlight the productivity gains."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="rounded-xl h-24 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Optimize Tone For</label>
              <select
                value={aiTargetPlatform}
                onChange={(e) => setAiTargetPlatform(e.target.value)}
                className="w-full border border-border bg-background rounded-xl p-2.5 text-sm outline-none"
              >
                <option value="instagram">Instagram (Engaging, hashtags, spacing)</option>
                <option value="facebook">Facebook (Friendly, informational)</option>
                <option value="linkedin">LinkedIn (Professional, thought-provoking)</option>
                <option value="x">X / Twitter (Short, high impact, no hash spam)</option>
                <option value="tiktok">TikTok (Trendy, short, action-focused)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsAiOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={generateAiCaption} disabled={isGeneratingAi || !aiPrompt}>
              {isGeneratingAi ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Generating Caption...</span>
                </>
              ) : (
                <span>Generate Caption</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Preview renderers ---------------- */
interface PreviewCardProps {
  platform: string;
  text: string;
  image: string | null;
}

function PreviewCard({ platform, text, image }: PreviewCardProps) {
  const avatar = "https://api.dicebear.com/7.x/identicon/svg?seed=hirdanmarketing";

  if (platform === "x" || platform === "twitter") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 w-full select-none text-left">
        <div className="flex gap-3">
          <img src={avatar} className="w-10 h-10 rounded-full" alt="Avatar" />
          <div className="flex-1 min-w-0">
            <div className="text-sm">
              <span className="font-semibold text-neutral-900">Hirdan Marketing</span>{" "}
              <span className="text-neutral-400">@hirdanmarketing</span>
            </div>
            <p className="text-sm text-neutral-800 mt-1 whitespace-pre-wrap">{text}</p>
            {image && <img src={image} className="mt-3 rounded-xl w-full object-cover max-h-64" alt="X preview" />}
            <div className="flex justify-between mt-3 text-neutral-400 max-w-[280px]">
              <MessageCircle size={16} /><Repeat2 size={16} /><Heart size={16} /><BarChart2 size={16} /><Bookmark size={16} /><Share2 size={16} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden w-full select-none text-left">
        <div className="flex items-center gap-3 p-4 pb-2">
          <img src={avatar} className="w-9 h-9 rounded-full" alt="Avatar" />
          <div>
            <div className="text-sm font-semibold text-neutral-900">Hirdan Marketing</div>
            <div className="text-xs text-neutral-400">Just Now · 🌐</div>
          </div>
        </div>
        <p className="px-4 pb-3 text-sm text-neutral-800 whitespace-pre-wrap">{text}</p>
        {image && <img src={image} className="w-full object-cover max-h-64" alt="Facebook preview" />}
        <div className="flex justify-around py-2 border-t border-neutral-100 text-sm text-neutral-500 font-medium bg-neutral-50/50">
          <span className="flex items-center gap-1"><ThumbsUp size={15} /> Like</span>
          <span className="flex items-center gap-1"><MessageCircle size={15} /> Comment</span>
          <span className="flex items-center gap-1"><Share2 size={15} /> Share</span>
        </div>
      </div>
    );
  }

  if (platform === "instagram") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden w-full select-none text-left">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <img src={avatar} className="w-8 h-8 rounded-full" alt="Avatar" />
            <span className="text-sm font-semibold">hirdanmarketing</span>
          </div>
          <MoreHorizontal size={16} className="text-neutral-500" />
        </div>
        {image ? (
          <img src={image} className="w-full aspect-square object-cover" alt="Instagram preview" />
        ) : (
          <div className="w-full aspect-square bg-neutral-100 flex items-center justify-center text-neutral-300">
            <ImageIcon size={36} />
          </div>
        )}
        <div className="flex items-center gap-3 px-3 pt-3 text-neutral-700">
          <Heart size={19} /><MessageCircle size={19} /><Send size={19} /><div className="flex-1" /><Bookmark size={19} />
        </div>
        <p className="px-3 pb-3 pt-1 text-sm"><span className="font-semibold mr-1.5">hirdanmarketing</span><span className="whitespace-pre-wrap">{text}</span></p>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 w-full select-none text-left">
        <div className="flex items-center gap-3 mb-2">
          <img src={avatar} className="w-10 h-10 rounded-full" alt="Avatar" />
          <div>
            <div className="text-sm font-semibold text-neutral-900">Hirdan Marketing</div>
            <div className="text-xs text-neutral-400">1h · 🌐</div>
          </div>
        </div>
        <p className="text-sm text-neutral-800 mb-3 whitespace-pre-wrap">{text}</p>
        {image && <img src={image} className="w-full rounded-lg object-cover max-h-64" alt="LinkedIn preview" />}
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
          <img src={image} className="absolute inset-0 w-full h-full object-cover top-12" style={{ height: "calc(100% - 3rem)", top: "3rem" }} alt="TikTok preview" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2">
            <ImageIcon className="h-8 w-8" />
            <span className="text-[10px]">No media attached</span>
          </div>
        )}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white z-10">
          <img src={avatar} className="w-9 h-9 rounded-full border-2 border-white" alt="Avatar" />
          <Heart size={24} /><MessageCircle size={24} /><Bookmark size={24} /><Share2 size={24} />
        </div>
        <div className="absolute left-3 bottom-4 text-white text-xs z-10 pr-12">
          <div className="font-semibold flex items-center gap-2">hirdanmarketing <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">Photo</span></div>
          <div className="mt-1 line-clamp-3 leading-snug whitespace-pre-wrap">{text}</div>
        </div>
      </div>
    );
  }

  if (platform === "youtube") {
    return (
      <div className="bg-black rounded-3xl overflow-hidden relative w-full max-w-[270px] mx-auto select-none border border-neutral-800 text-left" style={{ aspectRatio: "9/16" }}>
        {image ? (
          <img src={image} className="absolute inset-0 w-full h-full object-cover opacity-70" alt="YouTube Preview" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2">
            <ImageIcon className="h-8 w-8" />
            <span className="text-[10px]">No media attached</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-md">
            <Play size={22} className="text-black ml-1 fill-black" />
          </div>
        </div>
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white text-[10px] z-10">
          <span className="flex flex-col items-center gap-1"><ThumbsUp size={20} />Like</span>
          <span className="flex flex-col items-center gap-1"><ThumbsDown size={20} />Dislike</span>
          <span className="flex flex-col items-center gap-1"><MessageCircle size={20} />Comment</span>
          <span className="flex flex-col items-center gap-1"><Share2 size={20} />Share</span>
        </div>
        <div className="absolute left-3 bottom-4 right-16 text-white text-xs z-10">
          <div className="flex items-center gap-2 mb-1">
            <img src={avatar} className="w-6 h-6 rounded-full" alt="Avatar" />
            <span className="font-medium">@hirdanmarketing</span>
            <span className="bg-white text-black text-[9px] px-2 py-0.5 rounded-full font-bold">Subscribe</span>
          </div>
          <div className="line-clamp-2 leading-snug whitespace-pre-wrap">{text}</div>
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
            <div className="text-sm">
              <span className="font-semibold text-neutral-900">Hirdan Marketing</span>{" "}
              <span className="text-neutral-400 text-xs">21h</span>
            </div>
            <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{text}</p>
            {image && <img src={image} className="mt-3 rounded-xl w-full object-cover max-h-64" alt="Threads preview" />}
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
