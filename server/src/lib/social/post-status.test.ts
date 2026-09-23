import { describe, it, expect } from 'vitest';
import { decidePostStatus } from './post-status.js';

const d = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe('decidePostStatus', () => {
  it('publishes when every destination is live', () => {
    expect(decidePostStatus(d('PUBLISHED', 'PUBLISHED'), 'SCHEDULED').status).toBe('PUBLISHED');
  });
  it('leaves the post alone while a destination is still in flight', () => {
    expect(decidePostStatus(d('PUBLISHED', 'PUBLISHING'), 'SCHEDULED').status).toBeNull();
  });
  it('uses the caller fallback while destinations are still queued', () => {
    expect(decidePostStatus(d('PUBLISHED', 'QUEUED'), 'SCHEDULED').status).toBe('SCHEDULED');
    expect(decidePostStatus(d('FAILED', 'QUEUED'), 'DRAFT').status).toBe('DRAFT');
    expect(decidePostStatus(d('QUEUED'), null).status).toBeNull();
  });
  it('reports PARTIAL vs FAILED once everything is terminal', () => {
    expect(decidePostStatus(d('PUBLISHED', 'FAILED'), 'SCHEDULED').status).toBe('PARTIAL');
    expect(decidePostStatus(d('FAILED', 'FAILED'), 'SCHEDULED').status).toBe('FAILED');
  });
  it('never reports PUBLISHED for a post with no destinations', () => {
    expect(decidePostStatus([], 'DRAFT').status).toBe('DRAFT');
  });
});
