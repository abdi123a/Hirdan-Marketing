import { describe, it, expect } from 'vitest';
import { diffDestinations, type ExistingDestination } from './destination-diff.js';

const dest = (id: string, socialAccountId: string, status = 'QUEUED'): ExistingDestination =>
  ({ id, socialAccountId, status });

describe('diffDestinations', () => {
  it('is a no-op when the caller resends the existing account list', () => {
    // The regression that mattered: every partial update (reschedule, comment,
    // bulk status change) resends the post's own accountIds.
    const existing = [dest('d1', 'acc-a'), dest('d2', 'acc-b')];
    expect(diffDestinations(existing, ['acc-a', 'acc-b'])).toEqual({ toRemove: [], toCreate: [] });
  });

  it('preserves a FAILED destination when the account list is resent', () => {
    // Previously this row was deleted and recreated as QUEUED with attempts=0,
    // so the scheduler republished a post that had already given up.
    const existing = [dest('d1', 'acc-a', 'FAILED')];
    expect(diffDestinations(existing, ['acc-a'])).toEqual({ toRemove: [], toCreate: [] });
  });

  it('creates only the newly added account', () => {
    const existing = [dest('d1', 'acc-a')];
    expect(diffDestinations(existing, ['acc-a', 'acc-b'])).toEqual({
      toRemove: [],
      toCreate: ['acc-b'],
    });
  });

  it('removes only the deselected account', () => {
    const existing = [dest('d1', 'acc-a'), dest('d2', 'acc-b')];
    expect(diffDestinations(existing, ['acc-a'])).toEqual({ toRemove: ['d2'], toCreate: [] });
  });

  it('never removes a PUBLISHED destination, even when deselected', () => {
    const existing = [dest('d1', 'acc-a', 'PUBLISHED')];
    expect(diffDestinations(existing, [])).toEqual({ toRemove: [], toCreate: [] });
  });

  it('never removes a PUBLISHING destination the scheduler is mid-publish on', () => {
    const existing = [dest('d1', 'acc-a', 'PUBLISHING')];
    expect(diffDestinations(existing, [])).toEqual({ toRemove: [], toCreate: [] });
  });

  it('does not recreate a destination for an account that already has a live one', () => {
    const existing = [dest('d1', 'acc-a', 'PUBLISHED')];
    expect(diffDestinations(existing, ['acc-a'])).toEqual({ toRemove: [], toCreate: [] });
  });

  it('clears every removable destination when the selection is emptied', () => {
    const existing = [dest('d1', 'acc-a'), dest('d2', 'acc-b', 'FAILED'), dest('d3', 'acc-c', 'PUBLISHED')];
    expect(diffDestinations(existing, [])).toEqual({ toRemove: ['d1', 'd2'], toCreate: [] });
  });

  it('de-duplicates a repeated account id in the request', () => {
    expect(diffDestinations([], ['acc-a', 'acc-a'])).toEqual({ toRemove: [], toCreate: ['acc-a'] });
  });

  it('handles a swap: one account out, one in', () => {
    const existing = [dest('d1', 'acc-a')];
    expect(diffDestinations(existing, ['acc-b'])).toEqual({ toRemove: ['d1'], toCreate: ['acc-b'] });
  });
});
