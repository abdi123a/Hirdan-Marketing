// ─────────────────────────────────────────────────────────────────────────────
// Shared platform capability registry (frontend).
//
// Two concerns live here:
//  1. CONTENT TYPES — what each network (and our publishing backend) can actually
//     post, so the composer offers every real option per selected platform and
//     never offers one that can't publish. Reconciled against the publish switch
//     in server `platform-router.service.ts` + each `*.service.ts`.
//  2. ANALYTICS CAPABILITIES types — the shape of the `capabilities` block the
//     analytics API returns (mirror of server `metric-availability.ts`), so the
//     Analyze page renders straight from it (available / locked / importable).
// ─────────────────────────────────────────────────────────────────────────────

// ── Content types (scheduling / composer) ───────────────────────────────────

export type MediaKind = 'none' | 'image' | 'video' | 'images'; // images = carousel (≥2)

export interface ContentType {
  id: string;              // stored in platformContent[platform].type
  label: string;
  mediaKind: MediaKind;    // what media this type needs
  requiresMedia: boolean;
  hint?: string;
}

// Per-platform content types. Only types our backend can genuinely publish are
// listed (verified against platform-router.service.ts).
export const PLATFORM_CONTENT_TYPES: Record<string, ContentType[]> = {
  facebook: [
    { id: 'post',     label: 'Post',     mediaKind: 'none',   requiresMedia: false, hint: 'Text, optionally with a photo' },
    { id: 'reel',     label: 'Reel',     mediaKind: 'video',  requiresMedia: true,  hint: 'Vertical video' },
    { id: 'story',    label: 'Story',    mediaKind: 'image',  requiresMedia: true,  hint: 'Photo or video, 24h' },
    { id: 'carousel', label: 'Carousel', mediaKind: 'images', requiresMedia: true,  hint: '2+ photos' },
  ],
  instagram: [
    { id: 'post',     label: 'Post',     mediaKind: 'image',  requiresMedia: true,  hint: 'Single photo' },
    { id: 'reel',     label: 'Reel',     mediaKind: 'video',  requiresMedia: true,  hint: 'Vertical video' },
    { id: 'story',    label: 'Story',    mediaKind: 'image',  requiresMedia: true,  hint: 'Photo or video, 24h' },
    { id: 'carousel', label: 'Carousel', mediaKind: 'images', requiresMedia: true,  hint: '2+ photos/videos' },
  ],
  tiktok: [
    { id: 'video',  label: 'Video',  mediaKind: 'video',  requiresMedia: true, hint: 'Standard TikTok video' },
    { id: 'photo',  label: 'Photos', mediaKind: 'images', requiresMedia: true, hint: 'Photo carousel' },
  ],
  youtube: [
    { id: 'short', label: 'Short', mediaKind: 'video', requiresMedia: true, hint: 'Vertical video < 60s' },
    { id: 'video', label: 'Video', mediaKind: 'video', requiresMedia: true, hint: 'Standard video' },
  ],
  linkedin: [
    { id: 'post',  label: 'Post',  mediaKind: 'none',  requiresMedia: false, hint: 'Text, optional media' },
    { id: 'image', label: 'Image', mediaKind: 'image', requiresMedia: true },
    { id: 'video', label: 'Video', mediaKind: 'video', requiresMedia: true },
  ],
  x: [
    { id: 'post',  label: 'Post',  mediaKind: 'none',  requiresMedia: false, hint: 'Up to 280 chars' },
    { id: 'image', label: 'Image', mediaKind: 'image', requiresMedia: true },
    { id: 'video', label: 'Video', mediaKind: 'video', requiresMedia: true },
  ],
  threads: [
    { id: 'post',  label: 'Post',  mediaKind: 'none',  requiresMedia: false },
    { id: 'image', label: 'Image', mediaKind: 'image', requiresMedia: true },
    { id: 'video', label: 'Video', mediaKind: 'video', requiresMedia: true },
  ],
  pinterest: [
    { id: 'pin',   label: 'Pin',       mediaKind: 'image', requiresMedia: true },
    { id: 'video', label: 'Video Pin', mediaKind: 'video', requiresMedia: true },
  ],
};

export function contentTypesFor(platform: string): ContentType[] {
  return PLATFORM_CONTENT_TYPES[platform.toLowerCase()] || [];
}

// TikTok can publish in two modes (see server tiktok.service.ts). "Draft" uploads
// to the creator's TikTok inbox so they finish + post it from the app.
export const TIKTOK_POST_MODES = [
  {
    id: 'direct',
    label: 'Post directly',
    hint: 'Publishes to TikTok automatically. Public direct posting needs TikTok app approval (otherwise private).',
  },
  {
    id: 'draft',
    label: 'Save to TikTok drafts',
    hint: 'Uploads to your TikTok inbox — finish editing (sounds, effects, cover) and post it from the app.',
  },
] as const;

export type TikTokPostMode = (typeof TIKTOK_POST_MODES)[number]['id'];

/** Validate media against a content type; returns an error string or null. */
export function validateContentTypeMedia(
  type: ContentType | undefined,
  mediaUrls: string[],
  mediaType: string | null | undefined,
): string | null {
  if (!type) return null;
  const count = mediaUrls?.length || 0;
  const isVideo = mediaType === 'video';
  switch (type.mediaKind) {
    case 'video':
      if (count === 0) return `${type.label} requires a video.`;
      if (!isVideo) return `${type.label} requires a video (an image was attached).`;
      return null;
    case 'image':
      if (count === 0) return `${type.label} requires media.`;
      return null;
    case 'images':
      if (count < 2) return `${type.label} requires at least 2 items.`;
      return null;
    case 'none':
    default:
      return null;
  }
}

// ── Analytics capabilities (mirror of server metric-availability.ts) ─────────

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

export interface MetricCapability {
  status: EffectiveStatus;
  source: 'api' | 'import';
  platforms: string[];
  note?: string;
}

export interface Capabilities {
  platforms: string[];
  imported: string[];
  metrics: Partial<Record<MetricKey, MetricCapability>>;
}

/** Effective status of a metric in the current view, or null if omitted/hidden. */
export function capStatus(
  caps: Capabilities | undefined | null,
  key: MetricKey,
): EffectiveStatus | null {
  return caps?.metrics?.[key]?.status ?? null;
}

/** True when a metric has a real value to show. */
export function capAvailable(caps: Capabilities | undefined | null, key: MetricKey): boolean {
  return capStatus(caps, key) === 'available';
}

export function capOf(
  caps: Capabilities | undefined | null,
  key: MetricKey,
): MetricCapability | null {
  return caps?.metrics?.[key] ?? null;
}
