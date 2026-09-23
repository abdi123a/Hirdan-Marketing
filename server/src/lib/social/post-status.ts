// What a SocialPost's aggregate status should become, given its destinations.
//
// Kept free of Prisma so it can be unit-tested, same split as permalink.ts
// (pure) vs permalink.service.ts. Used by the scheduler and the publish-now /
// retry routes so they agree on one rule.

/** Statuses a destination may be claimed from for a manual publish/retry. */
export const MANUALLY_PUBLISHABLE_DESTINATION_STATUSES = ['QUEUED', 'FAILED'] as const;

/**
 * Post statuses a client may set directly through create/update. Everything
 * else (PUBLISHING, PUBLISHED, PARTIAL, FAILED) is written only by the
 * publishing engine, so a request body can't fake a post as live or wedge it
 * into a state the scheduler never leaves.
 */
export const CLIENT_SETTABLE_POST_STATUSES = new Set(['DRAFT', 'AWAITING_APPROVAL', 'SCHEDULED']);

export interface PostStatusDecision {
  /** New post status, or null to leave the post's status alone. */
  status: string | null;
  published: number;
  failed: number;
  total: number;
}

/**
 * - Every destination PUBLISHED → PUBLISHED.
 * - Any destination still PUBLISHING → leave alone: whoever holds it finalizes.
 * - Some destinations still QUEUED → `whenQueued` (null = leave alone). The
 *   scheduler keeps the post SCHEDULED so the next tick retries; a manual
 *   publish restores the status the post had before, so untargeted
 *   destinations are neither stranded nor published behind the user's back.
 * - Otherwise everything is terminal → PARTIAL if anything went live, else FAILED.
 */
export function decidePostStatus(
  destinations: Array<{ status: string }>,
  whenQueued: string | null,
): PostStatusDecision {
  const total = destinations.length;
  const published = destinations.filter((d) => d.status === 'PUBLISHED').length;
  const failed = destinations.filter((d) => d.status === 'FAILED').length;
  const inFlight = destinations.some((d) => d.status === 'PUBLISHING');
  const queued = destinations.some((d) => d.status !== 'PUBLISHED' && d.status !== 'FAILED' && d.status !== 'PUBLISHING');

  let status: string | null;
  if (total > 0 && published === total) status = 'PUBLISHED';
  else if (inFlight) status = null;
  else if (queued) status = whenQueued;
  else if (failed > 0) status = published > 0 ? 'PARTIAL' : 'FAILED';
  else status = whenQueued;

  return { status, published, failed, total };
}
