// Picker for attaching natively-published content to a post group.
//
// TikTok has no publish approval on these accounts, so the TikTok cut of a post
// goes out by hand in the TikTok app and only reaches the system later, as a row
// in a Studio export. Nothing links it to the Instagram/Facebook post it was
// published alongside — so it sits in the dashboard as a second, unrelated item.
//
// This dialog is where the user says which export row that post actually is. The
// list is ranked so the intended video is normally the first one, and the server
// hides rows already claimed by another group, so anything shown here is safe to
// pick.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { compactNumber } from "@/lib/social/format";
import { AlertCircle, Check, Heart, Link2, Play, RefreshCw, Search, Video } from "lucide-react";

interface Candidate {
  id: string;
  platform: string;
  title: string | null;
  link: string | null;
  postedAt: string | null;
  views: number | null;
  likes: number | null;
  thumbnailUrl: string | null;
  accountHandle: string | null;
  platformAlreadyInGroup: boolean;
  daysApart: number | null;
  score: number;
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", threads: "Threads",
  linkedin: "LinkedIn", youtube: "YouTube", x: "X", twitter: "X", pinterest: "Pinterest",
};

/**
 * Score above which the ranking is worth pointing at. Below it the signals said
 * nothing — no video near the post's date, no shared words — and the order is
 * only "most recent first".
 */
const CONFIDENT_MATCH = 0.2;

/** How far this video sits from the post, in words rather than a raw number. */
function proximityLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 1) return "Same day";
  if (days < 2) return "1 day apart";
  if (days < 30) return `${Math.round(days)} days apart`;
  return null;
}

export function LinkImportedPostDialog({ postId, open, onOpenChange, onLinked }: {
  postId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a successful link so the caller can refetch the post. */
  onLinked: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearch("");
    apiFetch<{ candidates: Candidate[] }>(`/social/posts/${encodeURIComponent(postId)}/link-candidates`)
      .then(res => { if (!cancelled) setCandidates(res.candidates || []); })
      .catch(err => { if (!cancelled) setError(err?.message || "Could not load your imported videos"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId, open]);

  const link = async (candidateId: string) => {
    if (!postId) return;
    setLinkingId(candidateId);
    setError(null);
    try {
      await apiFetch(`/social/posts/${encodeURIComponent(postId)}/linked-imports`, {
        method: "POST",
        body: JSON.stringify({ importedPostId: candidateId }),
      });
      onLinked();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Could not link that video");
    } finally {
      setLinkingId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const shown = term
    ? candidates.filter(c => (c.title || "").toLowerCase().includes(term))
    : candidates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full rounded-2xl p-0 overflow-hidden max-h-[88vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-base font-bold">Add a video you posted yourself</DialogTitle>
          <DialogDescription className="text-xs">
            Pick the imported video that is the same post. It joins this post's group,
            so it counts once across every platform instead of twice.
          </DialogDescription>
        </DialogHeader>

        {candidates.length > 6 && (
          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by caption…"
                className="w-full rounded-xl border border-border/60 bg-transparent py-2 pl-9 pr-3 text-xs outline-none focus:border-primary/50"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && shown.length > 0 && shown[0].score < CONFIDENT_MATCH && !term && (
            <p className="mb-3 text-[11px] text-muted-foreground">
              Nothing was posted close to this post's date, so these are ordered
              newest first. Pick the one you recognise.
            </p>
          )}

          {!loading && !error && shown.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-6 text-center">
              <Video className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-xs font-semibold">
                {candidates.length ? "No video matches that search" : "Nothing left to link"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {candidates.length
                  ? "Try a different word from the caption."
                  : "Every imported video already belongs to a post. Import a new TikTok Studio export to add more."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {!loading && shown.map((c, i) => {
              const proximity = proximityLabel(c.daysApart);
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/60 flex items-center justify-center">
                      {c.thumbnailUrl
                        ? <img src={c.thumbnailUrl} className="h-full w-full object-cover" alt="" />
                        : <Video className="h-5 w-5 text-muted-foreground/60" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Only claim a best match when the ranking actually found
                            one. With nothing posted near this date and no caption
                            overlap every row scores zero, and the list is just
                            newest-first — badging the top of that is a wrong
                            answer stated confidently. */}
                        {i === 0 && !term && c.score >= CONFIDENT_MATCH && (
                          <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            Best match
                          </span>
                        )}
                        {proximity && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            {proximity}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-snug line-clamp-2">
                        {c.title || "(no caption)"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {PLATFORM_LABEL[c.platform] || c.platform}
                          {c.accountHandle ? ` · @${c.accountHandle}` : ""}
                        </span>
                        {c.postedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.postedAt).toLocaleDateString(undefined, {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500">
                          <Play size={10} />{compactNumber(c.views)}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500">
                          <Heart size={10} />{compactNumber(c.likes)}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={i === 0 && !term && c.score >= CONFIDENT_MATCH ? "default" : "outline"}
                      disabled={Boolean(linkingId) || c.platformAlreadyInGroup}
                      onClick={() => link(c.id)}
                      className="h-8 shrink-0 gap-1.5 rounded-lg text-[11px] font-bold"
                    >
                      {linkingId === c.id
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <Check size={12} />}
                      Link
                    </Button>
                  </div>

                  {/* The group already covers this platform, so linking would put
                      two of the same platform on one post. */}
                  {c.platformAlreadyInGroup && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      This post already has a {PLATFORM_LABEL[c.platform] || c.platform} destination.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/50 px-6 py-3">
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Link2 size={11} />
            Linking only groups the two together — it never re-posts or changes anything on the platform.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
