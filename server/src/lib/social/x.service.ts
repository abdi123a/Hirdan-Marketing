import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

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

export async function publishToX({
  accessToken,
  caption,
  mediaUrls,
}: {
  accessToken: string;
  caption: string;
  mediaUrls?: string[];
}): Promise<string> {
  const payload: Record<string, any> = {
    text: caption,
  };

  if (mediaUrls && mediaUrls.length > 0) {
    payload.text = `${caption}\n\n${mediaUrls[0]}`;
  }

  const { data } = await axios.post('https://api.twitter.com/2/tweets', payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return data.data.id;
}

export async function getXInsights(accessToken: string): Promise<{ followers: number; reach: number; impressions: number; profileVisits: number }> {
  return {
    followers: 0,
    reach: 0,
    impressions: 0,
    profileVisits: 0,
  };
}
