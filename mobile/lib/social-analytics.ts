import { endpoints } from '@hirdan/shared';
import { apiFetch, apiUpload } from './api-client';
import { formatCompact } from './social';

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
  | 'newReturning'
  | 'demoGender'
  | 'demoCountry'
  | 'demoAge'
  | 'activity'
  | 'story';

export type EffectiveStatus = 'available' | 'locked' | 'importable';

export type MetricCapability = {
  status: EffectiveStatus;
  source?: 'api' | 'import';
  platforms?: string[];
  note?: string;
};

export type Capabilities = {
  platforms?: string[];
  imported?: string[];
  metrics?: Partial<Record<MetricKey, MetricCapability>>;
};

export type NullableKPI = {
  current: number;
  previous: number | null;
  change: number | null;
  growth: number | null;
  isNew?: boolean;
} | null;

export type AnalyticsPost = {
  id: string;
  caption: string;
  mediaUrls?: string[] | null;
  mediaType?: string | null;
  thumbnailUrl?: string | null;
  isVerified?: boolean;
  verificationSource?: string | null;
  publishedAt?: string | null;
  destinations?: Array<{ platform: string; platformPostUrl?: string | null }>;
  imported?: boolean;
  link?: string | null;
  source?: 'scheduled' | 'imported' | 'both' | string;
  likes: number;
  comments: number;
  shares: number;
  saved?: number;
  views: number;
  reach: number;
  impressions?: number;
  engagement: number;
  engagementRate: number;
};

export type AnalyticsPostDetail = {
  id: string;
  caption?: string;
  mediaUrls?: string[] | null;
  mediaType?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  link?: string | null;
  source?: string;
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
    saved: number;
    engagement?: number;
    engagementRate: number;
  };
  breakdown: Array<{
    platform: string;
    accountName?: string | null;
    accountHandle?: string | null;
    handle?: string | null;
    updatedAt?: string | null;
    source?: string;
    link?: string | null;
    error?: string | null;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    metrics?: {
      views?: number | null;
      likes?: number | null;
      comments?: number | null;
      shares?: number | null;
      reach?: number | null;
      impressions?: number | null;
      saved?: number | null;
    };
  }>;
};

export type FullAnalytics = {
  empty?: boolean;
  capabilities?: Capabilities;
  provenance?: { imported: string[]; lastImportedAt: string | null };
  kpis?: {
    followers: NullableKPI;
    reach: NullableKPI;
    impressions: NullableKPI;
    profileVisits: NullableKPI;
    videoViews: NullableKPI;
    engagementRate: { current: number; previous: number; change: number } | null;
    engagement: {
      likes: number | null;
      comments: number | null;
      shares: number | null;
      saved: number | null;
      views: number | null;
      total: number;
    };
    viewers?: { new: number; returning: number } | null;
    publishing: {
      published: number;
      scheduled: number;
      draft: number;
      failed: number;
      pendingApproval: number;
    };
  };
  chartData?: Array<Record<string, number | string>>;
  engagementTrend?: Array<Record<string, number | string>>;
  contentTypePerformance?: Array<{
    type: string;
    count: number;
    avgReach?: number;
    avgEngagement?: number;
    avgViews?: number;
    avgSaved?: number;
    avgImpressions?: number;
  }>;
  bestTimes?: Array<{ day?: number; hour?: number; engagement?: number; weekday?: number; activeFollowers?: number }>;
  activityHeatmap?: Array<{ weekday: number; hour: number; activeFollowers: number }>;
  demographics?: {
    gender: Array<{ label: string; fraction: number; value?: number }>;
    country: Array<{ label: string; fraction: number; value?: number }>;
    age: Array<{ label: string; fraction: number; value?: number }>;
  };
  platformComparison?: Array<{
    platform: string;
    followers?: number;
    reach?: number;
    impressions?: number;
    engagement?: number;
    posts?: number;
    growth?: number | null;
  }>;
  platformBreakdown?: Array<{
    platform: string;
    name?: string;
    followers?: number;
    reach?: number;
    value?: number;
  }>;
  topPosts?: AnalyticsPost[];
  publishing?: {
    published: number;
    scheduled: number;
    draft: number;
    failed: number;
    pendingApproval: number;
    successRate: number;
    weeklyActivity?: Array<{ week: string; posts: number }>;
  };
  accounts?: Array<{
    id: string;
    platform: string;
    displayName: string;
    platformUsername: string;
    avatarUrl?: string | null;
    healthStatus?: string;
    healthMessage?: string | null;
    updatedAt?: string;
    lastImportedAt?: string | null;
    source?: string;
    metricStatus?: { reach?: string; impressions?: string; videoViews?: string };
    latestMetrics?: {
      followers: number | null;
      reach: number | null;
      impressions: number | null;
      profileVisits?: number | null;
      videoViews?: number | null;
      engagementRate: number | null;
      date: string | null;
      periodDays?: number;
    } | null;
  }>;
  monthlyComparison?: {
    current: Record<string, number>;
    previous: Record<string, number>;
  };
  aiInsights?: string[];
};

export type AnalyticsQuery = {
  days?: number;
  startDate?: string;
  endDate?: string;
  platform?: string;
  contentType?: string;
};

export const ANALYTICS_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'followers', label: 'Followers' },
  { key: 'reach', label: 'Reach' },
  { key: 'content', label: 'Content' },
  { key: 'video', label: 'Video' },
  { key: 'audience', label: 'Audience' },
  { key: 'besttime', label: 'Best Time' },
  { key: 'platforms', label: 'Platforms' },
  { key: 'publishing', label: 'Publishing' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'ai', label: 'AI Insights' },
  { key: 'export', label: 'Export' },
] as const;

export const CONTENT_TYPES = [
  { label: 'All types', value: 'ALL' },
  { label: 'Image', value: 'image' },
  { label: 'Video', value: 'video' },
  { label: 'Reel', value: 'reel' },
  { label: 'Story', value: 'story' },
  { label: 'Short', value: 'short' },
  { label: 'Carousel', value: 'carousel' },
  { label: 'Text', value: 'text' },
] as const;

export const POST_SORTS = [
  { label: 'Engagement', value: 'engagement' },
  { label: 'Likes', value: 'likes' },
  { label: 'Views', value: 'views' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
] as const;

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  tiktok: '#010101',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
  x: '#14171A',
  twitter: '#1DA1F2',
  threads: '#313131',
  pinterest: '#E60023',
};

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtN(n?: number | null): string {
  return formatCompact(n);
}

export function fmtPct(n?: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function capStatus(
  caps: Capabilities | undefined | null,
  key: MetricKey
): EffectiveStatus | null {
  return caps?.metrics?.[key]?.status ?? null;
}

export function capAvailable(
  caps: Capabilities | undefined | null,
  key: MetricKey
): boolean {
  return capStatus(caps, key) === 'available';
}

export function capOf(
  caps: Capabilities | undefined | null,
  key: MetricKey
): MetricCapability | null {
  return caps?.metrics?.[key] ?? null;
}

export function buildAnalyticsQuery(opts: AnalyticsQuery): string {
  const q = new URLSearchParams();
  if (opts.startDate && opts.endDate) {
    q.set('startDate', opts.startDate);
    q.set('endDate', opts.endDate);
    const fromT = new Date(opts.startDate).getTime();
    const toT = new Date(opts.endDate).getTime();
    q.set('days', String(Math.max(1, Math.round((toT - fromT) / 86400000))));
  } else {
    q.set('days', String(opts.days ?? 30));
  }
  q.set('platform', (opts.platform || 'ALL').toUpperCase());
  if (opts.contentType) q.set('contentType', opts.contentType);
  return q.toString();
}

export async function fetchFullAnalytics(
  clientId: string,
  opts: AnalyticsQuery
): Promise<FullAnalytics> {
  return apiFetch<FullAnalytics>(
    `${endpoints.social.analyticsFull(clientId)}?${buildAnalyticsQuery(opts)}`
  );
}

export async function fetchAnalyticsPosts(
  clientId: string,
  opts: AnalyticsQuery & {
    page?: number;
    limit?: number;
    sortBy?: string;
    search?: string;
  }
): Promise<{ posts: AnalyticsPost[]; total: number; page: number; limit: number }> {
  const q = buildAnalyticsQuery(opts);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 10;
  const sortBy = opts.sortBy ?? 'engagement';
  const search = opts.search ? `&search=${encodeURIComponent(opts.search)}` : '';
  return apiFetch(
    `${endpoints.social.analyticsPosts(clientId)}?page=${page}&limit=${limit}&sortBy=${sortBy}${search}&${q}`
  );
}

export async function fetchAnalyticsPostDetail(id: string): Promise<AnalyticsPostDetail> {
  return apiFetch<AnalyticsPostDetail>(endpoints.social.analyticsPost(id));
}

export async function refreshAnalytics(clientId: string): Promise<void> {
  await apiFetch(endpoints.social.analyticsRefresh(clientId), { method: 'POST' });
}

export async function importTiktokStudio(
  accountId: string,
  files: Array<{ uri: string; name: string; type: string }>
): Promise<{ imported?: number; message?: string }> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as unknown as Blob);
  }
  return apiUpload(endpoints.social.importTiktok(accountId), form);
}

export function postsToCsv(posts: AnalyticsPost[]): string {
  const header = [
    'Caption',
    'Platforms',
    'Date',
    'Type',
    'Likes',
    'Comments',
    'Shares',
    'Saved',
    'Views',
    'Reach',
    'Impressions',
    'Engagement',
    'ER%',
  ];
  const rows = posts.map((p) => {
    const platforms = (p.destinations || []).map((d) => d.platform).join('|');
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    return [
      esc(p.caption),
      esc(platforms),
      esc(p.publishedAt || ''),
      esc(p.mediaType || ''),
      p.likes ?? 0,
      p.comments ?? 0,
      p.shares ?? 0,
      p.saved ?? 0,
      p.views ?? 0,
      p.reach ?? 0,
      p.impressions ?? 0,
      p.engagement ?? 0,
      p.engagementRate ?? 0,
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

export function deltaTone(n?: number | null): 'success' | 'destructive' | 'default' {
  if (n == null || !Number.isFinite(n) || n === 0) return 'default';
  return n > 0 ? 'success' : 'destructive';
}

export function renderInsightParts(text: string): Array<{ text: string; bold?: boolean }> {
  const parts: Array<{ text: string; bold?: boolean }> = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
