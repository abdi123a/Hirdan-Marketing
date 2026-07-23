import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

/**
 * TikTok's user/info endpoint requires the `fields` query param to contain
 * literal, unencoded commas (e.g. ?fields=open_id,display_name). Axios's
 * `params` option runs values through URLSearchParams, which percent-encodes
 * the comma to %2C — TikTok then rejects the request with
 * {"error":{"code":"invalid_params","message":"Fields is required, please
 * provide fields in the request"}} because it doesn't recognize the encoded
 * field list. Building the query string manually avoids that encoding.
 */
function buildTikTokUserInfoUrl(fields: string[]): string {
  return `https://open.tiktokapis.com/v2/user/info/?fields=${fields.join(',')}`;
}

export function getTikTokAuthorizationUrl(clientId: string, groupId: string): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    throw new Error('TIKTOK_CLIENT_KEY is not configured');
  }

  const redirectUri = process.env.TIKTOK_REDIRECT_URI || '';
  const state = createOAuthState('tiktok', clientId, groupId);

  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user.info.basic,user.info.stats,video.publish,video.upload',
    state,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; open_id: string; username: string; avatarUrl?: string | null }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || '';

  if (!clientKey || !clientSecret) {
    throw new Error('TikTok credentials are not fully configured');
  }

  try {
    const { data } = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Get username
    const profileResponse = await axios.get(
      buildTikTokUserInfoUrl(['open_id', 'union_id', 'avatar_url', 'display_name']),
      { headers: { Authorization: `Bearer ${data.access_token}` } }
    );

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      open_id: data.open_id,
      username: profileResponse.data?.data?.user?.display_name || 'TikTok User',
      avatarUrl: profileResponse.data?.data?.user?.avatar_url || null,
    };
  } catch (err: any) {
    if (err.response?.data) {
      console.error('TikTok Token Exchange Error Response Data:', JSON.stringify(err.response.data));
      throw new Error(`TikTok OAuth Error: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

export async function refreshTikTokToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error('TikTok credentials are not fully configured');
  }

  const { data } = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

export interface TikTokCreatorInfo {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

/**
 * TikTok requires querying creator_info before every publish call.
 * This tells us which privacy_level values this specific creator's
 * account is actually allowed to use (unaudited apps, private accounts,
 * or accounts under 16 often cannot use PUBLIC_TO_EVERYONE), whether
 * posting is disabled, and video duration limits.
 * Docs: https://developers.tiktok.com/doc/content-sharing-guidelines/
 */
export async function getTikTokCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  try {
    const { data } = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    if (data?.error?.code && data.error.code !== 'ok') {
      throw new Error(`TikTok creator_info error: ${data.error.code} - ${data.error.message}`);
    }

    const info = data?.data;
    if (!info || !Array.isArray(info.privacy_level_options) || info.privacy_level_options.length === 0) {
      throw new Error('TikTok creator_info returned no usable privacy_level_options');
    }

    return info as TikTokCreatorInfo;
  } catch (err: any) {
    if (err.response?.data) {
      console.error('TikTok Creator Info Error Response Data:', JSON.stringify(err.response.data));
      throw new Error(`TikTok creator_info error: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

/**
 * Picks the best privacy level this creator's account actually supports,
 * preferring the requested one, falling back through a sane priority order,
 * instead of blindly sending PUBLIC_TO_EVERYONE and letting TikTok reject it.
 */
function resolvePrivacyLevel(requested: string, allowed: string[]): string {
  if (allowed.includes(requested)) return requested;

  const fallbackOrder = [
    'PUBLIC_TO_EVERYONE',
    'MUTUAL_FOLLOW_FRIENDS',
    'FOLLOWER_OF_CREATOR',
    'SELF_ONLY',
  ];
  const fallback = fallbackOrder.find((level) => allowed.includes(level));

  if (!fallback) {
    throw new Error(
      `No supported privacy_level for this TikTok account. Allowed options: ${allowed.join(', ')}`
    );
  }
  return fallback;
}

/**
 * Makes the actual video/init call to TikTok with a given privacy_level.
 * Split out so publishToTikTok can retry once with SELF_ONLY if TikTok
 * rejects the first attempt for being an unaudited client.
 */
async function initTikTokPublish({
  accessToken,
  mediaUrls,
  mediaType,
  caption,
  privacyLevel,
  creatorInfo,
}: {
  accessToken: string;
  mediaUrls: string[];
  mediaType: string;
  caption: string;
  privacyLevel: string;
  creatorInfo: TikTokCreatorInfo;
}): Promise<{ ok: boolean; publishId?: string; errorCode?: string; errorMessage?: string }> {
  const isVideo = mediaType === 'video';
  const endpoint = isVideo
    ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/content/init/';

  const payload: Record<string, any> = {
    post_info: {
      title: caption,
      privacy_level: privacyLevel,
      disable_duet: creatorInfo.duet_disabled,
      disable_comment: creatorInfo.comment_disabled,
      disable_stitch: creatorInfo.stitch_disabled,
    },
  };

  if (isVideo) {
    payload.post_info.video_cover_timestamp_ms = 1000;
    payload.source_info = {
      source: 'PULL_FROM_URL',
      video_url: mediaUrls[0],
    };
  } else {
    payload.post_mode = 'DIRECT_POST';
    payload.media_type = 'PHOTO';
    payload.source_info = {
      source: 'PULL_FROM_URL',
      photo_images: mediaUrls,
    };
  }

  const { data } = await axios.post(endpoint, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (data?.error?.code && data.error.code !== 'ok') {
    return { ok: false, publishId: undefined, errorCode: data.error.code, errorMessage: data.error.message };
  }
  return { ok: true, publishId: data.data.publish_id };
}

/**
 * TikTok "Draft" mode — uploads the video to the creator's TikTok inbox
 * via /v2/post/publish/inbox/video/init/. The creator finishes editing
 * (sounds, cover, effects) and posts from the TikTok app.
 */
async function initTikTokInbox({
  accessToken,
  mediaUrl,
  caption,
}: {
  accessToken: string;
  mediaUrl: string;
  caption: string;
}): Promise<{ ok: boolean; publishId?: string; errorCode?: string; errorMessage?: string }> {
  const { data } = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
    {
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: mediaUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (data?.error?.code && data.error.code !== 'ok') {
    return { ok: false, errorCode: data.error.code, errorMessage: data.error.message };
  }
  return { ok: true, publishId: data.data?.publish_id };
}

export async function publishToTikTok({
  accessToken,
  videoUrl,
  mediaUrls,
  mediaType = 'video',
  caption,
  privacyLevel = 'PUBLIC_TO_EVERYONE',
  postMode = 'direct',
}: {
  accessToken: string;
  videoUrl?: string;
  mediaUrls?: string[];
  mediaType?: string;
  caption: string;
  privacyLevel?: string;
  postMode?: 'direct' | 'draft';
}): Promise<string> {
  const resolvedMediaUrls = mediaUrls && mediaUrls.length > 0
    ? mediaUrls
    : (videoUrl ? [videoUrl] : []);

  if (resolvedMediaUrls.length === 0) {
    throw new Error('TikTok requires at least one media URL to publish');
  }

  // ── DRAFT mode: send to creator's inbox ──
  if (postMode === 'draft' && mediaType === 'video') {
    const inboxResult = await initTikTokInbox({
      accessToken,
      mediaUrl: resolvedMediaUrls[0],
      caption,
    });
    if (!inboxResult.ok) {
      const err: any = new Error(`TikTok inbox API error: ${inboxResult.errorMessage || 'Unknown'}`);
      err.tiktokErrorCode = inboxResult.errorCode;
      throw err;
    }
    return inboxResult.publishId as string;
  }

  // ── DIRECT mode: full publish flow ──
  // Step 1: query creator_info — required before every publish call, and the
  // only way to know what this account is actually allowed to do.
  const creatorInfo = await getTikTokCreatorInfo(accessToken);

  if (creatorInfo.max_video_post_duration_sec === 0 && mediaType === 'video') {
    throw new Error('TikTok reports posting is currently disabled for this creator account');
  }

  // While the app hasn't passed TikTok's Content Posting API audit, force
  // every publish to SELF_ONLY.
  const appIsAudited = process.env.TIKTOK_APP_AUDITED === 'true';
  const requestedPrivacyLevel = appIsAudited ? privacyLevel : 'SELF_ONLY';
  const resolvedPrivacyLevel = resolvePrivacyLevel(requestedPrivacyLevel, creatorInfo.privacy_level_options);

  // Step 2: init the actual publish with a privacy_level this account can use.
  let result = await initTikTokPublish({
    accessToken,
    mediaUrls: resolvedMediaUrls,
    mediaType,
    caption,
    privacyLevel: resolvedPrivacyLevel,
    creatorInfo,
  });

  // Safety net: retry once with SELF_ONLY if the first attempt fails for being unaudited.
  if (!result.ok && result.errorCode === 'unaudited_client_can_only_post_to_private_accounts' && resolvedPrivacyLevel !== 'SELF_ONLY') {
    console.error(
      `TikTok rejected privacy_level=${resolvedPrivacyLevel} as unaudited client, retrying with SELF_ONLY`
    );
    const fallbackLevel = resolvePrivacyLevel('SELF_ONLY', creatorInfo.privacy_level_options);
    result = await initTikTokPublish({
      accessToken,
      mediaUrls: resolvedMediaUrls,
      mediaType,
      caption,
      privacyLevel: fallbackLevel,
      creatorInfo,
    });
  }

  if (!result.ok) {
    const err: any = new Error(`TikTok API error: ${result.errorMessage || 'Unknown'}`);
    err.tiktokErrorCode = result.errorCode;
    console.error('TikTok publish/init Error Response Data:', JSON.stringify({ code: result.errorCode, message: result.errorMessage }));
    throw err;
  }

  return result.publishId as string;
}

export async function getTikTokInsights(accessToken: string): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  // FIX (made-up analytics): previously reach/impressions were derived as
  // followers*2 / followers*3 (or likes*1.5) — invented numbers, not real reach
  // or impressions. TikTok's public Display API does not expose account-level
  // reach/impressions/profile-visit metrics for most app tiers, so we return the
  // real follower/likes counts we CAN get and null for what we genuinely can't,
  // instead of fabricating a plausible-looking number.
  try {
    const { data } = await axios.get(
      buildTikTokUserInfoUrl(['follower_count', 'likes_count']),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (data?.error?.code && data.error.code !== 'ok') {
      // scope_not_authorized means this account's stored token was never
      // actually granted the scopes our app requests (e.g. user.info.stats).
      // That's a reconnect/app-approval problem, not a transient API error,
      // so surface it distinctly instead of a generic 401.
      if (data.error.code === 'scope_not_authorized') {
        throw new Error(
          `TikTok account is missing required scopes (user.info.stats). ` +
          `Reconnect the account, and confirm this app's scopes are approved ` +
          `in the TikTok developer portal. Raw error: ${data.error.message}`
        );
      }
      throw new Error(`TikTok user/info error: ${data.error.code} - ${data.error.message}`);
    }

    const user = data?.data?.user;
    if (!user) {
      return { followers: 0, reach: null, impressions: null, profileVisits: null };
    }

    return {
      followers: user.follower_count || 0,
      // Total likes is real data, but it isn't "reach" — don't relabel it as such.
      // Leaving null until TikTok's Business/Analytics API (separate app approval)
      // is wired in for genuine video view/reach numbers.
      reach: null,
      impressions: null,
      profileVisits: null,
    };
  } catch (err: any) {
    if (err.response?.data?.error?.code === 'scope_not_authorized') {
      const message = `TikTok account is missing required scopes (user.info.stats). ` +
        `Reconnect the account, and confirm this app's scopes are approved in the ` +
        `TikTok developer portal.`;
      console.error('Failed to fetch TikTok insights:', message);
      throw new Error(message);
    }
    console.error('Failed to fetch TikTok insights:', err.message);
    throw err;
  }
}
