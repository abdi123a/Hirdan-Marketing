import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const SECRET = process.env.OAUTH_STATE_SECRET;

export function createOAuthState(platform: string, clientId: string, groupId: string): string {
  if (!SECRET) {
    throw new Error('OAUTH_STATE_SECRET is not defined in environment variables');
  }
  return jwt.sign(
    { platform, clientId, groupId, nonce: randomBytes(8).toString('hex') },
    SECRET,
    { expiresIn: '10m' }
  );
}

export function verifyOAuthState(state: string): { platform: string; clientId: string; groupId: string } {
  if (!SECRET) {
    throw new Error('OAUTH_STATE_SECRET is not defined in environment variables');
  }
  try {
    const decoded = jwt.verify(state, SECRET) as any;
    return {
      platform: decoded.platform,
      clientId: decoded.clientId,
      groupId: decoded.groupId,
    };
  } catch (err) {
    throw new Error('Invalid or expired OAuth state — possible CSRF attempt');
  }
}
