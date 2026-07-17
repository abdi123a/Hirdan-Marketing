import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const RATE_LIMIT_CODES = [4, 17, 32, 613];

export function isRateLimitError(err: any): boolean {
  if (err?.response?.status === 429) return true;
  const fbError = err?.response?.data?.error;
  if (fbError && RATE_LIMIT_CODES.includes(fbError.code)) {
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
    scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'read_insights',
      'business_management',
    ];
  } else if (platform === 'threads') {
    redirectUri = process.env.META_REDIRECT_URI_THREADS || '';
    scopes = [
      'threads_basic',
      'threads_content_publish',
    ];
  }

  const state = createOAuthState(platform, clientId, groupId);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(','),
    response_type: 'code',
  });

  if (platform === 'threads') {
    return `https://www.threads.net/oauth/authorize?${params.toString()}`;
  }

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCodeForToken(platform: 'facebook' | 'instagram' | 'threads', code: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  let redirectUri = '';

  if (platform === 'facebook') {
    redirectUri = process.env.META_REDIRECT_URI_FACEBOOK || '';
  } else if (platform === 'instagram') {
    redirectUri = process.env.META_REDIRECT_URI_INSTAGRAM || '';
  } else if (platform === 'threads') {
    redirectUri = process.env.META_REDIRECT_URI_THREADS || '';
  }

  if (!appId || !appSecret) {
    throw new Error('Meta credentials are not fully configured in environment variables');
  }

  if (platform === 'threads') {
    const { data } = await axios.post('https://graph.threads.net/oauth/access_token', new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }));
    return data.access_token;
  }

  const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });
  return data.access_token;
}

export async function getMetaLongLivedToken(shortLivedToken: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Meta credentials are not fully configured in environment variables');
  }

  const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });
  return data.access_token;
}

// FIX (Threads shows no real data): previously the OAuth callback never called any
// Threads profile endpoint at all — it hardcoded userId: 'threads_user' and
// username: 'Threads User' for every single Threads account ever connected, for
// every client. This fetches the real Threads user id + username so each account
// is stored and displayed correctly, and so multiple Threads accounts under the
// same client don't collide on the same fake platformUserId.
export async function getThreadsProfile(accessToken: string): Promise<{ userId: string; username: string; avatarUrl: string | null; followers: number }> {
  const { data } = await axios.get('https://graph.threads.net/v1.0/me', {
    params: {
      fields: 'id,username,threads_profile_picture_url,threads_biography',
      access_token: accessToken,
    },
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

  return {
    userId: data.id,
    username: data.username || 'Threads User',
    avatarUrl: data.threads_profile_picture_url || null,
    followers,
  };
}

export interface MetaPageInstagramInfo {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  pageFollowers: number;
  pageAvatarUrl: string | null;
  igAccountId: string | null;
  igUsername: string | null;
  igFollowers: number | null;
  igAvatarUrl: string | null;
}

export async function getPagesWithInstagram(userAccessToken: string): Promise<MetaPageInstagramInfo[]> {
  // FIX (data mismatch): this previously only requested id/name/access_token/
  // instagram_business_account{id,username} — it never asked Graph API for
  // follower counts or profile pictures, so every account in the OAuth picker
  // screen (SocialAccountPickerPage.tsx) always showed "0 followers" and no
  // avatar regardless of the account's real size. Now requests fan_count and
  // picture{url} for the Page, and followers_count + profile_picture_url for
  // the linked Instagram Business account.
  const { data } = await axios.get(`${GRAPH_URL}/me/accounts`, {
    params: {
      access_token: userAccessToken,
      fields: 'id,name,access_token,fan_count,picture{url},instagram_business_account{id,username,followers_count,profile_picture_url}',
    },
  });

  if (!data || !data.data) {
    return [];
  }

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

export async function publishToFacebookPage({
  pageId,
  pageAccessToken,
  caption,
  mediaUrls,
  mediaType,
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

  // Facebook Reel
  if (postType === 'reel') {
    if (!url) throw new Error('Facebook Reel requires a video URL');
    const { data } = await axios.post(`${GRAPH_URL}/${pageId}/video_reels`, null, {
      params: {
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: caption,
        file_url: url,
        access_token: pageAccessToken,
      },
    });
    return data.video_id || data.id;
  }

  // Facebook Story
  if (postType === 'story') {
    if (!url) throw new Error('Facebook Story requires a media URL');
    if (mediaType === 'video') {
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/video_stories`, null, {
        params: { file_url: url, access_token: pageAccessToken },
      });
      return data.id;
    } else {
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photo_stories`, null, {
        params: { url, access_token: pageAccessToken },
      });
      return data.id;
    }
  }

  // Regular Post
  if (mediaType === 'video' && url) {
    const { data } = await axios.post(`${GRAPH_URL}/${pageId}/videos`, null, {
      params: { file_url: url, description: caption, access_token: pageAccessToken },
    });
    return data.id;
  }

  if (url) {
    const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, null, {
      params: { url, caption, access_token: pageAccessToken },
    });
    return data.id;
  }

  // Plain text
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
  mediaType,
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
  const containerParams: Record<string, any> = {
    caption,
    access_token: pageAccessToken,
  };

  // Instagram Reel
  if (postType === 'reel') {
    if (!url) throw new Error('Instagram Reel requires a video URL');
    containerParams.media_type = 'REELS';
    containerParams.video_url = url;
    containerParams.share_to_feed = true;
  // Instagram Story
  } else if (postType === 'story') {
    if (!url) throw new Error('Instagram Story requires a media URL');
    if (mediaType === 'video') {
      containerParams.media_type = 'STORIES';
      containerParams.video_url = url;
    } else {
      containerParams.media_type = 'STORIES';
      containerParams.image_url = url;
    }
  } else if (mediaType === 'reel') {
    containerParams.media_type = 'REELS';
    containerParams.video_url = url;
    containerParams.share_to_feed = true;
  } else if (mediaType === 'video') {
    containerParams.media_type = 'VIDEO';
    containerParams.video_url = url;
  } else if (mediaUrls && mediaUrls.length > 1) {
    // Carousel
    const childrenIds: string[] = [];
    for (const itemUrl of mediaUrls) {
      const childContainer = await axios.post(`${GRAPH_URL}/${igAccountId}/media`, null, {
        params: {
          is_carousel_item: true,
          image_url: itemUrl,
          access_token: pageAccessToken,
        },
      });
      childrenIds.push(childContainer.data.id);
    }
    containerParams.media_type = 'CAROUSEL';
    containerParams.children = childrenIds.join(',');
  } else {
    containerParams.image_url = url;
  }

  // Step 1: create container
  const { data: container } = await axios.post(
    `${GRAPH_URL}/${igAccountId}/media`,
    null,
    { params: containerParams }
  );

  // Video/reel/story containers need processing time before they can be published.
  if (postType === 'reel' || postType === 'story' || mediaType === 'video' || mediaType === 'reel') {
    await waitForMetaContainerReady(container.id, pageAccessToken);
  }

  // Step 2: publish the container
  const { data: published } = await axios.post(
    `${GRAPH_URL}/${igAccountId}/media_publish`,
    null,
    { params: { creation_id: container.id, access_token: pageAccessToken } }
  );

  return published.id;
}

export async function publishToThreads({
  userId,
  token,
  caption,
  mediaUrl,
  mediaType,
}: {
  userId: string;
  token: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
}): Promise<string> {
  const containerParams: Record<string, any> = {
    text: caption,
    access_token: token,
  };

  if (mediaType === 'video' && mediaUrl) {
    containerParams.media_type = 'VIDEO';
    containerParams.video_url = mediaUrl;
  } else if (mediaUrl) {
    containerParams.media_type = 'IMAGE';
    containerParams.image_url = mediaUrl;
  } else {
    containerParams.media_type = 'TEXT';
  }

  const { data: container } = await axios.post(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    null,
    { params: containerParams }
  );

  if (mediaType === 'video') {
    await waitForThreadsContainerReady(container.id, token);
  }

  const { data: published } = await axios.post(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    null,
    { params: { creation_id: container.id, access_token: token } }
  );

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
  throw new Error('Instagram media container timed out waiting to process');
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
  throw new Error('Threads media container timed out waiting to process');
}

export async function getMetaInsights(accountId: string, token: string, platform: 'facebook' | 'instagram'): Promise<{ followers: number; reach: number; impressions: number; profileVisits: number }> {
  if (platform === 'facebook') {
    // page_media_view replaces page_impressions
    // page_post_engagements replaces page_engaged_users
    const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
      params: {
        metric: 'page_media_view,page_post_engagements',
        period: 'day',
        access_token: token,
      },
    });

    const reachVal = data.data.find((item: any) => item.name === 'page_media_view')?.values[0]?.value ?? 0;
    const engagedVal = data.data.find((item: any) => item.name === 'page_post_engagements')?.values[0]?.value ?? 0;

    // Follower count for Page
    const { data: pageData } = await axios.get(`${GRAPH_URL}/${accountId}`, {
      params: {
        fields: 'fan_count,followers_count',
        access_token: token,
      },
    });

    return {
      followers: pageData.followers_count || pageData.fan_count || 0,
      reach: reachVal,
      impressions: reachVal, // Proxy
      profileVisits: engagedVal,
    };
  } else {
    // Instagram Business insights
    // profile_views was deprecated by Meta on January 8, 2025
    const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
      params: {
        metric: 'reach,impressions',
        period: 'day',
        access_token: token,
      },
    });

    const reachVal = data.data.find((item: any) => item.name === 'reach')?.values[0]?.value ?? 0;
    const impressionsVal = data.data.find((item: any) => item.name === 'impressions')?.values[0]?.value ?? 0;

    const { data: igData } = await axios.get(`${GRAPH_URL}/${accountId}`, {
      params: {
        fields: 'followers_count',
        access_token: token,
      },
    });

    return {
      followers: igData.followers_count || 0,
      reach: reachVal,
      impressions: impressionsVal,
      profileVisits: 0,
    };
  }
}

export async function getMetaPostInsights(platformPostId: string, token: string, platform: 'facebook' | 'instagram'): Promise<{ impressions: number; reach: number; likes: number; comments: number; shares: number; saved: number }> {
  const metricList = platform === 'instagram'
    ? 'impressions,reach,likes,comments,saved,shares'
    : 'post_impressions,post_reactions_by_type_total,post_comments_by_type';

  const { data } = await axios.get(`${GRAPH_URL}/${platformPostId}/insights`, {
    params: { metric: metricList, access_token: token },
  });

  const metrics: Record<string, number> = {};
  for (const item of data.data) {
    metrics[item.name] = item.values[0]?.value ?? 0;
  }

  if (platform === 'instagram') {
    return {
      impressions: metrics.impressions || 0,
      reach: metrics.reach || 0,
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      shares: metrics.shares || 0,
      saved: metrics.saved || 0,
    };
  } else {
    return {
      impressions: metrics.post_impressions || 0,
      reach: metrics.post_impressions || 0, // proxy
      likes: metrics.post_reactions_by_type_total || 0,
      comments: metrics.post_comments_by_type || 0,
      shares: 0,
      saved: 0,
    };
  }
}
