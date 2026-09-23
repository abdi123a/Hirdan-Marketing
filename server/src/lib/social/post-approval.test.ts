import { describe, it, expect } from 'vitest';
import {
  canApproveSocialPosts,
  requestedStatusError,
  manualPublishError,
  changesPublishedContent,
  contributorUpdateOutcome,
  parseRejectionReason,
  stableJson,
  MAX_REJECTION_REASON_CHARS,
} from './post-approval.js';

describe('canApproveSocialPosts', () => {
  it('ADMIN and MANAGE on social_media approve; WRITE and clients do not', () => {
    expect(canApproveSocialPosts('ADMIN', 'NONE')).toBe(true);
    expect(canApproveSocialPosts('MANAGER', 'MANAGE')).toBe(true);
    expect(canApproveSocialPosts('STAFF', 'MANAGE')).toBe(true);
    expect(canApproveSocialPosts('MANAGER', 'WRITE')).toBe(false);
    expect(canApproveSocialPosts('STAFF', 'WRITE')).toBe(false);
    expect(canApproveSocialPosts('CLIENT', 'MANAGE')).toBe(false);
    expect(canApproveSocialPosts(undefined, undefined)).toBe(false);
  });
});

describe('requestedStatusError', () => {
  it('blocks contributors from SCHEDULED only', () => {
    expect(requestedStatusError('SCHEDULED', false)).toMatch(/approval/i);
    expect(requestedStatusError('DRAFT', false)).toBeNull();
    expect(requestedStatusError('AWAITING_APPROVAL', false)).toBeNull();
    expect(requestedStatusError(undefined, false)).toBeNull();
    expect(requestedStatusError('SCHEDULED', true)).toBeNull();
  });
});

describe('manualPublishError', () => {
  const at = new Date();
  it('approvers may always publish', () => {
    expect(manualPublishError({ status: 'DRAFT', approvedAt: null }, true)).toBeNull();
  });
  it('contributors need an approved, non-draft post', () => {
    expect(manualPublishError({ status: 'DRAFT', approvedAt: null }, false)).not.toBeNull();
    expect(manualPublishError({ status: 'AWAITING_APPROVAL', approvedAt: null }, false)).not.toBeNull();
    expect(manualPublishError({ status: 'FAILED', approvedAt: null }, false)).not.toBeNull();
    expect(manualPublishError({ status: 'DRAFT', approvedAt: at }, false)).not.toBeNull();
    expect(manualPublishError({ status: 'SCHEDULED', approvedAt: at }, false)).toBeNull();
    expect(manualPublishError({ status: 'FAILED', approvedAt: at }, false)).toBeNull();
  });
});

describe('changesPublishedContent', () => {
  const current = {
    caption: 'hello',
    platformContent: { instagram: { caption: 'hi', type: 'post' }, comments: [], activities: [] },
    mediaUrls: ['https://x/a.jpg'],
    mediaType: 'image',
    scheduledFor: new Date('2026-10-01T10:00:00Z'),
  };

  it('resending the same values is not a change (key order ignored)', () => {
    expect(changesPublishedContent(current, {
      caption: 'hello',
      platformContent: { activities: [], comments: [], instagram: { type: 'post', caption: 'hi' } },
      mediaUrls: ['https://x/a.jpg'],
      mediaType: 'image',
      scheduledFor: '2026-10-01T10:00:00.000Z',
      accountsChanged: false,
    })).toBe(false);
  });

  it('comments, activity, writer and tags are not publish input', () => {
    expect(changesPublishedContent(current, {
      platformContent: {
        ...current.platformContent,
        comments: [{ id: '1', text: 'looks good' }],
        activities: [{ id: '2' }],
        assignedWriter: 'Sam',
        tags: ['promo'],
      },
    })).toBe(false);
  });

  it('detects real changes', () => {
    expect(changesPublishedContent(current, { caption: 'changed' })).toBe(true);
    expect(changesPublishedContent(current, {
      platformContent: { ...current.platformContent, instagram: { caption: 'new', type: 'post' } },
    })).toBe(true);
    expect(changesPublishedContent(current, { mediaUrls: [] })).toBe(true);
    expect(changesPublishedContent(current, { mediaType: 'video' })).toBe(true);
    expect(changesPublishedContent(current, { scheduledFor: '2026-10-02T10:00:00Z' })).toBe(true);
    expect(changesPublishedContent(current, { scheduledFor: null })).toBe(true);
    expect(changesPublishedContent(current, { accountsChanged: true })).toBe(true);
  });
});

describe('contributorUpdateOutcome', () => {
  it('editing an approved scheduled post sends it back for approval', () => {
    expect(contributorUpdateOutcome('SCHEDULED', undefined, true)).toEqual({ status: 'AWAITING_APPROVAL', clearApproval: true });
  });
  it('a comment on a scheduled post leaves it alone', () => {
    expect(contributorUpdateOutcome('SCHEDULED', undefined, false)).toEqual({ status: undefined, clearApproval: false });
  });
  it('moving to draft or review clears approval', () => {
    expect(contributorUpdateOutcome('SCHEDULED', 'DRAFT', false)).toEqual({ status: 'DRAFT', clearApproval: true });
    expect(contributorUpdateOutcome('DRAFT', 'AWAITING_APPROVAL', false)).toEqual({ status: 'AWAITING_APPROVAL', clearApproval: true });
  });
  it('editing a draft keeps it a draft', () => {
    expect(contributorUpdateOutcome('DRAFT', undefined, true)).toEqual({ status: undefined, clearApproval: true });
  });
});

describe('parseRejectionReason', () => {
  it('is optional and trimmed', () => {
    expect(parseRejectionReason(undefined)).toEqual({ reason: null });
    expect(parseRejectionReason('   ')).toEqual({ reason: null });
    expect(parseRejectionReason('  wrong logo ')).toEqual({ reason: 'wrong logo' });
  });
  it('rejects non-text and over-long reasons', () => {
    expect(parseRejectionReason(42)).toHaveProperty('error');
    expect(parseRejectionReason('x'.repeat(MAX_REJECTION_REASON_CHARS + 1))).toHaveProperty('error');
  });
});

describe('stableJson', () => {
  it('sorts keys recursively and keeps array order', () => {
    expect(stableJson({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
  });
});
