import { createHash, randomBytes } from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { createOAuthState } from './oauth-state.service.js';
import { getMediaSource, readMediaRange } from './storage.service.js';
import { xMediaMime, xMediaCategory, xMediaId, planXChunks } from './x-media.js';

export function getXAuthorizationUrl(clientIdStr: string, groupId: string, existingCodeVerifier?: string): string {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new Error('X_CLIENT_ID is not configured');
  }

  const redirectUri = process.env.X_REDIRECT_URI || '';
  const codeVerifier = existingCodeVerifier || randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = createOAuthState('x', clientIdStr, groupId, { codeVerifier });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 's256',
    // media.write is required by the v2 media upload endpoints. A refresh token
    // cannot acquire a scope it was never granted, so any X account connected
    // before this line changed must be reconnected before it can post media.
    scope: 'tweet.read tweet.write users.read offline.access media.write',
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

const X_API_BASE = 'https://api.x.com/2';
/** Stays under the scheduler's 15-minute stale-destination cutoff. */
const X_MEDIA_POLL_MAX_MS = 5 * 60 * 1000;
const X_MAX_VIDEO_BYTES = 512 * 1024 * 1024;

/**
 * Wait for X to finish transcoding before the media id is usable in a post.
 * Attaching an id that is still processing produces a tweet with no media.
 */
async function waitForXMediaProcessing(mediaId: string, accessToken: string, initialInfo: any): Promise<void> {
  let info = initialInfo;
  const deadline = Date.now() + X_MEDIA_POLL_MAX_MS;

  // Images come back with no processing_info at all and are ready immediately.
  while (info && info.state !== 'succeeded') {
    if (info.state === 'failed') {
      const reason = info.error?.message || info.error?.name || 'unknown error';
      throw new Error(`X failed to process the media: ${reason}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`X media processing did not finish within ${X_MEDIA_POLL_MAX_MS / 1000}s`);
    }
    // Honour the server's own pacing hint rather than a fixed sleep.
    const waitSec = Math.max(1, Number(info.check_after_secs) || 5);
    await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));

    const statusRes = await axios.get(`${X_API_BASE}/media/upload`, {
      params: { command: 'STATUS', media_id: mediaId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    info = statusRes.data?.data?.processing_info ?? statusRes.data?.processing_info;
    // processing_info disappearing means processing finished.
    if (!info) return;
  }
}

/**
 * Upload one piece of media and return its media id.
 *
 * Images and videos share the chunked path — an image is simply one segment.
 * The previous implementation sent the entire file as a single APPEND with
 * segment_index 0, which X rejects above its 5MB per-segment cap, and treated
 * FINALIZE as terminal instead of polling STATUS.
 */
async function uploadXMedia(accessToken: string, mediaUrl: string, mediaType: string): Promise<string> {
  const source = await getMediaSource(mediaUrl);
  const mime = xMediaMime(mediaUrl, mediaType);
  const category = xMediaCategory(mime);
  const auth = { Authorization: `Bearer ${accessToken}` };

  if (category === 'tweet_video' && source.size > X_MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is ${Math.round(source.size / 1024 / 1024)}MB — X allows at most ${X_MAX_VIDEO_BYTES / 1024 / 1024}MB.`,
    );
  }

  // 1. INIT — multipart form fields, not query params.
  const initForm = new FormData();
  initForm.append('command', 'INIT');
  initForm.append('media_type', mime);
  initForm.append('total_bytes', String(source.size));
  initForm.append('media_category', category);
  const initRes = await axios.post(`${X_API_BASE}/media/upload`, initForm, {
    headers: { ...initForm.getHeaders(), ...auth },
  });
  const mediaId = xMediaId(initRes.data);

  // 2. APPEND — one request per segment, each under the 5MB cap. Ranges are read
  // straight off disk for local media, so a 500MB video never lands in memory.
  for (const chunkSpec of planXChunks(source.size)) {
    const chunk = await readMediaRange(source, chunkSpec.start, chunkSpec.end);
    const appendForm = new FormData();
    appendForm.append('command', 'APPEND');
    appendForm.append('media_id', mediaId);
    appendForm.append('segment_index', String(chunkSpec.index));
    appendForm.append('media', chunk, { filename: `chunk-${chunkSpec.index}`, contentType: 'application/octet-stream' });
    await axios.post(`${X_API_BASE}/media/upload`, appendForm, {
      headers: { ...appendForm.getHeaders(), ...auth },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  // 3. FINALIZE
  const finalizeForm = new FormData();
  finalizeForm.append('command', 'FINALIZE');
  finalizeForm.append('media_id', mediaId);
  const finalRes = await axios.post(`${X_API_BASE}/media/upload`, finalizeForm, {
    headers: { ...finalizeForm.getHeaders(), ...auth },
  });

  // 4. STATUS — only video/GIF carry processing_info.
  await waitForXMediaProcessing(
    mediaId,
    accessToken,
    finalRes.data?.data?.processing_info ?? finalRes.data?.processing_info,
  );

  return mediaId;
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
