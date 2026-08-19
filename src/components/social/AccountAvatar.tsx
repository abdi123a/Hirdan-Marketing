import { useState } from "react";
import { platformLogo } from "@/lib/social/platform";

/**
 * The client's own logo (the account's profile picture) with the platform's
 * brand mark badged onto it — the same identity chip the composer shows under
 * "Publishing To", so the publish flow looks like one thing end to end.
 */

export type AccountAvatarStatus = "idle" | "queued" | "working" | "done" | "failed";

const STATUS_RING: Record<AccountAvatarStatus, string> = {
  idle: "ring-1 ring-border",
  // Queued accounts are dimmed rather than ringed, so the eye lands on whichever
  // one is actually publishing right now.
  queued: "ring-1 ring-border opacity-50 grayscale",
  working: "ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
  done: "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background",
  failed: "ring-2 ring-rose-500 ring-offset-2 ring-offset-background",
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export function AccountAvatar({
  name,
  platform,
  avatarUrl,
  status = "idle",
  size = 44,
  className = "",
}: {
  name: string;
  platform?: string;
  avatarUrl?: string | null;
  status?: AccountAvatarStatus;
  size?: number;
  className?: string;
}) {
  // A broken avatar URL must fall back to initials rather than leaving a torn
  // image icon where the client's logo should be.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imageFailed;
  const badgeSize = Math.max(16, Math.round(size * 0.42));

  return (
    <div
      className={`relative shrink-0 rounded-full transition-all duration-300 ${STATUS_RING[status]} ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={avatarUrl as string}
          alt={name}
          className="h-full w-full rounded-full object-cover border border-border/40"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full border border-border/40 bg-muted/60 dark:bg-muted/30 font-bold uppercase text-muted-foreground"
          style={{ fontSize: Math.max(9, Math.round(size * 0.3)) }}>
          {initialsOf(name)}
        </div>
      )}

      {platform && (
        <div
          className="absolute -bottom-0.5 -right-0.5 z-10 flex items-center justify-center rounded-full border border-border bg-background p-0.5 shadow-sm"
          style={{ width: badgeSize, height: badgeSize }}
        >
          {platformLogo(platform, "h-full w-full rounded-sm object-contain")}
        </div>
      )}
    </div>
  );
}
