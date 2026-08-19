// Shared social types and platform config.
//
// These lived in src/pages/SocialPublishPage.tsx, which meant three components
// under src/components/social/ imported runtime values from a page — the wrong
// direction. Mirrors the existing src/lib/email/types.ts convention.

// Week view's 2-hour slots. Previously stopped at 20:00 (covering up to
// 21:59), so anything scheduled 22:00-07:59 had no matching slot and simply
// didn't render — full 24h coverage so no scheduled post goes missing.
export const WEEK_VIEW_SLOTS = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

export interface SocialPost {
  id: string;
  clientId: string;
  caption: string;
  platformContent: any;
  mediaUrls: any;
  mediaType: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  campaignId: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  destinations: Array<{
    id: string;
    socialAccountId: string;
    platform: string;
    status: string;
    platformPostId?: string | null;
    lastError: string | null;
    socialAccount: { displayName: string; platformUsername?: string; avatarUrl?: string | null };
  }>;
}

export interface SocialAccount {
  id: string;
  platform: string;
  displayName: string;
  platformUsername: string;
  avatarUrl?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
}

export interface SocialCampaign {
  id: string;
  clientId: string;
  name: string;
  status: string;
}

export interface UploadProgressFile {
  id: string;
  name: string;
  /** 0-100, driven by real XHR upload progress rather than a timer. */
  progress: number;
  /**
   * "processing" is the gap between the browser finishing the transfer and the
   * API returning a URL — the server is still streaming the file to storage.
   * Without it a large video sits at 100% looking frozen.
   */
  status: "uploading" | "processing" | "done" | "failed";
  url?: string;
  type: string;
  /** Bytes transferred so far, for the "12.4 MB of 148 MB" line. */
  loadedBytes?: number;
  totalBytes?: number;
  /** Smoothed transfer rate in bytes/sec; null until there are enough samples. */
  speedBps?: number | null;
  /** Seconds remaining at the current rate; null while unknown or stalled. */
  etaSeconds?: number | null;
}
