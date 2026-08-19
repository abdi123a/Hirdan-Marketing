import {
  Plus, Clock, Sparkles, Loader2, HelpCircle, X,
  Tags, ChevronDown, Music, ShoppingBag, Eye, Link2, Link2Off, Maximize2, Minimize2, Smile, Check,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { contentTypesFor, TIKTOK_POST_MODES, type TikTokPostMode } from "@/lib/platform-capabilities";
import { PLATFORMS_CONFIG } from "@/lib/social/platform";
import { type SocialAccount, type Client, type SocialCampaign, type UploadProgressFile } from "@/lib/social/types";
import { UploadProgressTile, UploadProgressDetails } from "@/components/social/MediaUploadProgress";
import { PreviewCard } from "@/pages/SocialPublishPage";

export interface PinterestBoardState {
  boards: { id: string; name: string }[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

interface PostComposerProps {
  isComposerOpen: boolean;
  handleOpenChange: (open: boolean) => void;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  editingPostId: string | null;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;

  isTagsOpen: boolean;
  setIsTagsOpen: (v: boolean) => void;
  postTags: string[];
  setPostTags: React.Dispatch<React.SetStateAction<string[]>>;
  syncedPlatforms: Record<string, boolean>;
  setIsAiOpen: (v: boolean) => void;

  composerClient: string;
  setComposerClient: (v: string) => void;
  clientsWithAccounts: Client[];
  clients: Client[];
  navigate: (path: string) => void;
  composerCampaign: string;
  setComposerCampaign: (v: string) => void;
  setIsCampaignDialogOpen: (v: boolean) => void;
  campaigns: SocialCampaign[];

  accounts: SocialAccount[];
  composerAccounts: string[];
  setComposerAccounts: React.Dispatch<React.SetStateAction<string[]>>;
  alreadyPublishedAccountIds: string[];
  selectedPlatforms: string[];
  setSelectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  activePlatform: string;
  setActivePlatform: (v: string) => void;
  setExpandedComposerPlatform: (v: string | null) => void;
  getPlatformIcon: (platform?: string, className?: string) => React.ReactNode;

  composerCaption: string;
  setComposerCaption: React.Dispatch<React.SetStateAction<string>>;
  isEmojiOpen: boolean;
  setIsEmojiOpen: (v: boolean) => void;
  handleMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  composerMediaUrls: string[];
  setComposerMediaUrls: React.Dispatch<React.SetStateAction<string[]>>;
  composerMediaType: string;
  uploadProgressFiles: UploadProgressFile[];

  expandedComposerPlatform: string | null;
  getPlatformCaption: (platform: string) => string;
  getCharLimitForPlatform: (platformName: string) => number;
  setPlatformCaption: (platform: string, text: string) => void;
  togglePlatformSync: (platform: string) => void;
  instagramType: "post" | "reel" | "story";
  setInstagramType: React.Dispatch<React.SetStateAction<"post" | "reel" | "story">>;
  facebookType: "post" | "reel" | "story";
  setFacebookType: React.Dispatch<React.SetStateAction<"post" | "reel" | "story">>;
  youtubeType: "short" | "video";
  setYoutubeType: React.Dispatch<React.SetStateAction<"short" | "video">>;
  tiktokType: "video" | "photo";
  setTiktokType: React.Dispatch<React.SetStateAction<"video" | "photo">>;
  linkedinType: string;
  setLinkedinType: (v: string) => void;
  xType: string;
  setXType: (v: string) => void;
  threadsType: string;
  setThreadsType: (v: string) => void;
  pinterestType: string;
  pinterestTitle: string;
  setPinterestTitle: (v: string) => void;
  pinterestLink: string;
  setPinterestLink: (v: string) => void;
  /** Per-account board list + current choice, keyed by socialAccountId. */
  pinterestBoards: Record<string, PinterestBoardState>;
  loadPinterestBoards: (accountId: string) => void;
  setPinterestBoard: (accountId: string, boardId: string | null) => void;
  setPinterestType: (v: string) => void;
  tiktokPostMode: TikTokPostMode;
  setTiktokPostMode: (v: TikTokPostMode) => void;
  instagramMusic: boolean;
  setInstagramMusic: (v: boolean) => void;
  instagramTagProducts: boolean;
  setInstagramTagProducts: (v: boolean) => void;
  instagramFirstComment: string;
  setInstagramFirstComment: (v: string) => void;
  facebookFirstComment: string;
  setFacebookFirstComment: (v: string) => void;
  linkedinFirstComment: string;
  setLinkedinFirstComment: (v: string) => void;
  tiktokTitle: string;
  setTiktokTitle: (v: string) => void;
  youtubeTitle: string;
  setYoutubeTitle: (v: string) => void;
  youtubePrivacy: string;
  setYoutubePrivacy: (v: string) => void;
  threadsTopic: string;
  setThreadsTopic: (v: string) => void;

  publishNow: boolean;
  setPublishNow: (v: boolean) => void;
  isSubmitting: boolean;
  composerScheduledFor: string;
  setComposerScheduledFor: (v: string) => void;
  handleCreatePost: (asDraft?: boolean) => void | Promise<void>;
  submitType: "draft" | "publish" | null;
  isUploading: boolean;
}

export default function PostComposer({
  isComposerOpen, handleOpenChange, isFullscreen, setIsFullscreen, editingPostId, showPreview, setShowPreview,
  isTagsOpen, setIsTagsOpen, postTags, setPostTags, syncedPlatforms, setIsAiOpen,
  composerClient, setComposerClient, clientsWithAccounts, clients, navigate, composerCampaign, setComposerCampaign, setIsCampaignDialogOpen, campaigns,
  accounts, composerAccounts, setComposerAccounts, alreadyPublishedAccountIds, selectedPlatforms, setSelectedPlatforms, activePlatform, setActivePlatform, setExpandedComposerPlatform, getPlatformIcon,
  composerCaption, setComposerCaption, isEmojiOpen, setIsEmojiOpen, handleMediaUpload, composerMediaUrls, setComposerMediaUrls, composerMediaType, uploadProgressFiles,
  expandedComposerPlatform, getPlatformCaption, getCharLimitForPlatform, setPlatformCaption, togglePlatformSync,
  instagramType, setInstagramType, facebookType, setFacebookType, youtubeType, setYoutubeType, tiktokType, setTiktokType,
  linkedinType, setLinkedinType, xType, setXType, threadsType, setThreadsType, pinterestType, setPinterestType,
  pinterestTitle, setPinterestTitle, pinterestLink, setPinterestLink,
  pinterestBoards, loadPinterestBoards, setPinterestBoard,
  tiktokPostMode, setTiktokPostMode,
  instagramMusic, setInstagramMusic, instagramTagProducts, setInstagramTagProducts, instagramFirstComment, setInstagramFirstComment,
  facebookFirstComment, setFacebookFirstComment, linkedinFirstComment, setLinkedinFirstComment,
  tiktokTitle, setTiktokTitle, youtubeTitle, setYoutubeTitle, youtubePrivacy, setYoutubePrivacy, threadsTopic, setThreadsTopic,
  publishNow, setPublishNow, isSubmitting, composerScheduledFor, setComposerScheduledFor, handleCreatePost, submitType, isUploading,
}: PostComposerProps) {
  // "processing" counts as in-flight: the bytes are sent but the server is still
  // storing them, so the tile has to stay up until the URL comes back.
  const activeUploads = uploadProgressFiles.filter(f => f.status === "uploading" || f.status === "processing");
  const overallUploadPct = activeUploads.length
    ? Math.round(activeUploads.reduce((sum, f) => sum + (f.status === "processing" ? 100 : f.progress), 0) / activeUploads.length)
    : 0;

  return (
    <Dialog open={isComposerOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        className={`flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-border bg-background p-0 transition-all duration-200 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border ${
          isFullscreen
            ? "sm:h-[95vh] sm:max-w-[98vw]"
            : showPreview
              ? "sm:w-[calc(100%-2rem)] sm:max-w-5xl md:max-w-6xl"
              // Without the 360px preview column the editor alone needs about
              // that much less width, or it stretches into empty space.
              : "sm:w-[calc(100%-2rem)] sm:max-w-3xl"
        }`}
      >

        {/* Composer Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <h2 className="whitespace-nowrap text-base font-bold text-foreground">{editingPostId ? "Edit Post" : "Create Post"}</h2>
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

        {/* Composer Body — stacks on phones, splits side-by-side from lg up.
            Side-by-side below that left the editor with ~15px beside the
            fixed 360px preview column. */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden lg:flex-row">

          {/* LEFT: Editor (scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">

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
                      {clientsWithAccounts.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                      {composerClient && !clientsWithAccounts.some(c => c.id === composerClient) && (
                        clients.filter(c => c.id === composerClient).map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                  {clientsWithAccounts.length === 0 && (
                    <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                      No clients have connected social accounts.
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenChange(false);
                          navigate("/dashboard/social-media/accounts");
                        }}
                        className="underline hover:text-amber-400 cursor-pointer font-bold bg-transparent border-none p-0"
                      >
                        Connect accounts here
                      </button>
                    </p>
                  )}
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
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                                  Already live — will not be re-posted. Only failed/new accounts publish again.
                                </p>
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
              {(composerMediaUrls.length > 0 || activeUploads.length > 0) && (
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
                    {activeUploads.map(f => <UploadProgressTile key={f.id} file={f} />)}
                    <button type="button" onClick={() => document.getElementById("media-file")?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/20 cursor-pointer bg-transparent transition-colors shrink-0">
                      <ImagePlus size={17} className="text-muted-foreground/50" />
                      <span className="text-[9px] text-muted-foreground/50 font-medium">Add</span>
                    </button>
                  </div>

                  {/* A spinner alone gave no way to tell a stalled 400 MB video
                      from one that is nearly finished. */}
                  <UploadProgressDetails files={activeUploads} />
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
                                  {(() => {
                                    const types = contentTypesFor(plat);
                                    if (types.length <= 1) return null;
                                    const currentType = plat === 'instagram' ? instagramType
                                      : plat === 'facebook' ? facebookType
                                      : plat === 'youtube' ? youtubeType
                                      : plat === 'tiktok' ? tiktokType
                                      : plat === 'linkedin' ? linkedinType
                                      : plat === 'x' ? xType
                                      : plat === 'threads' ? threadsType
                                      : plat === 'pinterest' ? pinterestType
                                      : 'post';
                                    const setType = (val: string) => {
                                      if (plat === 'instagram') setInstagramType(val as any);
                                      else if (plat === 'facebook') setFacebookType(val as any);
                                      else if (plat === 'youtube') setYoutubeType(val as any);
                                      else if (plat === 'tiktok') setTiktokType(val as any);
                                      else if (plat === 'linkedin') setLinkedinType(val);
                                      else if (plat === 'x') setXType(val);
                                      else if (plat === 'threads') setThreadsType(val);
                                      else if (plat === 'pinterest') setPinterestType(val);
                                    };
                                    return types.map(ct => (
                                      <label key={ct.id} className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-foreground" title={ct.hint || ''}>
                                        <input type="radio" name={`${plat}-type`}
                                          checked={currentType === ct.id}
                                          onChange={() => setType(ct.id)}
                                          className="accent-primary" />
                                        {ct.label}
                                      </label>
                                    ));
                                  })()}
                                  {plat === 'tiktok' && (
                                    <div className="ml-2 pl-2 border-l border-border/40">
                                      <Select value={tiktokPostMode} onValueChange={v => setTiktokPostMode(v as TikTokPostMode)}>
                                        <SelectTrigger size="xs" className="w-auto min-w-[140px] shadow-none">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TIKTOK_POST_MODES.map(mode => (
                                            <SelectItem key={mode.id} value={mode.id}>{mode.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
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
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-16 shrink-0">Title</span>
                                    <input value={youtubeTitle} onChange={e => setYoutubeTitle(e.target.value)} placeholder="Video title..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-16 shrink-0">Privacy</span>
                                    <div className="flex-1">
                                      <Select value={youtubePrivacy} onValueChange={setYoutubePrivacy}>
                                        <SelectTrigger size="sm" className="w-full shadow-none border-border/50">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="public">Public</SelectItem>
                                          <SelectItem value="unlisted">Unlisted</SelectItem>
                                          <SelectItem value="private">Private</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="pl-16 text-[10px] text-muted-foreground">
                                    Public: Visible to everyone. Unlisted: Anyone with the link can view. Private: Only you can view.
                                  </div>
                                </div>
                              )}
                              {plat === "threads" && (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-16 shrink-0">Topic</span>
                                  <input value={threadsTopic} onChange={e => setThreadsTopic(e.target.value)} placeholder="Thread topic..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                </div>
                              )}
                              {plat === "pinterest" && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-16 shrink-0">Title</span>
                                    <input value={pinterestTitle} onChange={e => setPinterestTitle(e.target.value)} placeholder="Pin title..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-16 shrink-0">Link</span>
                                    <input value={pinterestLink} onChange={e => setPinterestLink(e.target.value)} placeholder="Destination URL..." className="flex-1 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary bg-background" />
                                  </div>
                                  {/* One board per selected Pinterest account — board ids belong to
                                      the account that owns them, so they cannot be shared. */}
                                  {accounts
                                    .filter(a => a.platform.toLowerCase() === "pinterest" && composerAccounts.includes(a.id))
                                    .map(acct => {
                                      const state = pinterestBoards[acct.id];
                                      return (
                                        <div key={acct.id} className="flex items-center gap-3">
                                          <span className="text-xs text-muted-foreground w-16 shrink-0 truncate" title={acct.displayName}>Board</span>
                                          <div className="flex-1 min-w-0">
                                            {state?.loading ? (
                                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />Loading boards…
                                              </div>
                                            ) : state?.error ? (
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-amber-600 dark:text-amber-400">{state.error}</span>
                                                <button type="button" onClick={() => loadPinterestBoards(acct.id)}
                                                  className="text-[10px] font-bold text-primary hover:underline bg-transparent border-none cursor-pointer">Retry</button>
                                              </div>
                                            ) : (
                                              <Select
                                                value={state?.selectedId || "none"}
                                                onValueChange={v => setPinterestBoard(acct.id, v === "none" ? null : v)}
                                              >
                                                <SelectTrigger size="sm" className="w-full shadow-none border-border/50">
                                                  <SelectValue placeholder="Account's first board" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">Account's first board</SelectItem>
                                                  {(state?.boards || []).map(b => (
                                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            )}
                                            {(acct.displayName || acct.platformUsername) && (
                                              <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">
                                                {acct.displayName || acct.platformUsername}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
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
            <div className="flex w-full shrink-0 flex-col overflow-hidden border-t border-border/40 bg-muted/20 lg:w-[360px] lg:border-l lg:border-t-0">
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
                {activePlatform ? (() => {
                  const previewAccount = accounts.find(a => composerAccounts.includes(a.id) && a.platform.toLowerCase() === activePlatform)
                    || accounts.find(a => a.platform.toLowerCase() === activePlatform);
                  return (
                    <PreviewCard
                      platform={activePlatform}
                      text={getPlatformCaption(activePlatform) || "What would you like to share?"}
                      image={composerMediaUrls[0] || null}
                      mediaType={composerMediaType}
                      accountName={previewAccount?.displayName || activePlatform}
                      platformUsername={previewAccount?.platformUsername}
                      avatarUrl={previewAccount?.avatarUrl}
                      postType={
                        activePlatform === "instagram" ? instagramType
                        : activePlatform === "facebook" ? facebookType
                        : activePlatform === "youtube" ? youtubeType
                        : activePlatform === "tiktok" ? tiktokType
                        : activePlatform === "linkedin" ? linkedinType
                        : activePlatform === "x" ? xType
                        : activePlatform === "threads" ? threadsType
                        : activePlatform === "pinterest" ? pinterestType
                        : "post"
                      }
                    />
                  );
                })() : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs italic text-center py-12">
                    Select a platform to see the live preview.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Composer Sticky Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
            <Select value={publishNow ? "now" : "schedule"} onValueChange={v => setPublishNow(v === "now")} disabled={isSubmitting}>
              <SelectTrigger size="sm" className="w-auto min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Publish Now</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
              </SelectContent>
            </Select>
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
              // While media is in flight the button doubles as the coarse progress
              // readout, so the percentage stays visible even if the media grid
              // has been scrolled out of view. Between two queued files there is
              // a tick with nothing in flight — show no number rather than 0%.
              const uploadLabel = activeUploads.length === 0
                ? "Uploading Media..."
                : activeUploads.every(f => f.status === "processing")
                  ? "Processing Media..."
                  : `Uploading Media... ${overallUploadPct}%`;
              const label = !composerClient ? "Select Client" : composerAccounts.length === 0 ? "Select Accounts" : isUploading ? uploadLabel : isSubmitting && submitType === "publish" ? (publishNow ? "Publishing..." : "Scheduling...") : publishNow ? "Publish Now" : "Schedule Post";
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
  );
}
