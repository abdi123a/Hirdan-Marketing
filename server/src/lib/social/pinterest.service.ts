import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

export function getPinterestAuthorizationUrl(clientIdStr: string, groupId: string): string {
  const appId = process.env.PINTEREST_APP_ID;
  if (!appId) {
    throw new Error('PINTEREST_APP_ID is not configured');
  }

  const redirectUri = process.env.PINTEREST_REDIRECT_URI || '';
  const state = createOAuthState('pinterest', clientIdStr, groupId);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'boards:read,pins:read,pins:write',
    state,
  });

  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

export async function exchangePinterestCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; username: string }> {
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;
  const redirectUri = process.env.PINTEREST_REDIRECT_URI || '';

  if (!appId || !appSecret) {
    throw new Error('Pinterest credentials are not fully configured');
  }

  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const { data } = await axios.post('https://api.pinterest.com/v5/oauth/token', new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
  });

  // Get profile username
  const userResponse = await axios.get('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    username: userResponse.data.username || 'Pinterest User',
  };
}

export async function refreshPinterestToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Pinterest credentials are not fully configured');
  }

  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const { data } = await axios.post('https://api.pinterest.com/v5/oauth/token', new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

export async function publishToPinterest({
  accessToken,
  caption,
  mediaUrls,
}: {
  accessToken: string;
  caption: string;
  mediaUrls?: string[];
}): Promise<string> {
  const imageUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : '';
  if (!imageUrl) {
    throw new Error('Pinterest requires an image URL to publish a pin');
  }

  // Get user's first board to publish to, or create one if none exists
  const boardsResponse = await axios.get('https://api.pinterest.com/v5/boards', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const board = boardsResponse.data?.items?.[0];
  if (!board) {
    throw new Error('No Pinterest boards found. Please create a board first.');
  }

  const { data } = await axios.post('https://api.pinterest.com/v5/pins', {
    link: imageUrl,
    title: caption.substring(0, 100),
    description: caption,
    board_id: board.id,
    media_source: {
      source_type: 'image_url',
      url: imageUrl,
    },
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return data.id;
}

export async function getPinterestInsights(accessToken: string): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  // FIX (made-up analytics): previously reach/impressions/profileVisits were
  // arbitrary multiples of follower count (followers*2, followers*3, etc.).
  // Pinterest DOES expose a real user account analytics endpoint
  // (/v5/user_account/analytics) — this now calls it for a trailing 30-day
  // window and falls back to null (not a guessed number) if that call fails,
  // e.g. because the app doesn't have analytics scope approved yet.
  try {
    const { data } = await axios.get('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const followers = data?.follower_count || 0;

    let reach: number | null = null;
    let impressions: number | null = null;
    let profileVisits: number | null = null;

    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: analytics } = await axios.get('https://api.pinterest.com/v5/user_account/analytics', {
        params: {
          start_date: start,
          end_date: end,
          metric_types: 'IMPRESSION,PIN_CLICK_RATE,OUTBOUND_CLICK',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const summary = analytics?.all?.summary_metrics;
      impressions = summary?.IMPRESSION ?? null;
      profileVisits = summary?.OUTBOUND_CLICK ?? null;
      reach = impressions; // Pinterest doesn't separate unique reach from impressions at this tier
    } catch (e: any) {
      console.warn('Pinterest analytics endpoint unavailable (likely needs analytics scope approval):', e.message);
    }

    return { followers, reach, impressions, profileVisits };
  } catch (err: any) {
    console.error('Failed to fetch Pinterest insights:', err.message);
    throw err;
  }
}
