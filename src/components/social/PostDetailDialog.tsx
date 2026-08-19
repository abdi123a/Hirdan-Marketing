// Post detail panel for the analytics Top Posts lists.
//
// Opens on a post row and answers two questions: how did this specific post do,
// and where is it live? Metrics are shown per platform with their provenance, so
// a TikTok row sourced from a Studio export is never mistaken for live API data.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch, getFullUrl } from "@/lib/api-client";
import { compactNumber } from "@/lib/social/format";
import {
  ExternalLink, Heart, MessageSquare, Share2, Bookmark, Play, Eye,
  BarChart2, RefreshCw, AlertCircle, Upload, Zap, Video, Image as ImageIcon,
} from "lucide-react";

// ── types ────────────────────────────────────────────────────────────────────

interface Metrics {
  likes: number | null; comments: number | null; shares: number | null;
  saved: number | null; views: number | null; reach: number | null; impressions: number | null;
}

interface Breakdown {
  platform: string;
  accountName: string;
  accountHandle: string;
  status: string;
  link: string | null;
  source: "api" | "import";
  updatedAt: string | null;
  error?: string | null;
  metrics: Metrics;
}

export interface PostDetail {
  id: string;
  caption: string;
  mediaUrls: any;
  mediaType: string | null;
  publishedAt: string | null;
  status?: string;
  source: "scheduled" | "imported" | "both";
  link: string | null;
  totals: {
    likes: number; comments: number; shares: number; saved: number;
    views: number; reach: number; impressions: number;
    engagement: number; engagementRate: number;
  };
  breakdown: Breakdown[];
  provenance: { source: string; lastImportedAt?: string | null };
}

// ── helpers ──────────────────────────────────────────────────────────────────


const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", threads: "Threads",
  linkedin: "LinkedIn", youtube: "YouTube", x: "X", twitter: "X", pinterest: "Pinterest",
};

const platformIcon = (platform: string, cls = "h-4 w-4 rounded-sm object-contain") => {
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

const firstMediaUrl = (mediaUrls: any): string | null => {
  if (!mediaUrls) return null;
  if (Array.isArray(mediaUrls)) return typeof mediaUrls[0] === "string" ? mediaUrls[0] : null;
  if (typeof mediaUrls === "string") {
    if (mediaUrls.startsWith("[")) {
      try {
        const parsed = JSON.parse(mediaUrls);
        return Array.isArray(parsed) && typeof parsed[0] === "string" ? parsed[0] : null;
      } catch { return null; }
    }
    return mediaUrls;
  }
  return null;
};

/** Open a post on its platform. noopener/noreferrer — never hand the tab over. */
export const openExternal = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

// ── pieces ───────────────────────────────────────────────────────────────────

const MetricTile = ({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: number | null; tone: string;
}) => (
  <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon size={11} className={tone} />
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-1 text-lg font-black tabular-nums leading-none">{compactNumber(value)}</p>
  </div>
);

const SourceChip = ({ source }: { source: "api" | "import" }) =>
  source === "import" ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-600">
      <Upload size={9} /> From export
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
      <Zap size={9} /> Live API
    </span>
  );

// ── dialog ───────────────────────────────────────────────────────────────────

export function PostDetailDialog({ postId, open, onOpenChange }: {
  postId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<PostDetail>(`/social/analytics/post/${encodeURIComponent(postId)}`)
      .then(res => { if (!cancelled) setDetail(res); })
      .catch(err => { if (!cancelled) setError(err?.message || "Could not load this post"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId, open]);

  const media = firstMediaUrl(detail?.mediaUrls);
  const isVideo = detail?.mediaType === "video" || detail?.mediaType === "reel" || detail?.mediaType === "short";
  const totals = detail?.totals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-base font-bold">Post Performance</DialogTitle>
          <DialogDescription className="text-xs">
            Metrics for this single post, and where it lives on the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && detail && (
            <div className="space-y-5">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <div className="h-24 w-24 shrink-0 rounded-xl border border-border/60 overflow-hidden bg-muted/60 flex items-center justify-center">
                  {media ? (
                    isVideo ? (
                      <video src={getFullUrl(media)} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      <img src={getFullUrl(media)} className="h-full w-full object-cover" alt="" />
                    )
                  ) : (
                    isVideo ? <Video className="h-6 w-6 text-muted-foreground/60" />
                            : <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug line-clamp-3">
                    {detail.caption || "(no caption)"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {detail.breakdown.map((b, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        {platformIcon(b.platform, "h-3.5 w-3.5 rounded-sm object-contain")}
                        {PLATFORM_LABEL[b.platform] || b.platform}
                      </span>
                    ))}
                    {detail.publishedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        · {new Date(detail.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  {detail.source === "both" && (
                    <p className="mt-2 text-[10px] text-violet-600 font-medium">
                      Published through this system · metrics from your TikTok Studio export
                    </p>
                  )}
                </div>
              </div>

              {/* Open on platform */}
              {detail.link ? (
                <Button
                  onClick={() => openExternal(detail.link!)}
                  className="w-full h-10 rounded-xl font-bold gap-2"
                >
                  <ExternalLink size={15} />
                  Watch on {PLATFORM_LABEL[detail.breakdown[0]?.platform] || "platform"}
                </Button>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground">
                    No public link yet. TikTok links appear once the upload finishes processing
                    (usually within an hour), or after the next Studio export import.
                  </p>
                </div>
              )}

              {/* Totals */}
              {totals && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Totals</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MetricTile icon={Play} label="Views" value={totals.views} tone="text-purple-500" />
                    <MetricTile icon={Heart} label="Likes" value={totals.likes} tone="text-rose-500" />
                    <MetricTile icon={MessageSquare} label="Comments" value={totals.comments} tone="text-blue-500" />
                    <MetricTile icon={Share2} label="Shares" value={totals.shares} tone="text-emerald-500" />
                    <MetricTile icon={Eye} label="Reach" value={totals.reach || null} tone="text-teal-500" />
                    <MetricTile icon={BarChart2} label="Impressions" value={totals.impressions || null} tone="text-indigo-500" />
                    <MetricTile icon={Bookmark} label="Saves" value={totals.saved || null} tone="text-amber-500" />
                    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-primary/80">
                        <Zap size={11} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Eng. rate</span>
                      </div>
                      <p className="mt-1 text-lg font-black tabular-nums leading-none text-primary">
                        {totals.engagementRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-platform breakdown */}
              {detail.breakdown.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    By platform
                  </p>
                  <div className="space-y-2">
                    {detail.breakdown.map((b, i) => (
                      <div key={i} className="rounded-xl border border-border/60 p-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            {platformIcon(b.platform)}
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">
                                {PLATFORM_LABEL[b.platform] || b.platform}
                                <span className="ml-1.5 font-normal text-muted-foreground">@{b.accountHandle}</span>
                              </p>
                              {b.updatedAt && (
                                <p className="text-[10px] text-muted-foreground">
                                  Updated {new Date(b.updatedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <SourceChip source={b.source} />
                            {b.link && (
                              <button
                                onClick={() => openExternal(b.link!)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold hover:bg-muted/50 transition-colors"
                              >
                                <ExternalLink size={10} /> Open
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500">
                            <Play size={10} />{compactNumber(b.metrics.views)}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500">
                            <Heart size={10} />{compactNumber(b.metrics.likes)}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                            <MessageSquare size={10} />{compactNumber(b.metrics.comments)}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                            <Share2 size={10} />{compactNumber(b.metrics.shares)}
                          </span>
                          {b.metrics.reach != null && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-teal-500">
                              <Eye size={10} />{compactNumber(b.metrics.reach)}
                            </span>
                          )}
                        </div>

                        {b.error && (
                          <p className="mt-2 text-[10px] text-destructive">{b.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
