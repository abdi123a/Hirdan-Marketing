import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Check, AlertCircle, FileText, Sparkles } from "lucide-react";
import { AccountAvatar } from "@/components/social/AccountAvatar";
import { formatDuration } from "@/lib/social/format";
import { PLATFORMS_CONFIG } from "@/lib/social/platform";

export interface PublishDestination {
  id: string;
  platform: string;
  accountName: string;
  avatarUrl?: string | null;
  status: string;
  error: string | null;
  platformPostId?: string | null;
}

export interface PublishStatus {
  postId: string | null;
  status: "idle" | "publishing" | "success" | "failed";
  totalDestinations: number;
  completedDestinations: number;
  failedDestinations: number;
  destinations: PublishDestination[];
}

/** "TikTok", not the "Tiktok" that a CSS capitalize on a lowercased id gives. */
function platformLabel(platform: string): string {
  const config = PLATFORMS_CONFIG.find(p => p.id === platform.toLowerCase());
  if (config) return config.label;
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}


/**
 * Time remaining, extrapolated from how long the finished destinations took.
 *
 * Returns null when there is nothing to extrapolate from. The old version
 * guessed "10 seconds per destination" and, once that guess ran out, printed
 * "Few seconds..." indefinitely — a video going to Instagram can take minutes,
 * so it sat there contradicting the elapsed counter. Saying nothing is honest.
 */
export function estimateRemainingSeconds(status: PublishStatus, elapsedSeconds: number): number | null {
  const finished = status.completedDestinations + status.failedDestinations;
  if (status.totalDestinations === 0) return null;
  if (finished >= status.totalDestinations) return 0;
  if (finished === 0) return null;

  const averagePerDestination = elapsedSeconds / finished;
  const remaining = status.totalDestinations - finished;
  return Math.max(1, Math.round(averagePerDestination * remaining));
}

export function PublishProgressDialog({
  open,
  onClose,
  status,
  elapsedSeconds,
  isTikTokDraft,
}: {
  open: boolean;
  onClose: () => void;
  status: PublishStatus;
  elapsedSeconds: number;
  isTikTokDraft: (dest: PublishDestination) => boolean;
}) {
  const isPublishing = status.status === "publishing";
  const finished = status.completedDestinations + status.failedDestinations;
  const percent = Math.round((finished / (status.totalDestinations || 1)) * 100);
  const remaining = estimateRemainingSeconds(status, elapsedSeconds);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Publishing is not cancellable, so the dialog refuses to close rather
        // than leaving the user watching a run they can no longer see.
        if (!next && !isPublishing) onClose();
      }}
    >
      <DialogContent
        className="max-w-md gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0 shadow-2xl"
        hideCloseButton={isPublishing}
      >
        {/* Overall progress rides the dialog's top edge, the way a browser shows
            page load. The destination rows below carry the detail, so a second
            full-width bar in the body would only repeat them. */}
        <div className="absolute inset-x-0 top-0 h-1 bg-muted">
          <div
            className={`h-full rounded-r-full transition-[width] duration-700 ease-out ${
              status.status === "failed" ? "bg-destructive" : status.status === "success" ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <DialogHeader className="space-y-0 px-6 pb-5 pt-7">
          <div className="flex items-start gap-3.5">
            <StatusMark status={status.status} />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[17px] font-bold leading-tight tracking-tight text-foreground">
                {isPublishing ? "Publishing post" : status.status === "success" ? "Post published" : "Published with errors"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-[13px] leading-snug text-muted-foreground">
                {isPublishing
                  ? "Keep this window open until every account is done."
                  : status.status === "success"
                    ? "Every account is live."
                    : "Some accounts did not go out. Hover a failure to see why."}
              </DialogDescription>
            </div>
            {/* The timer is the only number that changes second to second, so it
                gets the tabular treatment and its own corner. */}
            <div className="shrink-0 text-right">
              <div className="text-lg font-black leading-none tabular-nums text-foreground">{formatDuration(elapsedSeconds)}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Elapsed</div>
            </div>
          </div>
        </DialogHeader>

        <div className="border-y border-border/60 bg-muted/30 px-6 py-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="tabular-nums">
              <span className="font-black text-foreground">{finished}</span> of {status.totalDestinations} accounts done
            </span>
            {isPublishing && remaining != null && <span className="tabular-nums">about {formatDuration(remaining)} left</span>}
          </div>
        </div>

        <div className="max-h-[300px] space-y-1.5 overflow-y-auto px-4 py-4">
          {status.destinations.map(dest => (
            <DestinationRow key={dest.id} dest={dest} isTikTokDraft={isTikTokDraft} />
          ))}
        </div>

        {status.destinations.some(d => isTikTokDraft(d)) && (
          <div className="mx-4 mb-4 flex items-start gap-2.5 rounded-xl border border-secondary/40 bg-secondary/10 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <div>
              <p className="text-xs font-bold text-foreground">Waiting for you in the TikTok app</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                The video is in your TikTok inbox. Open the app on your phone to add sounds and a cover, then tap Post.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-border/60 px-6 py-4">
          {isPublishing ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Closing this tab will not stop the post going out, but you will lose this view.
            </p>
          ) : (
            <Button onClick={onClose} className="h-10 w-full rounded-xl font-bold">
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The header's state emblem: one shape, recoloured per outcome. */
function StatusMark({ status }: { status: PublishStatus["status"] }) {
  if (status === "success") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400">
        <Check className="h-5 w-5 stroke-[3px]" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/[0.12] text-destructive">
        <AlertCircle className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.12] text-primary">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/**
 * One account. The row is the progress instrument: a status rail down its left
 * edge, and while the platform is working — none of them report a percentage —
 * a sweep along the bottom stands in for one.
 */
function DestinationRow({
  dest,
  isTikTokDraft,
}: {
  dest: PublishDestination;
  isTikTokDraft: (dest: PublishDestination) => boolean;
}) {
  const isWorking = dest.status === "PUBLISHING";
  const isDone = dest.status === "PUBLISHED";
  const isFailed = dest.status === "FAILED";

  const rail = isDone ? "bg-emerald-500" : isFailed ? "bg-destructive" : isWorking ? "bg-secondary" : "bg-border";
  const surface = isFailed
    ? "border-destructive/25 bg-destructive/[0.04]"
    : isWorking
      ? "border-secondary/40 bg-secondary/[0.06]"
      : isDone
        ? "border-border/60 bg-background"
        : "border-border/40 bg-muted/20";

  return (
    <div className={`relative flex items-center gap-3 overflow-hidden rounded-xl border py-2.5 pl-4 pr-3 transition-colors ${surface}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${rail}`} />

      {/* No status ring here: the rail and the label already say the state, and
          a third signal turns the client's logo into a status chip. */}
      <AccountAvatar
        name={dest.accountName}
        platform={dest.platform}
        avatarUrl={dest.avatarUrl}
        status={dest.status === "QUEUED" ? "queued" : "idle"}
        size={38}
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold leading-tight text-foreground">{dest.accountName}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{platformLabel(dest.platform)}</div>
      </div>

      <DestinationStatusLabel dest={dest} isTikTokDraft={isTikTokDraft} />

      {isWorking && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden">
          <span className="block h-full w-1/4 bg-secondary motion-safe:animate-sweep" />
        </span>
      )}
    </div>
  );
}

function DestinationStatusLabel({
  dest,
  isTikTokDraft,
}: {
  dest: PublishDestination;
  isTikTokDraft: (dest: PublishDestination) => boolean;
}) {
  const base = "flex shrink-0 items-center gap-1.5 text-[11px] font-bold";

  if (dest.status === "PUBLISHING") {
    return (
      <span className={`${base} text-amber-600 dark:text-amber-400`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Publishing
      </span>
    );
  }

  if (dest.status === "PUBLISHED") {
    return isTikTokDraft(dest) ? (
      <span className={`${base} text-amber-600 dark:text-amber-400`}>
        <FileText className="h-3 w-3" />
        In drafts
      </span>
    ) : (
      <span className={`${base} text-emerald-600 dark:text-emerald-400`}>
        <Check className="h-3.5 w-3.5 stroke-[3px]" />
        Live
      </span>
    );
  }

  if (dest.status === "FAILED") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${base} cursor-help text-destructive`}>
              <AlertCircle className="h-3.5 w-3.5" />
              Failed
            </span>
          </TooltipTrigger>
          {dest.error && (
            <TooltipContent side="top" className="max-w-[220px] border border-border bg-popover p-2 text-[11px]">
              {dest.error}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span className={`${base} text-muted-foreground/70`}>Waiting</span>;
}
