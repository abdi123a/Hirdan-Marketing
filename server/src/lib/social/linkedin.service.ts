import axios from 'axios';
import { createOAuthState } from './oauth-state.service.js';

// FIX (LinkedIn images don't actually post): registerLinkedInImageUpload +
// uploadLinkedInImageBinary implement LinkedIn's real native-image flow —
// register the upload, PUT the binary bytes to the returned URL, then reference
// the resulting asset URN in the post. Previously publishToLinkedIn skipped all
// of this and just set shareMediaCategory: 'ARTICLE' with the image URL as
// originalUrl, which publishes a link-preview card (or fails), never an actual
// photo post.
async function registerLinkedInImageUpload(accessToken: string, authorUrn: string): Promise<{ uploadUrl: string; asset: string }> {
  const { data } = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: authorUrn,
      serviceRelationships: [
        { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
      ],
    },
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const uploadUrl = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = data.value.asset;
  return { uploadUrl, asset };
}

async function uploadLinkedInImageBinary(uploadUrl: string, accessToken: string, imageUrl: string): Promise<void> {
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageResponse.data);

  await axios.put(uploadUrl, imageBuffer, {
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
    scope: 'w_member_social,r_liteprofile', // standard publishing scopes
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

  const { data } = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Get user profile (URN)
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
}: {
  accessToken: string;
  authorUrn: string;
  caption: string;
  mediaUrls?: string[];
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
    // Register the upload, PUT the actual image bytes, then reference the
    // resulting asset URN as a native IMAGE share (not an ARTICLE link card).
    const { uploadUrl, asset } = await registerLinkedInImageUpload(accessToken, authorUrn);
    await uploadLinkedInImageBinary(uploadUrl, accessToken, mediaUrls[0]);

    requestBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
    requestBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
      {
        status: 'READY',
        media: asset,
      },
    ];
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
  // FIX (made-up analytics): this used to fabricate reach/impressions/profileVisits
  // as arbitrary multiples of follower count (followers*3, followers*5, etc.), and
  // even faked the follower count itself to 1 if the network-size call failed
  // ("prevent fallback to mock data" — but a hardcoded 1 IS mock data). Personal
  // LinkedIn profiles have no public reach/impressions API — only LinkedIn Company
  // Pages get real analytics via the Organization Page Statistics API. Since this
  // account model only stores a personal person URN, we return real followers
  // where obtainable and null (honestly "not available") for the rest, rather
  // than a number that looks real but isn't.
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
      // Not supported for this app's scopes on a personal profile — we genuinely
      // don't know the follower count, so say so instead of guessing 1.
      followersAvailable = false;
    }

    return {
      followers: followersAvailable ? followers : 0,
      // Personal-profile reach/impressions/profile-visit metrics aren't exposed
      // by any LinkedIn public API today. If you upgrade this account model to
      // Company Pages, wire in the Organization Page Statistics API here instead.
      reach: null,
      impressions: null,
      profileVisits: null,
    };
  } catch (err: any) {
    console.error('Failed to fetch LinkedIn insights:', err.message);
    throw err;
  }
}
