import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Copy, ImageIcon, Plus, SquarePen, Trash2, Clock } from "lucide-react";
import { getStatusStyle, formatPostStatus } from "@/lib/social/post-status";
import { type SocialPost } from "@/lib/social/types";

interface PostGridProps {
  filteredPosts: SocialPost[];
  viewMode: "grid" | "list";
  selectedPostIds: string[];
  activePostId: string | null;
  setActivePostId: (id: string | null) => void;
  setIsReschedulingOpen: (open: boolean) => void;
  setIsComposerOpen: (open: boolean) => void;
  resetAllFilters: () => void;
  resetComposer: () => void;
  handleToggleSelect: (postId: string) => void;
  handleEditPost: (post: SocialPost) => void;
  handleDuplicatePost: (post: SocialPost) => void | Promise<void>;
  handleDeletePost: (postId: string) => void | Promise<void>;
  getMediaUrls: (post: SocialPost) => string[];
  getClientDetails: (clientId: string) => { name: string; company: string };
  getContentTypeLabel: (post: SocialPost) => string;
  getCampaignName: (campaignId?: string | null) => string;
  getWriterName: (post: SocialPost) => string;
  getPlatformIcon: (platform?: string, className?: string) => React.ReactNode;
}

export default function PostGrid({
  filteredPosts,
  viewMode,
  selectedPostIds,
  activePostId,
  setActivePostId,
  setIsReschedulingOpen,
  setIsComposerOpen,
  resetAllFilters,
  resetComposer,
  handleToggleSelect,
  handleEditPost,
  handleDuplicatePost,
  handleDeletePost,
  getMediaUrls,
  getClientDetails,
  getContentTypeLabel,
  getCampaignName,
  getWriterName,
  getPlatformIcon,
}: PostGridProps) {
  return (
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
                    post.status === "PARTIAL" ? "#f59e0b" : post.status === "FAILED" ? "#f43f5e" : "#94a3b8";
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
                    {formatPostStatus(post.status)}
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
                  const statusAccent = post.status === "PUBLISHED" ? "#10b981" : post.status === "PARTIAL" ? "#f59e0b" : post.status === "SCHEDULED" ? "#f59e0b" : post.status === "AWAITING_APPROVAL" ? "#0ea5e9" : post.status === "FAILED" ? "#f43f5e" : "#94a3b8";
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
                          {formatPostStatus(post.status)}
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
  );
}
