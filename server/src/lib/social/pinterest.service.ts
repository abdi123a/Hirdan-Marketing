import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

export function getPinterestAuthorizationUrl(clientIdStr: string, groupId: string): string {
  const appId = process.env.PINTEREST_APP_ID;
  if (!appId) throw new Error('PINTEREST_APP_ID is not configured');
  const redirectUri = process.env.PINTEREST_REDIRECT_URI || '';
  const state = createOAuthState('pinterest', clientIdStr, groupId);
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: 'code', scope: 'boards:read,pins:read,pins:write', state });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

export async function exchangePinterestCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; username: string }> {
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;
  const redirectUri = process.env.PINTEREST_REDIRECT_URI || '';
  if (!appId || !appSecret) throw new Error('Pinterest credentials are not fully configured');
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const { data } = await axios.post('https://api.pinterest.com/v5/oauth/token', new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: redirectUri,
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` } });

  const userResponse = await axios.get('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, username: userResponse.data.username || 'Pinterest User' };
}

export async function refreshPinterestToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Pinterest credentials are not fully configured');
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const { data } = await axios.post('https://api.pinterest.com/v5/oauth/token', new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: refreshToken,
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` } });
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in };
}

export interface PinterestBoard {
  id: string;
  name: string;
  privacy: string | null;
}

/** Boards the connected account can pin to, for the composer's board picker. */
export async function listPinterestBoards(accessToken: string): Promise<PinterestBoard[]> {
  const { data } = await axios.get('https://api.pinterest.com/v5/boards', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { page_size: 250 },
  });
  return (data?.items || []).map((b: any) => ({
    id: String(b.id),
    name: b.name || '(untitled board)',
    privacy: b.privacy ?? null,
  }));
}

export async function publishToPinterest({
  accessToken,
  caption,
  mediaUrls,
  mediaType = 'image',
  boardId,
  title,
  link,
}: {
  accessToken: string;
  caption: string;
  mediaUrls?: string[];
  mediaType?: string;
  /** Chosen in the composer. Falls back to the account's first board when absent. */
  boardId?: string;
  title?: string;
  link?: string;
}): Promise<string> {
  const imageUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : '';
  if (!imageUrl) throw new Error('Pinterest requires a media URL to publish a pin');

  let targetBoardId = boardId;
  if (!targetBoardId) {
    // Fallback for posts created before the board picker existed, and for the
    // mobile composer, which does not write a pinterest block at all. Pinning to
    // an arbitrary board is bad, but failing an already-scheduled post is worse.
    const boardsResponse = await axios.get('https://api.pinterest.com/v5/boards', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const board = boardsResponse.data?.items?.[0];
    if (!board) throw new Error('No Pinterest boards found. Please create a board first.');
    targetBoardId = String(board.id);
  }

  const isVideo = mediaType === 'video';
  const payload: any = {
    title: (title || caption).substring(0, 100),
    description: caption,
    board_id: targetBoardId,
    media_source: isVideo
      ? { source_type: 'video_url', url: imageUrl }
      : { source_type: 'image_url', url: imageUrl },
  };
  if (link) payload.link = link;

  const { data } = await axios.post('https://api.pinterest.com/v5/pins', payload, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  return data.id;
}

export async function getPinterestInsights(accessToken: string): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  try {
    const { data } = await axios.get('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const followers = data?.follower_count || 0;
    let reach: number | null = null, impressions: number | null = null, profileVisits: number | null = null;
    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: analytics } = await axios.get('https://api.pinterest.com/v5/user_account/analytics', {
        params: { start_date: start, end_date: end, metric_types: 'IMPRESSION,PIN_CLICK_RATE,OUTBOUND_CLICK' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const summary = analytics?.all?.summary_metrics;
      impressions = summary?.IMPRESSION ?? null;
      profileVisits = summary?.OUTBOUND_CLICK ?? null;
      reach = impressions;
    } catch (e: any) {
      console.warn('Pinterest analytics endpoint unavailable:', e.message);
    }
    return { followers, reach, impressions, profileVisits };
  } catch (err: any) {
    console.error('Failed to fetch Pinterest insights:', err.message);
    throw err;
  }
}
