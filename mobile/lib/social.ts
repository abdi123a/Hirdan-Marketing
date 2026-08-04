import { endpoints } from '@hirdan/shared';
import { apiFetch, apiUpload } from './api-client';
import { unwrapList } from './format';

export type SocialPostStatus =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'PARTIAL'
  | 'FAILED';

export type SocialDestinationStatus =
  | 'QUEUED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'DRAFT';

export type SocialAccount = {
  id: string;
  clientId: string;
  platform: string;
  displayName: string;
  platformUsername: string;
  avatarUrl?: string | null;
  healthStatus?: string | null;
  healthMessage?: string | null;
  isActive?: boolean;
  lastImportedAt?: string | null;
  tokenExpiresAt?: string | null;
  lastSync?: string | null;
  capabilities?: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: string;
  client?: { name?: string | null; company?: string | null } | null;
};

export type SocialWorkspace = {
  clientId: string;
  clientName: string;
  clientCompany: string;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'empty' | string;
  accounts: SocialAccount[];
  connectedPlatforms: string[];
  missingPlatforms: string[];
  lastPublish: string | null;
  lastSync: string | null;
  totalFollowers: number;
  accountCount: number;
};

export type WorkspaceSummaryResponse = {
  summary: {
    totalWorkspaces: number;
    totalAccounts: number;
    activePlatforms: number;
    needsAttention: number;
  };
  workspaces: SocialWorkspace[];
};

export type AccountActivityEvent = {
  type: string;
  label: string;
  detail?: string;
  date: string;
};

export const PLATFORM_CAPABILITIES: Record<string, Record<string, boolean>> = {
  facebook: { Publishing: true, Analytics: true, Comments: true, Messages: true, Reels: true, Stories: true },
  instagram: { Publishing: true, Analytics: true, Comments: true, Messages: false, Reels: true, Stories: true },
  linkedin: { Publishing: true, Analytics: true, Comments: false, Messages: false, Reels: false, Stories: false },
  tiktok: { Publishing: true, Analytics: true, Comments: false, Messages: false, Reels: true, Stories: false },
  youtube: { Publishing: true, Analytics: true, Comments: false, Messages: false, Reels: true, Stories: false },
  x: { Publishing: true, Analytics: true, Comments: true, Messages: false, Reels: false, Stories: false },
  pinterest: { Publishing: true, Analytics: false, Comments: false, Messages: false, Reels: false, Stories: false },
  threads: { Publishing: true, Analytics: false, Comments: false, Messages: false, Reels: false, Stories: false },
};

export type SocialDestination = {
  id: string;
  socialAccountId: string;
  platform: string;
  status: string;
  platformPostId?: string | null;
  platformPostUrl?: string | null;
  lastError?: string | null;
  socialAccount?: {
    displayName?: string | null;
    platformUsername?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type SocialPost = {
  id: string;
  clientId: string;
  caption: string;
  platformContent?: Record<string, unknown> | null;
  mediaUrls?: string[] | null;
  mediaType?: string | null;
  status: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  campaignId?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  destinations: SocialDestination[];
};

export type SocialCampaign = {
  id: string;
  clientId: string;
  name: string;
  status?: string;
};

export type CreateSocialPostInput = {
  clientId: string;
  accountIds: string[];
  caption: string;
  mediaUrls?: string[];
  mediaType?: string;
  scheduledFor?: string | null;
  status?: SocialPostStatus | string;
  campaignId?: string | null;
  platformContent?: Record<string, unknown>;
};

export type { FullAnalytics, NullableKPI } from './social-analytics';
export { fetchFullAnalytics, refreshAnalytics } from './social-analytics';

export const SOCIAL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
  { id: 'tiktok', label: 'TikTok', color: '#010101' },
  { id: 'x', label: 'X / Twitter', color: '#14171A' },
  { id: 'threads', label: 'Threads', color: '#313131' },
  { id: 'pinterest', label: 'Pinterest', color: '#E60023' },
] as const;

/** Local brand marks used as platform badges (same assets as the web app). */
export const PLATFORM_ICON_ASSETS: Record<string, number> = {
  facebook: require('../assets/social-icons/Facebook.png'),
  instagram: require('../assets/social-icons/instagram.png'),
  linkedin: require('../assets/social-icons/linkedin.png'),
  youtube: require('../assets/social-icons/youtube.png'),
  tiktok: require('../assets/social-icons/tiktok.png'),
  x: require('../assets/social-icons/twitter.png'),
  twitter: require('../assets/social-icons/twitter.png'),
  threads: require('../assets/social-icons/Threads.png'),
  pinterest: require('../assets/social-icons/pinterest.png'),
};

export function platformIconSource(platform?: string | null): number | undefined {
  if (!platform) return undefined;
  return PLATFORM_ICON_ASSETS[platform.toLowerCase()];
}

export const POST_STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Awaiting', value: 'AWAITING_APPROVAL' },
] as const;

export function platformLabel(platform?: string | null): string {
  if (!platform) return 'Unknown';
  const found = SOCIAL_PLATFORMS.find((p) => p.id === platform.toLowerCase());
  return found?.label || platform;
}

export function platformColor(platform?: string | null): string {
  if (!platform) return '#6B6578';
  const found = SOCIAL_PLATFORMS.find((p) => p.id === platform.toLowerCase());
  return found?.color || '#6B6578';
}

export function postStatusTone(
  status?: string
): 'success' | 'warning' | 'destructive' | 'default' {
  const s = String(status || '').toUpperCase();
  if (s === 'PUBLISHED') return 'success';
  if (s === 'SCHEDULED' || s === 'AWAITING_APPROVAL' || s === 'PARTIAL') return 'warning';
  if (s === 'FAILED') return 'destructive';
  return 'default';
}

export function healthTone(
  status?: string | null
): 'success' | 'warning' | 'destructive' | 'default' {
  const s = String(status || '').toUpperCase();
  if (s === 'HEALTHY' || s === 'OK' || s === 'ACTIVE') return 'success';
  if (s === 'WARNING' || s === 'EXPIRING') return 'warning';
  if (s === 'ERROR' || s === 'EXPIRED' || s === 'REVOKED' || s === 'CRITICAL') return 'destructive';
  return 'default';
}

export function accountDisplayName(account: SocialAccount): string {
  return account.displayName || account.platformUsername || platformLabel(account.platform);
}

export function postPreview(post: SocialPost): string {
  const caption = (post.caption || '').trim();
  if (caption) return caption;
  return 'Untitled post';
}

export function postPlatforms(post: SocialPost): string[] {
  const set = new Set(
    (post.destinations || []).map((d) => d.platform?.toLowerCase()).filter(Boolean)
  );
  return Array.from(set);
}

export function formatCompact(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function formatPct(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

export async function fetchSocialAccounts(limit = 1000): Promise<SocialAccount[]> {
  const res = await apiFetch<unknown>(`${endpoints.social.accounts}?limit=${limit}`);
  return unwrapList<SocialAccount>(res);
}

export async function fetchAccountsByClient(clientId: string): Promise<SocialAccount[]> {
  const res = await apiFetch<SocialAccount[] | { accounts: SocialAccount[] }>(
    endpoints.social.accountsByClient(clientId)
  );
  return Array.isArray(res) ? res : res.accounts || [];
}

export async function fetchSocialPosts(params?: {
  clientId?: string;
  status?: string;
  limit?: number;
  page?: number;
}): Promise<{ posts: SocialPost[]; total: number }> {
  const q = new URLSearchParams();
  q.set('limit', String(params?.limit ?? 100));
  q.set('page', String(params?.page ?? 1));
  if (params?.clientId) q.set('clientId', params.clientId);
  if (params?.status) q.set('status', params.status);
  const res = await apiFetch<{ posts: SocialPost[]; total: number }>(
    `${endpoints.social.posts}?${q.toString()}`
  );
  return { posts: res.posts || [], total: res.total ?? 0 };
}

export async function fetchSocialPost(id: string): Promise<SocialPost> {
  return apiFetch<SocialPost>(endpoints.social.postById(id));
}

export async function createSocialPost(input: CreateSocialPostInput): Promise<SocialPost> {
  return apiFetch<SocialPost>(endpoints.social.posts, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSocialPost(
  id: string,
  input: Partial<CreateSocialPostInput>
): Promise<SocialPost> {
  return apiFetch<SocialPost>(endpoints.social.postById(id), {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteSocialPost(id: string): Promise<void> {
  await apiFetch(endpoints.social.postById(id), { method: 'DELETE' });
}

export async function publishSocialPostNow(
  id: string,
  accountIds?: string[]
): Promise<SocialPost> {
  return apiFetch<SocialPost>(endpoints.social.publishNow(id), {
    method: 'POST',
    body: JSON.stringify(accountIds?.length ? { accountIds } : {}),
  });
}

export async function retrySocialPost(id: string): Promise<SocialPost> {
  return apiFetch<SocialPost>(endpoints.social.retryPost(id), { method: 'POST' });
}

export async function uploadSocialMedia(file: {
  uri: string;
  name: string;
  type: string;
}): Promise<string> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  const res = await apiUpload<{ url: string }>(endpoints.social.mediaUpload, form);
  if (!res.url) throw new Error('Upload failed — no URL returned');
  return res.url;
}

export async function generateAiCaption(prompt: string, platform: string): Promise<string> {
  const res = await apiFetch<{ caption?: string; text?: string }>(endpoints.social.aiCaption, {
    method: 'POST',
    body: JSON.stringify({ prompt, platform }),
  });
  return res.caption || res.text || '';
}

export async function fetchCampaigns(clientId?: string): Promise<SocialCampaign[]> {
  const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  const res = await apiFetch<SocialCampaign[] | { campaigns: SocialCampaign[] }>(
    `${endpoints.social.campaigns}${q}`
  );
  return Array.isArray(res) ? res : unwrapList<SocialCampaign>(res);
}

export async function createCampaign(clientId: string, name: string): Promise<SocialCampaign> {
  return apiFetch<SocialCampaign>(endpoints.social.campaigns, {
    method: 'POST',
    body: JSON.stringify({ clientId, name }),
  });
}

export async function fetchWorkspaceSummary(): Promise<WorkspaceSummaryResponse> {
  return apiFetch<WorkspaceSummaryResponse>(endpoints.social.workspaceSummary);
}

export async function fetchAccountActivity(
  accountId: string
): Promise<AccountActivityEvent[]> {
  const res = await apiFetch<{ events: AccountActivityEvent[] }>(
    endpoints.social.accountActivity(accountId)
  );
  return res.events || [];
}

export async function fetchOAuthPending(sessionId: string): Promise<{
  platform: string;
  expiresIn: number;
  clientId?: string;
  accounts: Array<{
    id: string;
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
    followers?: number;
    platform?: string;
    ownedBy?: { clientId: string; clientName: string; accountName: string } | null;
  }>;
}> {
  return apiFetch(endpoints.social.oauthPending(sessionId));
}

export async function selectOAuthAccounts(
  sessionId: string,
  assignments: Array<{ id: string; clientId: string }>
): Promise<{ created?: number; message?: string }> {
  return apiFetch(endpoints.social.oauthSelectAccount, {
    method: 'POST',
    body: JSON.stringify({ sessionId, assignments }),
  });
}

export async function syncSocialAccount(accountId: string): Promise<void> {
  await apiFetch(endpoints.social.accountSync(accountId), { method: 'POST' });
}

export async function disconnectSocialAccount(accountId: string): Promise<void> {
  await apiFetch(endpoints.social.accountById(accountId), { method: 'DELETE' });
}

export async function fetchPlatformStatus(): Promise<
  Record<string, { configured?: boolean; enabled?: boolean }>
> {
  try {
    return await apiFetch<Record<string, { configured?: boolean; enabled?: boolean }>>(
      endpoints.social.platformStatus
    );
  } catch {
    return {};
  }
}

export async function getOAuthConnectUrl(
  platform: string,
  clientId: string
): Promise<string> {
  const res = await apiFetch<{ url: string }>(
    `${endpoints.social.oauthConnect}?platform=${encodeURIComponent(platform)}&clientId=${encodeURIComponent(clientId)}&groupId=${encodeURIComponent(clientId)}`
  );
  if (!res.url) throw new Error('No OAuth URL returned');
  return res.url;
}

/** Build local ISO datetime from date (YYYY-MM-DD) + time (HH:mm). */
export function combineLocalDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}
