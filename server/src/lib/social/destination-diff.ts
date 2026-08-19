// Which destination rows a post edit should actually add or remove.
//
// Kept free of Prisma so it can be unit-tested on its own, same split as
// permalink.ts (pure) vs permalink.service.ts (Prisma-bound).
//
// PUT /social/posts/:id used to reconcile destinations by deleting every
// non-PUBLISHED row and recreating one per selected account. Most callers
// resend the post's existing accountIds just to change an unrelated field, so
// that rebuilt every destination on every edit and threw away attempts,
// lastError, lastAttemptAt, lockedAt and platformPostUrl. A FAILED destination
// came back QUEUED with attempts reset to 0, which meant a post that had
// exhausted its retry budget got published again — adding a comment could
// republish a post.
//
// Diffing makes resending the same account list a genuine no-op.

export interface ExistingDestination {
  id: string;
  socialAccountId: string;
  status: string;
}

export interface DestinationDiff {
  /** Destination row ids to delete. */
  toRemove: string[];
  /** Account ids that need a new QUEUED destination row. */
  toCreate: string[];
}

/**
 * PUBLISHED rows are live posts on the platform; PUBLISHING rows are held by an
 * in-flight publish (deleting one out from under the scheduler both breaks that
 * tick and can duplicate the live post). Neither is ever removed here, even if
 * the caller deselected the account.
 */
const UNREMOVABLE_STATUSES = new Set(['PUBLISHED', 'PUBLISHING']);

export function diffDestinations(
  existing: ExistingDestination[],
  desiredAccountIds: string[],
): DestinationDiff {
  const desired = new Set(desiredAccountIds);
  const alreadyTargeted = new Set(existing.map((d) => d.socialAccountId));

  return {
    toRemove: existing
      .filter((d) => !desired.has(d.socialAccountId) && !UNREMOVABLE_STATUSES.has(d.status))
      .map((d) => d.id),
    // Set iteration also de-duplicates a repeated account id in the request.
    toCreate: [...desired].filter((accountId) => !alreadyTargeted.has(accountId)),
  };
}
