import { createHash, randomBytes } from 'crypto';
import { prisma } from '../prisma.js';
import { encryptToken, decryptToken } from './token-crypto.service.js';

/**
 * Server-side OAuth handshake state for social account connections.
 *
 * This used to be a stateless 10-minute JWT: its nonce was never checked (so a
 * captured state could be replayed any number of times within the window), it
 * was not tied to the user who started the flow, and X's PKCE verifier rode
 * along inside it unencrypted — anyone who saw the authorize URL had both halves
 * of the PKCE pair. Now the state is an opaque random id pointing at a row that
 * holds everything the callback needs, and the callback deletes the row as it
 * reads it, so each state works exactly once.
 */

const STATE_TTL_MS = 10 * 60 * 1000;
const PICKER_TTL_MS = 10 * 60 * 1000;

export interface OAuthStateData {
  platform: string;
  clientId: string;
  groupId: string;
  userId: string;
  codeVerifier?: string;
}

function newId(): string {
  return randomBytes(32).toString('base64url');
}

async function purgeExpired(): Promise<void> {
  try {
    await prisma.socialOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // Housekeeping only — never block a connect on it.
  }
}

/** PKCE S256 challenge for a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Persist a new single-use state for a connect flow started by `userId`.
 * Pass `withPkce` for platforms that use PKCE; the verifier stays server-side.
 */
export async function createOAuthState(input: {
  platform: string;
  clientId: string;
  groupId: string;
  userId: string;
  withPkce?: boolean;
}): Promise<{ state: string; codeVerifier?: string }> {
  await purgeExpired();
  const state = newId();
  const codeVerifier = input.withPkce ? randomBytes(32).toString('base64url') : undefined;
  await prisma.socialOAuthState.create({
    data: {
      id: state,
      kind: 'state',
      platform: input.platform,
      clientId: input.clientId,
      groupId: input.groupId,
      userId: input.userId,
      codeVerifier: codeVerifier ? encryptToken(codeVerifier) : null,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });
  return { state, codeVerifier };
}

/**
 * Look up and atomically consume a callback state. Throws on an unknown,
 * already-used, expired or wrong-platform state.
 */
export async function consumeOAuthState(state: string, platform: string): Promise<OAuthStateData> {
  const invalid = () => new Error('Invalid or expired OAuth state — please start the connection again.');
  if (typeof state !== 'string' || state.length === 0 || state.length > 64) throw invalid();

  const row = await prisma.socialOAuthState.findUnique({ where: { id: state } });
  if (!row || row.kind !== 'state') throw invalid();

  // Delete-as-claim: of two concurrent callbacks carrying the same state, only
  // the one whose delete actually removed the row may proceed.
  const { count } = await prisma.socialOAuthState.deleteMany({ where: { id: state, kind: 'state' } });
  if (count === 0) throw invalid();
  if (row.expiresAt.getTime() < Date.now()) throw invalid();
  if (row.platform !== platform) throw new Error('OAuth state platform mismatch');

  return {
    platform: row.platform,
    clientId: row.clientId,
    groupId: row.groupId ?? '',
    userId: row.userId,
    codeVerifier: row.codeVerifier ? decryptToken(row.codeVerifier) : undefined,
  };
}

// ─── Meta account-picker sessions ────────────────────────────────────────────
//
// Kept in the same table (kind='picker') rather than process memory so the
// picker works when the callback and the follow-up requests land on different
// instances. The payload holds page/user access tokens, so it is encrypted.

export async function createPickerSession<T extends { platform: string; clientId: string; groupId: string }>(
  userId: string,
  payload: T,
): Promise<string> {
  const id = newId();
  await prisma.socialOAuthState.create({
    data: {
      id,
      kind: 'picker',
      platform: payload.platform,
      clientId: payload.clientId,
      groupId: payload.groupId,
      userId,
      payloadEnc: encryptToken(JSON.stringify(payload)),
      expiresAt: new Date(Date.now() + PICKER_TTL_MS),
    },
  });
  return id;
}

/**
 * The picker session, or null when it is missing, expired, or belongs to a
 * different user than the one who started the OAuth handshake.
 */
export async function getPickerSession<T>(
  sessionId: string,
  userId: string,
): Promise<(T & { expires: number }) | null> {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 64) return null;
  const row = await prisma.socialOAuthState.findUnique({ where: { id: sessionId } });
  if (!row || row.kind !== 'picker' || !row.payloadEnc) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.userId !== userId) return null;
  try {
    const payload = JSON.parse(decryptToken(row.payloadEnc)) as T;
    return { ...payload, expires: row.expiresAt.getTime() };
  } catch {
    return null;
  }
}

export async function deletePickerSession(sessionId: string): Promise<void> {
  await prisma.socialOAuthState.deleteMany({ where: { id: sessionId, kind: 'picker' } });
}
