import axios from 'axios';
import FormData from 'form-data';
import { createOAuthState } from './oauth-state.service.js';
import { getMediaBuffer } from './storage.service.js';

export function getXAuthorizationUrl(clientIdStr: string, groupId: string, codeChallenge: string): string {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new Error('X_CLIENT_ID is not configured');
  }

  const redirectUri = process.env.X_REDIRECT_URI || '';
  const state = createOAuthState('x', clientIdStr, groupId);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'plain',
    scope: 'tweet.read tweet.write users.read offline.access',
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeXCodeForToken(code: string, codeVerifier: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; platformUserId: string; username: string }> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const redirectUri = process.env.X_REDIRECT_URI || '';

  if (!clientId || !clientSecret) {
    throw new Error('X credentials are not fully configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const { data } = await axios.post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
  });

  const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    platformUserId: userResponse.data.data.id,
    username: userResponse.data.data.username,
  };
}

export async function refreshXToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('X credentials are not fully configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const { data } = await axios.post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
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

async function uploadXMedia(accessToken: string, mediaUrl: string, mediaType: string): Promise<string> {
  const buffer = await getMediaBuffer(mediaUrl);
  const isVideo = mediaType === 'video';

  if (isVideo) {
    // 1. INIT
    const initRes = await axios.post('https://upload.twitter.com/1.1/media/upload.json', null, {
      params: {
        command: 'INIT',
        media_type: 'video/mp4',
        total_bytes: buffer.length,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mediaId = initRes.data.media_id_string;

    // 2. APPEND
    await axios.post('https://upload.twitter.com/1.1/media/upload.json', buffer, {
      params: { command: 'APPEND', media_id: mediaId, segment_index: 0 },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
    });

    // 3. FINALIZE
    const finalRes = await axios.post('https://upload.twitter.com/1.1/media/upload.json', null, {
      params: { command: 'FINALIZE', media_id: mediaId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Optional: poll for processing status if needed
    if (finalRes.data.processing_info?.state === 'pending') {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return finalRes.data.media_id_string;
  } else {
    // Image upload (supports JPG, PNG, GIF)
    const form = new FormData();
    form.append('media', buffer, { filename: 'media.jpg' });
    const res = await axios.post('https://upload.twitter.com/1.1/media/upload.json', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.data.media_id_string;
  }
}

export async function publishToX({
  accessToken,
  caption,
  mediaUrls,
  mediaType = 'image',
}: {
  accessToken: string;
  caption: string;
  mediaUrls?: string[];
  mediaType?: string;
}): Promise<string> {
  const payload: any = { text: caption };

  if (mediaUrls && mediaUrls.length > 0) {
    const mediaIds: string[] = [];
    const limit = mediaType === 'video' ? 1 : 4; // X limits: 1 video, 4 images

    for (let i = 0; i < Math.min(mediaUrls.length, limit); i++) {
      const id = await uploadXMedia(accessToken, mediaUrls[i], mediaType);
      mediaIds.push(id);
    }

    if (mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds };
    }
  }

  const { data } = await axios.post('https://api.twitter.com/2/tweets', payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return data.data.id;
}

export async function getXInsights(accessToken: string): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  try {
    const { data } = await axios.get('https://api.twitter.com/2/users/me', {
      params: { 'user.fields': 'public_metrics' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const metrics = data?.data?.public_metrics;
    if (!metrics) {
      return { followers: 0, reach: null, impressions: null, profileVisits: null };
    }

    return {
      followers: metrics.followers_count || 0,
      reach: null,
      impressions: null,
      profileVisits: null,
    };
  } catch (err: any) {
    console.error('Failed to fetch X insights:', err.message);
    throw err;
  }
}
