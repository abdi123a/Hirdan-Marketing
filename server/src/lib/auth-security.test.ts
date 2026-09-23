import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma.js', () => ({ prisma: {} }));

const { decideAccessSession, decideRefreshReuse, refreshFamilyOf, REFRESH_REUSE_GRACE_MS } = await import(
  './auth-security.js'
);

describe('decideAccessSession', () => {
  it('accepts a token whose session family is still live', () => {
    expect(decideAccessSession('fam-1', true)).toBe('allow');
  });

  it('rejects a token whose session was revoked (logout / password change / admin)', () => {
    expect(decideAccessSession('fam-1', false)).toBe('revoked');
    expect(decideAccessSession('fam-1', undefined)).toBe('revoked');
  });

  it('lets pre-deploy tokens without sid run out their short expiry', () => {
    expect(decideAccessSession(undefined, undefined)).toBe('legacy');
  });

  it('rejects malformed sid claims', () => {
    expect(decideAccessSession('', true)).toBe('invalid');
    expect(decideAccessSession(123, true)).toBe('invalid');
    expect(decideAccessSession(null, true)).toBe('invalid');
  });
});

describe('decideRefreshReuse', () => {
  const now = new Date('2026-09-23T12:00:00Z');

  it('rotates a token this request claimed', () => {
    expect(decideRefreshReuse(true, null, now)).toBe('rotate');
  });

  it('treats a concurrent refresh within the grace window as benign', () => {
    expect(decideRefreshReuse(false, new Date(now.getTime() - 5_000), now)).toBe('grace');
    expect(decideRefreshReuse(false, new Date(now.getTime() - REFRESH_REUSE_GRACE_MS), now)).toBe('grace');
    // usedAt not yet visible (racing writer) counts as "just now"
    expect(decideRefreshReuse(false, null, now)).toBe('grace');
  });

  it('flags reuse after the grace window', () => {
    expect(decideRefreshReuse(false, new Date(now.getTime() - REFRESH_REUSE_GRACE_MS - 1), now)).toBe(
      'reuse-detected'
    );
  });
});

describe('refreshFamilyOf', () => {
  it('keeps the existing family so grace refreshes never fork a new session', () => {
    expect(refreshFamilyOf({ id: 'row-2', familyId: 'fam-1' })).toBe('fam-1');
  });

  it('keys legacy rows without a family by their own id', () => {
    expect(refreshFamilyOf({ id: 'row-1', familyId: null })).toBe('row-1');
  });
});
