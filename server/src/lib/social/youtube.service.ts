import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

export function getYouTubeAuthorizationUrl(clientIdStr: string, groupId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  const state = createOAuthState('youtube', clientIdStr, groupId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline', // forces refresh token to be returned
    prompt: 'consent',     // forces consent screen so refresh token is always returned
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeYouTubeCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; channelId: string; name: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';

  if (!clientId || !clientSecret) {
    throw new Error('Google/YouTube credentials are not fully configured');
  }

  const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Fetch channel info
  const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: {
      part: 'snippet',
      mine: true,
    },
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  const channel = channelResponse.data?.items?.[0];
  const channelId = channel?.id || 'YouTubeChannel';
  const name = channel?.snippet?.title || 'YouTube Channel';

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // will be offline refresh token
    expires_in: data.expires_in,
    channelId,
    name,
  };
}

export async function refreshYouTubeToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google/YouTube credentials are not fully configured');
  }

  const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

export async function publishToYouTube({
  accessToken,
  videoUrl,
  caption,
}: {
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  // Direct insert YouTube video requires a multipart or resumable upload.
  // To make it simple and reliable in this script context, we use a metadata insert or trigger YouTube API upload
  // Normally YouTube requires raw bytes to upload. Let's download the file buffer from the public videoUrl first.
  const videoFileResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
  const videoBuffer = Buffer.from(videoFileResponse.data);

  // Initialize YouTube upload
  const initResponse = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      snippet: {
        title: caption.substring(0, 100) || 'New Social Media Video',
        description: caption,
      },
      status: {
        privacyStatus: 'public',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': videoBuffer.length.toString(),
      },
    }
  );

  const uploadUrl = initResponse.headers.location;
  if (!uploadUrl) {
    throw new Error('Failed to get YouTube video upload URL');
  }

  // Upload actual video buffer
  const uploadResponse = await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/*',
      'Content-Length': videoBuffer.length.toString(),
    },
  });

  return uploadResponse.data.id;
}

export async function getYouTubeInsights(accessToken: string): Promise<{ followers: number; reach: number; impressions: number; profileVisits: number }> {
  try {
    const { data } = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'statistics',
        mine: true,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const channel = data?.items?.[0];
    if (!channel) {
      return { followers: 0, reach: 0, impressions: 0, profileVisits: 0 };
    }

    const followers = parseInt(channel.statistics?.subscriberCount, 10) || 0;
    const views = parseInt(channel.statistics?.viewCount, 10) || 0;

    return {
      followers,
      reach: views,
      impressions: views,
      profileVisits: 0,
    };
  } catch (err: any) {
    console.error('Failed to fetch YouTube insights:', err.message);
    throw err;
  }
}
