/**
 * Shared social formatting helpers.
 *
 * Mirrors the existing src/lib/email/ split (format.ts / status.ts / types.ts).
 * These used to be copy-pasted per page as `fmtN` / `fmtNum`, each with slightly
 * different null handling — one of them took a plain `number` and rendered
 * "NaN" when the API returned null.
 */

/**
 * Compact metric display: 1.2M / 4.5K / 812.
 *
 * Null and undefined render as an em dash rather than "0", because a metric the
 * platform does not report is not the same as a metric that is zero.
 */
export function compactNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Byte size for upload UI: "48.2 MB" / "512 KB" / "900 B".
 *
 * Kept deliberately short (one decimal below 10, none above) so a
 * "12.4 MB of 148 MB" line stays readable inside the composer's narrow media
 * column rather than wrapping.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Remaining-time label for an in-flight transfer: "14s left", "3m 05s left".
 *
 * Returns an empty string when the estimate is unknown (no samples yet, or a
 * stalled connection producing a zero rate) so callers can simply omit the
 * label instead of showing a misleading "0s left" or "Infinity".
 */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";

  const total = Math.ceil(seconds);
  if (total < 1) return "almost done";
  if (total < 60) return `${total}s left`;

  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return `${minutes}m ${String(secs).padStart(2, "0")}s left`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m left`;
}

/**
 * Elapsed/remaining duration for the publish progress modal: "32s", "1m 30s".
 *
 * Distinct from formatEta: this is a bare duration with no "left" suffix, and
 * a known zero renders as "0s" rather than being suppressed.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";

  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return `${minutes}m ${String(secs).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
