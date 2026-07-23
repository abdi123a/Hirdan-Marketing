// ─────────────────────────────────────────────────────────────────────────────
// Metric availability registry — the single source of truth for "can this
// platform actually report this metric?". The analytics route uses it to decide
// whether a KPI/section is returned as a real value, greyed as locked/importable,
// or omitted entirely — so the API never emits a fake `0` for data no platform
// can provide. The frontend renders straight from the computed `capabilities`
// block, so the two layers can never disagree.
//
// Declared status (static, per platform+metric):
//   'live'   — obtainable now via the platform API with our current tokens/scopes
//   'scope'  — obtainable via API but needs an extra OAuth scope / app review
//              (rendered greyed with an "enable to view" note, never a fake 0)
//   'import' — not in the public API, but obtainable by importing the platform's
//              own analytics export (e.g. TikTok Studio XLSX)
//   'none'   — not obtainable by any means → omit from the UI
//
// Effective status (computed per request, depends on whether import data exists):
//   'available'  — show the real number
//   'locked'     — greyed, needs a scope/app-review the user must grant
//   'importable' — greyed, becomes real once the user imports their export
//   (metrics that resolve to nothing are omitted from `capabilities.metrics`)
// ─────────────────────────────────────────────────────────────────────────────

export type MetricStatus = 'live' | 'scope' | 'import' | 'none';
export type EffectiveStatus = 'available' | 'locked' | 'importable';

// Canonical metric keys used across the analytics response.
export type MetricKey =
  | 'followers'
  | 'reach'
  | 'impressions'
  | 'profileVisits'
  | 'engagementRate'
  | 'videoViews'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saved'
  | 'views'
  | 'newReturning'   // new vs returning viewers (import-only)
  | 'demoGender'
  | 'demoCountry'
  | 'demoAge'
  | 'activity'       // real active-followers heatmap (best time)
  | 'story';

export const METRIC_LABELS: Record<MetricKey, string> = {
  followers: 'Followers',
  reach: 'Reach',
  impressions: 'Impressions',
  profileVisits: 'Profile Visits',
  engagementRate: 'Engagement Rate',
  videoViews: 'Video Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saved: 'Saves',
  views: 'Views',
  newReturning: 'New vs Returning Viewers',
  demoGender: 'Gender',
  demoCountry: 'Top Countries',
  demoAge: 'Age',
  activity: 'Active Times',
  story: 'Story Insights',
};

type PlatformMatrix = Partial<Record<MetricKey, MetricStatus>>;

// Anything not listed for a platform defaults to 'none'.
export const METRIC_AVAILABILITY: Record<string, PlatformMatrix> = {
  facebook: {
    followers: 'live',
    reach: 'live',
    impressions: 'live',
    profileVisits: 'none',
    engagementRate: 'live',
    videoViews: 'live',
    likes: 'live',
    comments: 'live',
    shares: 'live',
    saved: 'none',
    views: 'live',
    demoGender: 'scope',
    demoCountry: 'scope',
    demoAge: 'scope',
    activity: 'live',
    story: 'none',
  },
  instagram: {
    followers: 'live',
    reach: 'scope',
    impressions: 'scope',
    profileVisits: 'scope',
    engagementRate: 'scope',
    videoViews: 'scope',
    likes: 'live',
    comments: 'live',
    shares: 'scope',
    saved: 'scope',
    views: 'scope',
    demoGender: 'scope',
    demoCountry: 'scope',
    demoAge: 'scope',
    activity: 'live',
    story: 'scope',
  },
  tiktok: {
    // Public API gives followers only; everything else comes from the
    // TikTok Studio XLSX export (Workstream 3).
    followers: 'live',
    reach: 'import',
    impressions: 'import',
    profileVisits: 'import',
    engagementRate: 'import',
    videoViews: 'import',
    likes: 'import',
    comments: 'import',
    shares: 'import',
    saved: 'none',
    views: 'import',
    newReturning: 'import',
    demoGender: 'import',
    demoCountry: 'import',
    demoAge: 'none', // shown in TikTok Studio UI but not included in the export
    activity: 'import',
    story: 'none',
  },
  youtube: {
    followers: 'live', // subscribers
    videoViews: 'live',
    views: 'live',
    likes: 'live',
    comments: 'live',
    activity: 'live',
  },
  linkedin: {
    followers: 'live',
    likes: 'live',
    comments: 'live',
    activity: 'live',
  },
  x: {
    followers: 'live',
    likes: 'live',
    comments: 'live',
    activity: 'live',
  },
  threads: {
    followers: 'live',
    likes: 'live',
    comments: 'live',
    activity: 'live',
  },
  pinterest: {
    followers: 'live',
    activity: 'live',
  },
};

export interface MetricCapability {
  status: EffectiveStatus;
  source: 'api' | 'import';
  platforms: string[]; // which of the active platforms provide this metric
  note?: string;
}

export interface Capabilities {
  platforms: string[];          // active platforms in the current view
  imported: string[];           // active platforms that have imported data
  metrics: Partial<Record<MetricKey, MetricCapability>>;
}

function noteFor(platform: string, key: MetricKey, decl: MetricStatus): string | undefined {
  if (decl === 'scope') {
    if (platform === 'instagram') return 'Reconnect Instagram with insights enabled to view';
    if (platform === 'facebook') return 'Requires advanced Page insights access';
    return 'Requires additional platform access';
  }
  if (decl === 'import') return 'Import your TikTok Studio export to view';
  return undefined;
}

// Rank so a union across platforms picks the strongest available signal.
const RANK: Record<EffectiveStatus, number> = { available: 3, importable: 2, locked: 1 };

/**
 * Compute the effective capabilities for a set of active platforms, given which
 * of them currently have imported data. Metrics that resolve to nothing for
 * every active platform are omitted entirely.
 */
export function computeCapabilities(
  activePlatforms: string[],
  importedPlatforms: Set<string>,
): Capabilities {
  const platforms = Array.from(new Set(activePlatforms.map(p => p.toLowerCase())));
  const metrics: Partial<Record<MetricKey, MetricCapability>> = {};

  const allKeys = Object.keys(METRIC_LABELS) as MetricKey[];
  for (const key of allKeys) {
    let best: MetricCapability | null = null;

    for (const platform of platforms) {
      const decl = (METRIC_AVAILABILITY[platform]?.[key] ?? 'none') as MetricStatus;
      let eff: EffectiveStatus | null = null;
      let source: 'api' | 'import' = 'api';

      if (decl === 'live') { eff = 'available'; source = 'api'; }
      else if (decl === 'scope') { eff = 'locked'; source = 'api'; }
      else if (decl === 'import') {
        source = 'import';
        eff = importedPlatforms.has(platform) ? 'available' : 'importable';
      }

      if (!eff) continue;

      const candidate: MetricCapability = {
        status: eff,
        source,
        platforms: [],
        note: noteFor(platform, key, decl),
      };
      if (!best || RANK[candidate.status] > RANK[best.status]) {
        best = candidate;
      }
    }

    if (best) {
      // coverage = platforms that reach the *best* status (so an "All" view
      // badge shows exactly which networks a real number aggregates over).
      best.platforms = platforms.filter(platform => {
        const decl = (METRIC_AVAILABILITY[platform]?.[key] ?? 'none') as MetricStatus;
        if (best!.status === 'available') {
          return decl === 'live' || (decl === 'import' && importedPlatforms.has(platform));
        }
        if (best!.status === 'importable') return decl === 'import';
        if (best!.status === 'locked') return decl === 'scope';
        return false;
      });
      if (best.status === 'available' && best.note) delete best.note;
      metrics[key] = best;
    }
  }

  return { platforms, imported: Array.from(importedPlatforms), metrics };
}

/** Convenience: is a metric effectively available (real number) for this view? */
export function isAvailable(caps: Capabilities, key: MetricKey): boolean {
  return caps.metrics[key]?.status === 'available';
}
