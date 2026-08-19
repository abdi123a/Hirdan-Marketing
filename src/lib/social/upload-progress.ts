/**
 * Transfer-rate and time-remaining tracking for media uploads.
 *
 * XHR progress events are noisy: the first few drain the socket buffer at an
 * apparent "infinite" rate, and events can arrive milliseconds apart. Feeding
 * that straight into an ETA produces a number that flickers between "2s left"
 * and "4m left" several times a second, which reads as broken. This smooths the
 * rate with an exponential moving average and only re-samples once enough time
 * has passed for the delta to mean something.
 *
 * Kept out of the composer page so the arithmetic can be tested against a fake
 * clock instead of a real network.
 */

/** Minimum gap between rate samples. Shorter deltas are too noisy to be useful. */
const SAMPLE_INTERVAL_MS = 350;

/** Weight of the running average vs. the newest sample. Higher = steadier ETA. */
const SMOOTHING = 0.6;

export interface UploadSample {
  /** 0-100, capped at 99 while bytes are still in flight. */
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  /** Smoothed bytes/sec, or null before the first usable sample. */
  speedBps: number | null;
  /** Seconds remaining at the smoothed rate, or null while unknown/stalled. */
  etaSeconds: number | null;
  /** True once every byte is on the wire and only the server side remains. */
  isTransferComplete: boolean;
}

export interface UploadTracker {
  sample: (loaded: number, total: number, nowMs: number) => UploadSample;
}

/**
 * @param startedAtMs the clock reading when the upload began, so the very first
 *   progress event can still yield a rate rather than waiting a full interval.
 */
export function createUploadTracker(startedAtMs: number): UploadTracker {
  let lastSampleAt = startedAtMs;
  let lastSampleLoaded = 0;
  let smoothedBps: number | null = null;

  return {
    sample(loaded: number, total: number, nowMs: number): UploadSample {
      const elapsed = (nowMs - lastSampleAt) / 1000;
      if (elapsed >= SAMPLE_INTERVAL_MS / 1000) {
        const instantBps = (loaded - lastSampleLoaded) / elapsed;
        // A negative or zero delta means a retry or a stall; keep the last known
        // rate rather than poisoning the average with it.
        if (instantBps > 0) {
          smoothedBps = smoothedBps == null
            ? instantBps
            : smoothedBps * SMOOTHING + instantBps * (1 - SMOOTHING);
        }
        lastSampleAt = nowMs;
        lastSampleLoaded = loaded;
      }

      const remaining = Math.max(0, total - loaded);
      const isTransferComplete = total > 0 && loaded >= total;
      const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

      return {
        // Hold just shy of full while bytes are in flight: the file is not
        // actually stored until the API responds, and a bar that hits 100% and
        // then sits there is the exact confusion this is meant to fix.
        progress: isTransferComplete ? 100 : Math.min(percent, 99),
        loadedBytes: loaded,
        totalBytes: total,
        speedBps: smoothedBps,
        etaSeconds: isTransferComplete
          ? 0
          : smoothedBps && smoothedBps > 0
            ? remaining / smoothedBps
            : null,
        isTransferComplete,
      };
    },
  };
}
