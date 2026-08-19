import { Loader2 } from "lucide-react";
import { formatBytes, formatEta } from "@/lib/social/format";
import { type UploadProgressFile } from "@/lib/social/types";

/** Radius of the progress ring inside its 32x32 viewBox (3px stroke). */
const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function displayPercent(file: UploadProgressFile): number {
  if (file.status === "processing") return 100;
  return Math.max(0, Math.min(100, Math.round(file.progress)));
}

/**
 * Square tile shown in the composer's media grid while a file uploads, sized to
 * match the thumbnails beside it. Replaces a bare spinner, which gave no way to
 * tell a stalled 400 MB video from one that was nearly done.
 */
export function UploadProgressTile({ file }: { file: UploadProgressFile }) {
  const pct = displayPercent(file);
  const isProcessing = file.status === "processing";

  return (
    <div
      className="w-20 h-20 rounded-lg border border-border/50 bg-muted/30 flex flex-col items-center justify-center gap-1 shrink-0"
      role="progressbar"
      aria-label={`Uploading ${file.name}`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="relative h-11 w-11">
        <svg viewBox="0 0 32 32" className="h-11 w-11 -rotate-90">
          <circle cx="16" cy="16" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
          <circle
            cx="16" cy="16" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
            className={`text-primary transition-[stroke-dashoffset] duration-200 ease-linear ${isProcessing ? "animate-pulse" : ""}`}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
          />
        </svg>
        {/* The ring's hole is ~34px across; "100%" is the only four-glyph value
            and needs a point off to clear the stroke. */}
        <span className={`absolute inset-0 flex items-center justify-center font-black tabular-nums text-foreground ${pct >= 100 ? "text-[9px]" : "text-[10px]"}`}>
          {pct}%
        </span>
      </div>
      <span className="text-[8px] font-semibold text-muted-foreground text-center leading-tight px-1 truncate max-w-full">
        {isProcessing ? "Processing…" : formatEta(file.etaSeconds) || "Starting…"}
      </span>
    </div>
  );
}

/**
 * Per-file transfer readout under the media grid: name, bar, percentage,
 * bytes transferred, rate and time remaining.
 */
export function UploadProgressDetails({ files }: { files: UploadProgressFile[] }) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-1.5 pt-1">
      {files.map(file => {
        const pct = displayPercent(file);
        const isProcessing = file.status === "processing";
        const eta = isProcessing ? "" : formatEta(file.etaSeconds);

        return (
          <div key={file.id} className="space-y-1">
            <div className="flex items-center gap-2 text-[10px]">
              <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
              <span className="font-semibold text-foreground truncate flex-1 min-w-0" title={file.name}>{file.name}</span>
              <span className="font-bold text-muted-foreground tabular-nums shrink-0">{pct}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground tabular-nums">
              {isProcessing ? (
                // The bar is full but the request is still open while the API
                // streams the file to storage — say so instead of looking stuck.
                <span>Uploaded {formatBytes(file.totalBytes)} · finishing on the server…</span>
              ) : (
                <>
                  <span>{formatBytes(file.loadedBytes)} of {formatBytes(file.totalBytes)}</span>
                  {file.speedBps ? <span>· {formatBytes(file.speedBps)}/s</span> : null}
                  {eta ? <span>· {eta}</span> : null}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
