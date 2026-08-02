import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';
import { getMediaBuffer } from './storage.service.js';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Meta fetches media URLs from their servers — localhost / private hosts fail. */
export function isPubliclyReachableMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
      return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function uploadFacebookPhotoBinary(
  pageId: string,
  pageAccessToken: string,
  mediaUrl: string,
  caption?: string,
  published = true,
): Promise<string> {
  const buffer = await getMediaBuffer(mediaUrl);
  const form = new FormData();
  const filename = mediaUrl.split('/').pop()?.split('?')[0] || 'photo.jpg';
  form.append('source', new Blob([new Uint8Array(buffer)]), filename);
  form.append('access_token', pageAccessToken);
  form.append('published', published ? 'true' : 'false');
  if (caption && published) form.append('caption', caption);

  const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, form);
  return data.id;
}

async function uploadFacebookVideoBinary(
  pageId: string,
  pageAccessToken: string,
  mediaUrl: string,
  caption?: string,
): Promise<string> {
  const buffer = await getMediaBuffer(mediaUrl);
  const form = new FormData();
  const filename = mediaUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
  form.append('source', new Blob([new Uint8Array(buffer)]), filename);
  form.append('access_token', pageAccessToken);
  if (caption) form.append('description', caption);

  const { data } = await axios.post(`${GRAPH_URL}/${pageId}/videos`, form, {
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data.id || data.video_id;
}

export const RATE_LIMIT_CODES = [4, 17, 32, 613];
const TIKTOK_RATE_LIMIT_CODES = ['rate_limit_exceeded', 'spam_risk_too_many_posts', 'spam_risk_user_banned_from_posting'];

export function isRateLimitError(err: any): boolean {
  if (err?.response?.status === 429) return true;
  const fbError = err?.response?.data?.error;
  if (fbError && RATE_LIMIT_CODES.includes(fbError.code)) {
    return true;
  }
  if (err?.tiktokErrorCode && TIKTOK_RATE_LIMIT_CODES.includes(err.tiktokErrorCode)) {
    return true;
  }
  return false;
}

export function getMetaAuthorizationUrl(platform: 'facebook' | 'instagram' | 'threads', clientId: string, groupId: string): string {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    throw new Error('META_APP_ID is not configured in environment variables');
  }

  let redirectUri = '';
  let scopes: string[] = [];

  if (platform === 'facebook') {
    redirectUri = process.env.META_REDIRECT_URI_FACEBOOK || '';
    // Must match permissions enabled on the Meta "Facebook Login for Business"
    // configuration. pages_read_user_content is NOT offered in that picker and
    // causes "Invalid Scopes" — page content/insights use pages_read_engagement.
    scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_metadata',
      'read_insights',
      'business_management',
    ];
  } else if (platform === 'instagram') {
    redirectUri = process.env.META_REDIRECT_URI_INSTAGRAM || '';
    // Same Login-for-Business constraint: only request scopes that exist on the
    // configuration. IG publish + insights need the instagram_* permissions below.
    scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'read_insights',
      'business_management',
    ];
  } else if (platform === 'threads') {
    redirectUri = process.env.META_REDIRECT_URI_THREADS || '';
    scopes = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];
  }

  const state = createOAuthState(platform, clientId, groupId);
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, scope: scopes.join(','), response_type: 'code' });

  if (platform === 'threads') {
    return `https://www.threads.net/oauth/authorize?${params.toString()}`;
  }
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCodeForToken(platform: 'facebook' | 'instagram' | 'threads', code: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  let redirectUri = '';

  if (platform === 'facebook') redirectUri = process.env.META_REDIRECT_URI_FACEBOOK || '';
  else if (platform === 'instagram') redirectUri = process.env.META_REDIRECT_URI_INSTAGRAM || '';
  else if (platform === 'threads') redirectUri = process.env.META_REDIRECT_URI_THREADS || '';

  if (!appId || !appSecret) throw new Error('Meta credentials are not fully configured');

  if (platform === 'threads') {
    const { data } = await axios.post('https://graph.threads.net/oauth/access_token', new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code,
    }));
    return data.access_token;
  }

  const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
  });
  return data.access_token;
}

export async function getMetaLongLivedToken(shortLivedToken: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Meta credentials are not fully configured');
  const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken },
  });
  return data.access_token;
}

export async function getThreadsProfile(accessToken: string): Promise<{ userId: string; username: string; avatarUrl: string | null; followers: number }> {
  const { data } = await axios.get('https://graph.threads.net/v1.0/me', {
    params: { fields: 'id,username,threads_profile_picture_url,threads_biography', access_token: accessToken },
  });
  let followers = 0;
  try {
    const { data: insightsData } = await axios.get(`https://graph.threads.net/v1.0/${data.id}/threads_insights`, {
      params: { metric: 'followers_count', access_token: accessToken },
    });
    followers = insightsData?.data?.find((m: any) => m.name === 'followers_count')?.total_value?.value || 0;
  } catch (e: any) {
    console.warn('[Meta Service] Could not fetch Threads follower count:', e.message);
  }
  return { userId: data.id, username: data.username || 'Threads User', avatarUrl: data.threads_profile_picture_url || null, followers };
}

export interface MetaPageInstagramInfo {
  pageId: string; pageName: string; pageAccessToken: string; pageFollowers: number; pageAvatarUrl: string | null;
  igAccountId: string | null; igUsername: string | null; igFollowers: number | null; igAvatarUrl: string | null;
}

export async function getPagesWithInstagram(userAccessToken: string): Promise<MetaPageInstagramInfo[]> {
  const { data } = await axios.get(`${GRAPH_URL}/me/accounts`, {
    params: {
      access_token: userAccessToken,
      fields: 'id,name,access_token,fan_count,picture{url},instagram_business_account{id,username,followers_count,profile_picture_url}',
    },
  });
  if (!data || !data.data) return [];
  return data.data.map((page: any) => ({
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    pageFollowers: page.fan_count || 0,
    pageAvatarUrl: page.picture?.data?.url || null,
    igAccountId: page.instagram_business_account?.id || null,
    igUsername: page.instagram_business_account?.username || null,
    igFollowers: page.instagram_business_account?.followers_count ?? null,
    igAvatarUrl: page.instagram_business_account?.profile_picture_url || null,
  }));
}

async function publishVideoToMetaResumable({
  pageId,
  pageAccessToken,
  url,
  caption,
  endpointType,
}: {
  pageId: string;
  pageAccessToken: string;
  url: string;
  caption?: string;
  endpointType: 'video_reels' | 'video_stories';
}): Promise<string> {
  // Step 1: Initialize the upload session
  const initRes = await axios.post(`${GRAPH_URL}/${pageId}/${endpointType}`, null, {
    params: {
      upload_phase: 'start',
      access_token: pageAccessToken,
    },
  });

  const { video_id, upload_url } = initRes.data;
  if (!video_id || !upload_url) {
    throw new Error(`Failed to initialize Facebook video upload session for ${endpointType}`);
  }

  // Step 2: Load the video (supports local STORAGE_PUBLIC_URL via getMediaBuffer)
  const videoBuffer = await getMediaBuffer(url);

  // Step 3: Upload the binary data to the upload URL
  await axios.post(upload_url, videoBuffer, {
    headers: {
      'Authorization': `OAuth ${pageAccessToken}`,
      'offset': '0',
      'file_size': videoBuffer.length.toString(),
      'Content-Type': 'application/octet-stream',
    },
  });

  // Step 4: Finalize and publish the video
  const finishParams: Record<string, any> = {
    upload_phase: 'finish',
    video_id,
    access_token: pageAccessToken,
  };

  if (endpointType === 'video_reels') {
    finishParams.video_state = 'PUBLISHED';
    if (caption) {
      finishParams.description = caption;
    }
  }

  const publishRes = await axios.post(`${GRAPH_URL}/${pageId}/${endpointType}`, null, {
    params: finishParams,
  });

  return publishRes.data.video_id || publishRes.data.post_id || publishRes.data.id || video_id;
}

export async function publishToFacebookPage({
  pageId,
  pageAccessToken,
  caption,
  mediaUrls,
  mediaType = 'image',
  postType = 'post',
}: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  mediaUrls?: string[];
  mediaType?: string;
  postType?: 'post' | 'reel' | 'story';
}): Promise<string> {
  const url = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null;

  // --- REEL ---
  if (postType === 'reel') {
    console.log('[DEBUG] Entering REEL branch');
    if (!url) throw new Error('Facebook Reel requires a video URL');
    return await publishVideoToMetaResumable({
      pageId,
      pageAccessToken,
      url,
      caption,
      endpointType: 'video_reels',
    });
  }

  // --- STORY ---
  if (postType === 'story') {
    console.log('[DEBUG] Entering STORY branch');
    if (!url) throw new Error('Facebook Story requires a media URL');
    if (mediaType === 'video') {
      return await publishVideoToMetaResumable({
        pageId,
        pageAccessToken,
        url,
        caption,
        endpointType: 'video_stories',
      });
    } else {
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photo_stories`, null, {
        params: { url, access_token: pageAccessToken },
      });
      return data.id;
    }
  }

  // --- CAROUSEL (Multiple Images) ---
  if (mediaUrls && mediaUrls.length > 1 && mediaType !== 'video') {
    const mediaFbids = [];
    for (const imgUrl of mediaUrls) {
      let photoId: string;
      if (isPubliclyReachableMediaUrl(imgUrl)) {
        const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, null, {
          params: { url: imgUrl, published: false, access_token: pageAccessToken },
        });
        photoId = data.id;
      } else {
        photoId = await uploadFacebookPhotoBinary(pageId, pageAccessToken, imgUrl, undefined, false);
      }
      mediaFbids.push({ media_fbid: photoId });
    }
    const { data } = await axios.post(`${GRAPH_URL}/${pageId}/feed`, null, {
      params: {
        message: caption,
        attached_media: JSON.stringify(mediaFbids),
        access_token: pageAccessToken,
      },
    });
    return data.id;
  }

  // --- SINGLE VIDEO ---
  if (mediaType === 'video' && url) {
    if (isPubliclyReachableMediaUrl(url)) {
      const videoParams: Record<string, any> = { file_url: url, access_token: pageAccessToken };
      if (caption) {
        videoParams.description = caption;
      }
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/videos`, null, {
        params: videoParams,
      });
      return data.id || data.video_id;
    }
    return await uploadFacebookVideoBinary(pageId, pageAccessToken, url, caption);
  }

  // --- SINGLE IMAGE ---
  if (url) {
    if (isPubliclyReachableMediaUrl(url)) {
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, null, {
        params: { url, caption, access_token: pageAccessToken },
      });
      return data.id;
    }
    return await uploadFacebookPhotoBinary(pageId, pageAccessToken, url, caption, true);
  }

  // --- PLAIN TEXT ---
  const { data } = await axios.post(`${GRAPH_URL}/${pageId}/feed`, null, {
    params: { message: caption, access_token: pageAccessToken },
  });
  return data.id;
}

export async function publishToInstagram({
  igAccountId,
  pageAccessToken,
  caption,
  mediaUrls,
  mediaType = 'image',
  postType = 'post',
}: {
  igAccountId: string;
  pageAccessToken: string;
  caption: string;
  mediaUrls?: string[];
  mediaType?: string;
  postType?: 'post' | 'reel' | 'story';
}): Promise<string> {
  const url = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : '';
  const containerParams: Record<string, any> = { caption, access_token: pageAccessToken };

  const assertPublicMedia = (mediaUrl: string, label: string) => {
    if (!mediaUrl) throw new Error(`${label} requires a media URL`);
    if (!isPubliclyReachableMediaUrl(mediaUrl)) {
      throw new Error(
        `Instagram cannot fetch media from a private/local URL (${mediaUrl}). Set STORAGE_PUBLIC_URL to a publicly reachable HTTPS URL (e.g. S3/CDN).`,
      );
    }
  };

  if (postType === 'reel') {
    assertPublicMedia(url, 'Instagram Reel');
    containerParams.media_type = 'REELS';
    containerParams.video_url = url;
    containerParams.share_to_feed = true;
  } else if (postType === 'story') {
    assertPublicMedia(url, 'Instagram Story');
    containerParams.media_type = 'STORIES';
    if (mediaType === 'video') containerParams.video_url = url;
    else containerParams.image_url = url;
  } else if (mediaType === 'reel') {
    assertPublicMedia(url, 'Instagram Reel');
    containerParams.media_type = 'REELS';
    containerParams.video_url = url;
    containerParams.share_to_feed = true;
  } else if (mediaType === 'video') {
    assertPublicMedia(url, 'Instagram video');
    containerParams.media_type = 'VIDEO';
    containerParams.video_url = url;
  } else if (mediaUrls && mediaUrls.length > 1) {
    const childrenIds: string[] = [];
    for (const itemUrl of mediaUrls) {
      assertPublicMedia(itemUrl, 'Instagram carousel');
      const childContainer = await axios.post(`${GRAPH_URL}/${igAccountId}/media`, null, {
        params: { is_carousel_item: true, image_url: itemUrl, access_token: pageAccessToken },
      });
      childrenIds.push(childContainer.data.id);
    }
    containerParams.media_type = 'CAROUSEL';
    containerParams.children = childrenIds.join(',');
  } else {
    assertPublicMedia(url, 'Instagram post');
    containerParams.image_url = url;
  }

  const { data: container } = await axios.post(`${GRAPH_URL}/${igAccountId}/media`, null, { params: containerParams });

  if (postType === 'reel' || postType === 'story' || mediaType === 'video' || mediaType === 'reel') {
    await waitForMetaContainerReady(container.id, pageAccessToken);
  }

  const { data: published } = await axios.post(`${GRAPH_URL}/${igAccountId}/media_publish`, null, {
    params: { creation_id: container.id, access_token: pageAccessToken },
  });
  return published.id;
}

export async function publishToThreads({
  userId,
  token,
  caption,
  mediaUrl,
  mediaType = 'text',
}: {
  userId: string;
  token: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
}): Promise<string> {
  const containerParams: Record<string, any> = { text: caption, access_token: token };
  if (mediaType === 'video' && mediaUrl) {
    containerParams.media_type = 'VIDEO';
    containerParams.video_url = mediaUrl;
  } else if (mediaUrl) {
    containerParams.media_type = 'IMAGE';
    containerParams.image_url = mediaUrl;
  } else {
    containerParams.media_type = 'TEXT';
  }

  const { data: container } = await axios.post(`https://graph.threads.net/v1.0/${userId}/threads`, null, { params: containerParams });
  if (mediaType === 'video') await waitForThreadsContainerReady(container.id, token);
  const { data: published } = await axios.post(`https://graph.threads.net/v1.0/${userId}/threads_publish`, null, {
    params: { creation_id: container.id, access_token: token },
  });
  return published.id;
}

async function waitForMetaContainerReady(containerId: string, accessToken: string, maxAttempts = 20): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await axios.get(`${GRAPH_URL}/${containerId}`, {
      params: { fields: 'status_code', access_token: accessToken },
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram media container failed to process');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Instagram media container timed out');
}

async function waitForThreadsContainerReady(containerId: string, accessToken: string, maxAttempts = 20): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await axios.get(`https://graph.threads.net/v1.0/${containerId}`, {
      params: { fields: 'status', access_token: accessToken },
    });
    if (data.status === 'FINISHED') return;
    if (data.status === 'ERROR') throw new Error('Threads media container failed to process');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Threads media container timed out');
}

export async function getMetaInsights(accountId: string, token: string, platform: 'facebook' | 'instagram'): Promise<{ followers: number; reach: number; impressions: number; profileVisits: number | null }> {
  if (platform === 'facebook') {
    // Reach and impressions are DIFFERENT metrics — reach = unique people
    // (page_impressions_unique), impressions = total views (page_impressions).
    // The old code fetched a single `page_media_view` and reported it as both,
    // which made every Facebook card show reach == impressions.
    let reachVal = 0;
    let impressionsVal = 0;
    const fbInsightValue = (item: any): number => {
      if (!item) return 0;
      const values = item.values;
      if (Array.isArray(values) && values.length > 0) {
        return Number(values[values.length - 1]?.value) || 0;
      }
      return Number(item.total_value?.value) || 0;
    };
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
        params: { metric: 'page_impressions_unique,page_impressions', period: 'day', access_token: token },
      });
      reachVal = fbInsightValue(data.data?.find((item: any) => item.name === 'page_impressions_unique'));
      impressionsVal = fbInsightValue(data.data?.find((item: any) => item.name === 'page_impressions'));
    } catch (err) {
      // Some metrics are deprecated on newer Graph versions; fall back to the
      // views metric for reach so the card still shows a real number.
      try {
        const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
          params: { metric: 'page_views_total', period: 'day', access_token: token },
        });
        reachVal = fbInsightValue(data.data?.find((item: any) => item.name === 'page_views_total'));
      } catch { /* leave zeros */ }
    }
    const { data: pageData } = await axios.get(`${GRAPH_URL}/${accountId}`, {
      params: { fields: 'fan_count,followers_count', access_token: token },
    });
    return {
      followers: pageData.followers_count || pageData.fan_count || 0,
      reach: reachVal,
      impressions: impressionsVal || reachVal,
      profileVisits: null,
    };
  } else {
    let reachVal = 0;
    let impressionsVal = 0;
    let insightsPermissionError: string | null = null;

    // Meta returns either `values[n].value` (time series) or `total_value.value`
    // (when metric_type=total_value). Prefer the last time-series point (most
    // recent complete day) and never throw on a missing values array.
    const insightValue = (item: any): number => {
      if (!item) return 0;
      if (item.total_value?.value != null) return Number(item.total_value.value) || 0;
      const values = item.values;
      if (Array.isArray(values) && values.length > 0) {
        return Number(values[values.length - 1]?.value) || 0;
      }
      return 0;
    };

    const isPermissionErr = (err: any) => {
      const code = err?.response?.data?.error?.code;
      const msg = (err?.response?.data?.error?.message || err?.message || '').toLowerCase();
      return code === 10 || code === 200 || msg.includes('permission') || msg.includes('(#10)') || msg.includes('manage_insights');
    };

    // 1. Reach (still supported as period=day). Impressions was deprecated on
    // IG in Graph v22+ — don't request it in the same call or the whole query fails.
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
        params: { metric: 'reach', period: 'day', access_token: token },
      });
      reachVal = insightValue(data.data?.find((item: any) => item.name === 'reach'));
    } catch (err: any) {
      console.error('Error fetching Instagram reach:', err?.message || err);
      if (isPermissionErr(err)) {
        insightsPermissionError = err?.response?.data?.error?.message || err.message;
      }
    }

    // 2. Views replace deprecated impressions (metric_type=total_value).
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
        params: { metric: 'views', period: 'day', metric_type: 'total_value', access_token: token },
      });
      const viewsVal = insightValue(data.data?.find((item: any) => item.name === 'views'));
      if (viewsVal > 0) {
        impressionsVal = viewsVal;
      }
    } catch (err: any) {
      console.error('Error fetching Instagram views:', err?.message || err);
      if (!insightsPermissionError && isPermissionErr(err)) {
        insightsPermissionError = err?.response?.data?.error?.message || err.message;
      }
    }

    // Missing instagram_manage_insights used to fail silently (followers synced,
    // reach/views stayed 0, UI looked "broken"). Surface it so Sync Metrics
    // marks the account unhealthy and the user can reconnect.
    if (insightsPermissionError) {
      throw new Error(
        `Instagram insights permission missing — reconnect the account with insights enabled. (${insightsPermissionError})`
      );
    }

    const { data: igData } = await axios.get(`${GRAPH_URL}/${accountId}`, {
      params: { fields: 'followers_count', access_token: token },
    });
    return { followers: igData.followers_count || 0, reach: reachVal, impressions: impressionsVal, profileVisits: null };
  }
}

/**
 * Canonical public URL of a published Meta item.
 *
 * Facebook exposes `permalink_url`; Instagram and Threads expose `permalink`.
 * Instagram's public URL uses an opaque shortcode that can't be derived from the
 * media id, so this call is the only way to get a link the user can open.
 * Returns null (never throws) when the field is unavailable — a missing link
 * must not break publishing or analytics.
 */
export async function getMetaPermalink(
  platformPostId: string,
  token: string,
  platform: 'facebook' | 'instagram' | 'threads'
): Promise<string | null> {
  const field = platform === 'facebook' ? 'permalink_url' : 'permalink';
  // Threads lives on its own host, not the Facebook graph.
  const base = platform === 'threads' ? 'https://graph.threads.net/v1.0' : GRAPH_URL;
  try {
    const { data } = await axios.get(`${base}/${platformPostId}`, {
      params: { fields: field, access_token: token },
    });
    const url = data?.[field];
    return typeof url === 'string' && url.startsWith('http') ? url : null;
  } catch (err: any) {
    console.warn(`[Meta] Could not fetch ${field} for ${platformPostId}:`, err.message);
    return null;
  }
}

function metaInsightNumber(item: any): number {
  if (!item) return 0;
  if (item.total_value?.value != null) return Number(item.total_value.value) || 0;
  const values = item.values;
  if (Array.isArray(values) && values.length > 0) {
    const last = values[values.length - 1]?.value;
    // Some reaction metrics return a map { like: n, love: n, ... }
    if (last && typeof last === 'object') {
      return Object.values(last).reduce((s: number, v) => s + (Number(v) || 0), 0);
    }
    return Number(last) || 0;
  }
  return 0;
}

export async function getMetaPostInsights(
  platformPostId: string,
  token: string,
  platform: 'facebook' | 'instagram'
): Promise<{ impressions: number; reach: number; likes: number; comments: number; shares: number; saved: number; views: number }> {
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let saved = 0;
  let impressions = 0;
  let reach = 0;
  let views = 0;

  if (platform === 'facebook') {
    // Reels / videos often store a bare video_id (not pageId_postId). Page-post
    // `/insights` fails on those; `/video_insights` is the right edge. Try both.
    // `likes` was deprecated — use reactions.summary.
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}`, {
        params: {
          fields: 'reactions.summary(true),comments.summary(true),shares',
          access_token: token,
        },
      });
      likes = data.reactions?.summary?.total_count ?? data.likes?.summary?.total_count ?? 0;
      comments = data.comments?.summary?.total_count ?? 0;
      shares = data.shares?.count ?? 0;
    } catch (err: any) {
      console.warn(`[Meta] Could not fetch basic Facebook post fields for ${platformPostId}:`, err.message);
    }

    // Page-post insights (works for feed posts with pageId_postId)
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/insights`, {
        params: {
          metric: 'post_impressions,post_impressions_unique,post_video_views,post_reactions_by_type_total',
          access_token: token,
        },
      });
      for (const item of data.data || []) {
        const val = metaInsightNumber(item);
        if (item.name === 'post_impressions') impressions = val;
        if (item.name === 'post_impressions_unique') reach = val;
        if (item.name === 'post_video_views' && val > 0) views = val;
        if (item.name === 'post_reactions_by_type_total' && val > 0) likes = val;
      }
    } catch (err: any) {
      console.warn(`[Meta] Facebook post /insights failed for ${platformPostId}:`, err.message);
    }

    // Video / Reel insights (works for bare video_id from reels upload).
    // Request metrics in small batches — one invalid metric rejects the whole call.
    if (views === 0 && impressions === 0 && reach === 0) {
      const videoMetricBatches = [
        ['total_video_views', 'total_video_views_unique', 'total_video_impressions'],
        ['blue_reels_play_count'],
        ['post_video_likes_by_reaction_type'],
      ];
      for (const batch of videoMetricBatches) {
        try {
          const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/video_insights`, {
            params: { metric: batch.join(','), access_token: token },
          });
          for (const item of data.data || []) {
            const val = metaInsightNumber(item);
            if ((item.name === 'total_video_views' || item.name === 'blue_reels_play_count') && val > 0) {
              views = Math.max(views, val);
            }
            if (item.name === 'total_video_impressions' && val > 0) impressions = val;
            if (item.name === 'total_video_views_unique' && val > 0) reach = val;
            if (item.name === 'post_video_likes_by_reaction_type' && val > 0) likes = Math.max(likes, val);
          }
        } catch (err: any) {
          console.warn(`[Meta] Facebook /video_insights (${batch.join(',')}) failed for ${platformPostId}:`, err.message);
        }
      }
      if (impressions === 0 && views > 0) impressions = views;
      if (reach === 0 && views > 0) reach = views;
    }
  } else {
    // 1. Fetch basic Instagram media fields (like_count, comments_count)
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}`, {
        params: {
          fields: 'like_count,comments_count',
          access_token: token,
        },
      });
      likes = data.like_count ?? 0;
      comments = data.comments_count ?? 0;
    } catch (err: any) {
      console.warn(`[Meta] Could not fetch basic Instagram media fields for ${platformPostId}:`, err.message);
    }

    // 2. Fetch Instagram media insights.
    // `impressions` is deprecated for IG media — request modern metrics and map
    // views/plays into the impressions/views fields the analytics UI expects.
    const readInsight = (item: any): number => {
      if (!item) return 0;
      if (item.total_value?.value != null) return Number(item.total_value.value) || 0;
      return Number(item.values?.[0]?.value) || 0;
    };
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/insights`, {
        params: {
          metric: 'reach,saved,shares,views',
          access_token: token,
        },
      });
      for (const item of data.data || []) {
        const val = readInsight(item);
        if (item.name === 'reach') reach = val;
        if (item.name === 'saved') saved = val;
        if (item.name === 'shares') shares = val;
        if (item.name === 'views' || item.name === 'plays') {
          views = val;
          impressions = val;
        }
      }
    } catch (err: any) {
      // Older media may still accept the legacy set — try once more.
      try {
        const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/insights`, {
          params: {
            metric: 'reach,saved,shares',
            access_token: token,
          },
        });
        for (const item of data.data || []) {
          const val = readInsight(item);
          if (item.name === 'reach') reach = val;
          if (item.name === 'saved') saved = val;
          if (item.name === 'shares') shares = val;
        }
      } catch (fallbackErr: any) {
        console.warn(`[Meta] Could not fetch Instagram post insights for ${platformPostId}:`, fallbackErr.message || err.message);
      }
    }
  }

  return { impressions, reach, likes, comments, shares, saved, views };
}