import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';
import { openMediaStream } from './storage.service.js';

export function getYouTubeAuthorizationUrl(clientIdStr: string, groupId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  const state = createOAuthState('youtube', clientIdStr, groupId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeYouTubeCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; channelId: string; name: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  if (!clientId || !clientSecret) throw new Error('Google/YouTube credentials are not fully configured');

  const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: { part: 'snippet', mine: true },
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const channel = channelResponse.data?.items?.[0];
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, channelId: channel?.id || 'YouTubeChannel', name: channel?.snippet?.title || 'YouTube Channel' };
}

export async function refreshYouTubeToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google/YouTube credentials are not fully configured');
  const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token',
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return { access_token: data.access_token, expires_in: data.expires_in };
}

export async function publishToYouTube({
  accessToken,
  videoUrl,
  caption,
  privacy = 'public', // Added privacy parameter
}: {
  accessToken: string;
  videoUrl: string;
  caption: string;
  privacy?: 'public' | 'unlisted' | 'private';
}): Promise<string> {
  // Opened here, inside the function the platform router retries after a token
  // refresh — a Buffer can be re-sent, a consumed stream cannot, so hoisting this
  // to the caller would make the retry silently upload an empty body.
  const { stream, size } = await openMediaStream(videoUrl);

  const initResponse = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      snippet: { title: caption.substring(0, 100) || 'New Social Media Video', description: caption },
      status: { privacyStatus: privacy }, // Now dynamic
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': size.toString(),
      },
    }
  );

  const uploadUrl = initResponse.headers.location;
  if (!uploadUrl) {
    stream.destroy();
    throw new Error('Failed to get YouTube video upload URL');
  }

  // Content-Length must be set by hand: axios only derives it for Buffers and
  // form-data bodies, and a stream would otherwise go out chunked, which the
  // resumable endpoint rejects.
  const uploadResponse = await axios.put(uploadUrl, stream, {
    headers: { 'Content-Type': 'video/*', 'Content-Length': size.toString() },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return uploadResponse.data.id;
}

export async function getYouTubeInsights(accessToken: string): Promise<{ followers: number; reach: number; impressions: number; profileVisits: number | null }> {
  try {
    const { data } = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'statistics', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const channel = data?.items?.[0];
    if (!channel) return { followers: 0, reach: 0, impressions: 0, profileVisits: null };
    const followers = parseInt(channel.statistics?.subscriberCount, 10) || 0;
    const views = parseInt(channel.statistics?.viewCount, 10) || 0;
    return { followers, reach: views, impressions: views, profileVisits: null };
  } catch (err: any) {
    console.error('Failed to fetch YouTube insights:', err.message);
    throw err;
  }
}

/** Per-video public statistics (views / likes / comments). */
export async function getYouTubePostInsights(
  videoId: string,
  accessToken: string,
): Promise<{ impressions: number; reach: number; likes: number; comments: number; shares: number; saved: number; views: number }> {
  const { data } = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: { part: 'statistics', id: videoId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const stats = data?.items?.[0]?.statistics;
  if (!stats) {
    // Deleted, private, or still-processing videos — soft-skip so the daily
    // collector does not treat this as an actionable failure.
    const err = new Error(`YouTube video ${videoId} not found or statistics unavailable`) as Error & {
      softInsightSkip?: boolean;
    };
    err.softInsightSkip = true;
    throw err;
  }
  const views = parseInt(stats.viewCount, 10) || 0;
  const likes = parseInt(stats.likeCount, 10) || 0;
  const comments = parseInt(stats.commentCount, 10) || 0;
  return {
    views,
    likes,
    comments,
    shares: 0,
    saved: 0,
    // YouTube doesn't expose reach separately — views is the closest public figure.
    reach: views,
    impressions: views,
  };
}
