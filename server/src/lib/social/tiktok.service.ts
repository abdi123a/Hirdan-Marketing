import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

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
    scope: 'user.info.basic,video.publish,video.upload',
    state,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; open_id: string; username: string }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || '';

  if (!clientKey || !clientSecret) {
    throw new Error('TikTok credentials are not fully configured');
  }

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
  const profileResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    open_id: data.open_id,
    username: profileResponse.data?.data?.user?.display_name || profileResponse.data?.data?.user?.username || 'TikTok User',
  };
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

export async function publishToTikTok({
  accessToken,
  videoUrl,
  caption,
}: {
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  // TikTok Content Posting API requires a multi-step upload flow or direct posting
  // Direct video publishing: https://open.tiktokapis.com/v2/post/publish/video/init/
  const { data } = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    post_info: {
      title: caption,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_url: videoUrl,
    },
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (data?.error?.code !== 'ok') {
    throw new Error(`TikTok API error: ${data?.error?.message || 'Unknown'}`);
  }

  return data.data.publish_id;
}

export async function getTikTokInsights(accessToken: string): Promise<{ followers: number; reach: number; impressions: number; profileVisits: number }> {
  // Mock/simplified response as TikTok Research / Creator API has complex approval
  return {
    followers: 0,
    reach: 0,
    impressions: 0,
    profileVisits: 0,
  };
}
