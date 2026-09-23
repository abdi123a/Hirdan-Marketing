import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { tiktokPkceChallenge, getTikTokAuthorizationUrl, isTikTokPkceEnabled } from './tiktok.service.js';

describe('tiktokPkceChallenge', () => {
  it('is the lowercase hex SHA-256 of the verifier (TikTok), not RFC 7636 base64url', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = tiktokPkceChallenge(verifier);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('hex'));
    expect(challenge).toMatch(/^[0-9a-f]{64}$/);
    // The RFC 7636 appendix-B value for the same verifier — must NOT be what we send.
    expect(challenge).not.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('matches a known vector', () => {
    expect(tiktokPkceChallenge('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('getTikTokAuthorizationUrl', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('omits PKCE parameters without a verifier (web Login Kit flow)', () => {
    process.env.TIKTOK_CLIENT_KEY = 'ck';
    const url = new URL(getTikTokAuthorizationUrl('st'));
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
  });

  it('adds a hex S256 challenge when given a verifier', () => {
    process.env.TIKTOK_CLIENT_KEY = 'ck';
    const url = new URL(getTikTokAuthorizationUrl('st', 'abc'));
    expect(url.searchParams.get('code_challenge')).toBe(tiktokPkceChallenge('abc'));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('PKCE is opt-in via TIKTOK_USE_PKCE', () => {
    delete process.env.TIKTOK_USE_PKCE;
    expect(isTikTokPkceEnabled()).toBe(false);
    process.env.TIKTOK_USE_PKCE = 'true';
    expect(isTikTokPkceEnabled()).toBe(true);
  });
});
