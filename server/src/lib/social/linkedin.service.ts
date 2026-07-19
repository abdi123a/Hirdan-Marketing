import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';
import { getMediaBuffer } from './storage.service.js';

async function registerLinkedInUpload(
  accessToken: string,
  authorUrn: string,
  recipe: string
): Promise<{ uploadUrl: string; asset: string }> {
  const { data } = await axios.post(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    {
      registerUploadRequest: {
        recipes: [recipe],
        owner: authorUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const uploadUrl = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = data.value.asset;
  return { uploadUrl, asset };
}

async function uploadLinkedInBinary(uploadUrl: string, accessToken: string, mediaUrl: string): Promise<void> {
  const buffer = await getMediaBuffer(mediaUrl);
  await axios.put(uploadUrl, buffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
  });
}

export function getLinkedInAuthorizationUrl(clientIdStr: string, groupId: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    throw new Error('LINKEDIN_CLIENT_ID is not configured');
  }

  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || '';
  const state = createOAuthState('linkedin', clientIdStr, groupId);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'w_member_social,r_liteprofile',
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export async function exchangeLinkedInCodeForToken(code: string): Promise<{ access_token: string; expires_in: number; urn: string; name: string }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || '';

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn credentials are not fully configured');
  }

  const { data } = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  const urn = `urn:li:person:${profileResponse.data.id}`;
  const name = `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName}`;

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    urn,
    name,
  };
}

export async function publishToLinkedIn({
  accessToken,
  authorUrn,
  caption,
  mediaUrls,
  mediaType = 'image',
}: {
  accessToken: string;
  authorUrn: string;
  caption: string;
  mediaUrls?: string[];
  mediaType?: string;
}): Promise<string> {
  const requestBody: Record<string, any> = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  if (mediaUrls && mediaUrls.length > 0) {
    const isVideo = mediaType === 'video';
    const mediaItems = [];

    if (isVideo) {
      // LinkedIn only supports one video per post
      const recipe = 'urn:li:digitalmediaRecipe:feedshare-video';
      const { uploadUrl, asset } = await registerLinkedInUpload(accessToken, authorUrn, recipe);
      await uploadLinkedInBinary(uploadUrl, accessToken, mediaUrls[0]);
      mediaItems.push({ status: 'READY', media: asset });
      requestBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'VIDEO';
    } else {
      // Multiple images (carousel)
      const recipe = 'urn:li:digitalmediaRecipe:feedshare-image';
      for (const url of mediaUrls) {
        const { uploadUrl, asset } = await registerLinkedInUpload(accessToken, authorUrn, recipe);
        await uploadLinkedInBinary(uploadUrl, accessToken, url);
        mediaItems.push({ status: 'READY', media: asset });
      }
      requestBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
    }

    requestBody.specificContent['com.linkedin.ugc.ShareContent'].media = mediaItems;
  }

  const { data } = await axios.post('https://api.linkedin.com/v2/ugcPosts', requestBody, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
  });

  return data.id;
}

export async function getLinkedInInsights(accessToken: string): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  try {
    const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const personUrn = `urn:li:person:${profileResponse.data.id}`;

    let followers = 0;
    let followersAvailable = true;
    try {
      const networkResponse = await axios.get(`https://api.linkedin.com/v2/networkSizes/${personUrn}`, {
        params: { edgeType: 'CompanyFollowedByMember' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      followers = networkResponse.data?.firstDegreeConnectionSize || 0;
    } catch {
      followersAvailable = false;
    }

    return {
      followers: followersAvailable ? followers : 0,
      reach: null,
      impressions: null,
      profileVisits: null,
    };
  } catch (err: any) {
    console.error('Failed to fetch LinkedIn insights:', err.message);
    throw err;
  }
}
