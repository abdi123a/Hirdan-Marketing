import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

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
    scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_manage_metadata', 'read_insights', 'business_management'];
  } else if (platform === 'instagram') {
    redirectUri = process.env.META_REDIRECT_URI_INSTAGRAM || '';
    scopes = ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish', 'read_insights', 'business_management'];
  } else if (platform === 'threads') {
    redirectUri = process.env.META_REDIRECT_URI_THREADS || '';
    scopes = ['threads_basic', 'threads_content_publish'];
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

  // Step 2: Download the video file from the CDN URL
  const videoRes = await axios.get(url, { responseType: 'arraybuffer' });
  const videoBuffer = Buffer.from(videoRes.data);

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
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, null, {
        params: { url: imgUrl, published: false, access_token: pageAccessToken },
      });
      mediaFbids.push({ media_fbid: data.id });
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
    const videoParams: Record<string, any> = { file_url: url, access_token: pageAccessToken };
    if (caption) {
      videoParams.description = caption;
    }
    const { data } = await axios.post(`${GRAPH_URL}/${pageId}/videos`, null, {
      params: videoParams,
    });
    return data.id || data.video_id;
  }

  // --- SINGLE IMAGE ---
  if (url) {
    const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, null, {
      params: { url, caption, access_token: pageAccessToken },
    });
    return data.id;
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

  if (postType === 'reel') {
    if (!url) throw new Error('Instagram Reel requires a video URL');
    containerParams.media_type = 'REELS';
    containerParams.video_url = url;
    containerParams.share_to_feed = true;
  } else if (postType === 'story') {
    if (!url) throw new Error('Instagram Story requires a media URL');
    containerParams.media_type = 'STORIES';
    if (mediaType === 'video') containerParams.video_url = url;
    else containerParams.image_url = url;
  } else if (mediaType === 'reel') {
    containerParams.media_type = 'REELS';
    containerParams.video_url = url;
    containerParams.share_to_feed = true;
  } else if (mediaType === 'video') {
    containerParams.media_type = 'VIDEO';
    containerParams.video_url = url;
  } else if (mediaUrls && mediaUrls.length > 1) {
    const childrenIds: string[] = [];
    for (const itemUrl of mediaUrls) {
      const childContainer = await axios.post(`${GRAPH_URL}/${igAccountId}/media`, null, {
        params: { is_carousel_item: true, image_url: itemUrl, access_token: pageAccessToken },
      });
      childrenIds.push(childContainer.data.id);
    }
    containerParams.media_type = 'CAROUSEL';
    containerParams.children = childrenIds.join(',');
  } else {
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
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
        params: { metric: 'page_impressions_unique,page_impressions', period: 'day', access_token: token },
      });
      reachVal = data.data.find((item: any) => item.name === 'page_impressions_unique')?.values?.[0]?.value ?? 0;
      impressionsVal = data.data.find((item: any) => item.name === 'page_impressions')?.values?.[0]?.value ?? 0;
    } catch (err) {
      // Some metrics are deprecated on newer Graph versions; fall back to the
      // views metric for reach so the card still shows a real number.
      try {
        const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
          params: { metric: 'page_views_total', period: 'day', access_token: token },
        });
        reachVal = data.data.find((item: any) => item.name === 'page_views_total')?.values?.[0]?.value ?? 0;
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

    // 1. Try to fetch reach and impressions using the standard legacy query
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
        params: { metric: 'reach,impressions', period: 'day', access_token: token },
      });
      reachVal = data.data.find((item: any) => item.name === 'reach')?.values[0]?.value ?? 0;
      impressionsVal = data.data.find((item: any) => item.name === 'impressions')?.values[0]?.value ?? 0;
    } catch (e) {
      // If legacy query fails (due to impressions deprecation in v22+), fetch reach separately
      try {
        const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
          params: { metric: 'reach', period: 'day', access_token: token },
        });
        reachVal = data.data.find((item: any) => item.name === 'reach')?.values[0]?.value ?? 0;
      } catch (err) {
        console.error('Error fetching Instagram reach:', err);
      }
    }

    // 2. Fetch views using metric_type=total_value
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
        params: { metric: 'views', period: 'day', metric_type: 'total_value', access_token: token },
      });
      const viewsVal = data.data.find((item: any) => item.name === 'views')?.values[0]?.value ?? 0;
      if (viewsVal > 0) {
        impressionsVal = viewsVal;
      }
    } catch (err) {
      console.error('Error fetching Instagram views:', err);
    }

    const { data: igData } = await axios.get(`${GRAPH_URL}/${accountId}`, {
      params: { fields: 'followers_count', access_token: token },
    });
    return { followers: igData.followers_count || 0, reach: reachVal, impressions: impressionsVal, profileVisits: null };
  }
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
    // 1. Fetch basic post fields for Facebook Page Post (likes, comments, shares)
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}`, {
        params: {
          fields: 'likes.summary(true),comments.summary(true),shares',
          access_token: token,
        },
      });
      likes = data.likes?.summary?.total_count ?? 0;
      comments = data.comments?.summary?.total_count ?? 0;
      shares = data.shares?.count ?? 0;
    } catch (err: any) {
      console.warn(`[Meta] Could not fetch basic Facebook post fields for ${platformPostId}:`, err.message);
    }

    // 2. Fetch Facebook post insights (impressions & reach)
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/insights`, {
        params: {
          metric: 'post_impressions,post_impressions_unique',
          access_token: token,
        },
      });
      for (const item of data.data || []) {
        const val = item.values?.[0]?.value ?? 0;
        if (item.name === 'post_impressions') impressions = Number(val) || 0;
        if (item.name === 'post_impressions_unique') reach = Number(val) || 0;
      }
    } catch (err: any) {
      console.warn(`[Meta] Could not fetch Facebook post insights for ${platformPostId}:`, err.message);
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

    // 2. Fetch Instagram media insights (impressions, reach, saved, shares)
    try {
      const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/insights`, {
        params: {
          metric: 'impressions,reach,saved,shares',
          access_token: token,
        },
      });
      for (const item of data.data || []) {
        const val = item.values?.[0]?.value ?? 0;
        if (item.name === 'impressions') impressions = Number(val) || 0;
        if (item.name === 'reach') reach = Number(val) || 0;
        if (item.name === 'saved') saved = Number(val) || 0;
        if (item.name === 'shares') shares = Number(val) || 0;
      }
    } catch (err: any) {
      console.warn(`[Meta] Could not fetch Instagram post insights for ${platformPostId}:`, err.message);
    }
  }

  return { impressions, reach, likes, comments, shares, saved, views };
}