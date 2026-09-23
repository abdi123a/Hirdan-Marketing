import { prisma } from '../prisma.js';
import { publishPostToPlatform } from './platform-router.service.js';
import { isRateLimitError } from './meta.service.js';
import { captureDestinationPermalink } from './permalink.service.js';
import { extractSocialApiError, logSocialError } from './safe-error.js';
import { decidePostStatus } from './post-status.js';

/** How long an account sits out after a platform reports a rate limit. */
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;

export type PublishDestinationOutcome = 'published' | 'skipped' | 'failed';

export interface PublishDestinationResult {
  outcome: PublishDestinationOutcome;
  /** Reason, present for 'skipped' and 'failed'. Safe to show to the user. */
  error?: string;
}

export interface PublishDestinationOptions {
  /**
   * Attempts allowed before a failure becomes terminal (FAILED rather than
   * re-QUEUED for another go). The scheduler comes back on its next tick, so it
   * passes 3. The manual routes are one-shot and must pass 1 — see skippedStatus
   * for why they can never leave work QUEUED.
   */
  maxAttempts: number;
  /**
   * Where to leave a destination that was NOT attempted because its account is
   * still in rate-limit cooldown.
   *
   * The scheduler passes 'QUEUED': it deliberately leaves the parent post
   * SCHEDULED, so its claim query picks the destination back up once the
   * cooldown expires.
   *
   * publish-now/retry must pass 'FAILED'. They always overwrite the post status
   * with an aggregate that can never be SCHEDULED, and the scheduler's claim
   * requires `sp.status = 'SCHEDULED'` — so a QUEUED destination left behind by
   * a manual route would never be claimed by anything again, and /retry only
   * loads FAILED rows so it could not rescue it either. FAILED keeps the
   * destination terminal, visible, and reachable from the Retry action.
   */
  skippedStatus: 'QUEUED' | 'FAILED';
}

/**
 * Atomically claim one destination for publishing: flip it to PUBLISHING only
 * if it is still in one of `fromStatuses` and unlocked. Returns false when some
 * other worker (another scheduler tick or instance, or a manual publish) got
 * there first — the caller must then skip it.
 *
 * Claiming each destination right before it is published (rather than a whole
 * batch up front) keeps lockedAt meaningful: it is the start of *this*
 * destination's attempt, so the stale-lock recovery can't mistake a destination
 * that is merely waiting its turn behind a slow video upload for an abandoned one.
 */
export async function claimDestination(
  destId: string,
  fromStatuses: readonly string[],
): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.socialPostDestination.updateMany({
    where: { id: destId, status: { in: [...fromStatuses] }, lockedAt: null },
    data: { status: 'PUBLISHING', lockedAt: now, lastAttemptAt: now },
  });
  return count === 1;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Record a destination that is now live on the platform. Retries transient DB
 * errors, then falls back to a narrower write (a platform id that doesn't fit
 * the column must not cost us the PUBLISHED status). Returns false only if the
 * row could not be marked at all — it is then left PUBLISHING (never re-queued
 * by this code) and logged loudly so it can be reconciled by hand.
 */
async function recordPublished(destId: string, platformPostId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.socialPostDestination.update({
        where: { id: destId },
        data: {
          status: 'PUBLISHED',
          platformPostId,
          publishedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
      return true;
    } catch (err: unknown) {
      logSocialError(`Published destination ${destId} (platform id ${platformPostId}) but recording it failed`, err);
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }
  try {
    await prisma.socialPostDestination.update({
      where: { id: destId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        lockedAt: null,
        lastError: `Published, but the platform post id could not be stored: ${String(platformPostId).slice(0, 500)}`,
      },
    });
    return true;
  } catch (err: unknown) {
    logSocialError(
      `CRITICAL: destination ${destId} is LIVE (platform id ${platformPostId}) but could not be marked PUBLISHED`,
      err,
    );
    return false;
  }
}

/**
 * Publish one destination and record the outcome on it.
 *
 * This is the single copy of a loop body that used to be pasted three times
 * (scheduler, publish-now, retry). Only the scheduler's copy checked rate
 * limits, so a manual publish or retry against a throttled account hammered the
 * API, never recorded the cooldown, and burned a retry attempt each time.
 *
 * The caller must have claimed the destination first (claimDestination()).
 *
 * Never throws. Crucially, once the platform call has succeeded nothing after it
 * can turn the outcome into a failure: this used to share one try/catch with the
 * DB write that follows, so a DB hiccup there recorded a failure, re-queued the
 * destination, and the next attempt published the same post a second time.
 */
export async function publishDestination(
  dest: any,
  post: any,
  opts: PublishDestinationOptions,
): Promise<PublishDestinationResult> {
  // Never spend an attempt on an account the platform has already told us to
  // back off from. Doing so is what let three ticks exhaust the retry budget
  // before a 15-minute cooldown had even finished.
  const cooldownUntil = dest.socialAccount?.rateLimitedUntil;
  if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
    const error = `Skipped: rate limited until ${new Date(cooldownUntil).toISOString()}`;
    try {
      await prisma.socialPostDestination.update({
        where: { id: dest.id },
        data: { status: opts.skippedStatus, lockedAt: null, lastError: error },
      });
    } catch (err: unknown) {
      // Left PUBLISHING; the stale-lock recovery releases it later.
      logSocialError(`Could not release rate-limited destination ${dest.id}`, err);
    }
    return { outcome: 'skipped', error };
  }

  // Step 1: the platform call. The only thing whose failure means "not live".
  let platformPostId: string;
  try {
    platformPostId = await publishPostToPlatform(post, dest.socialAccount);
  } catch (err: unknown) {
    return recordFailure(dest, err, opts);
  }

  // Step 2: it is live. Bookkeeping from here on must never lead to a retry.
  await recordPublished(dest.id, platformPostId);

  // Store the live post URL for the "View on platform" action. Best-effort and
  // non-fatal: platforms that need processing time (TikTok) get picked up
  // later by resolvePendingPermalinks().
  try {
    await captureDestinationPermalink(dest.id, dest.socialAccount, platformPostId);
  } catch (err: unknown) {
    logSocialError(`Could not capture permalink for destination ${dest.id}`, err);
  }

  return { outcome: 'published' };
}

async function recordFailure(
  dest: any,
  err: unknown,
  opts: PublishDestinationOptions,
): Promise<PublishDestinationResult> {
  const error = extractSocialApiError(err);
  logSocialError(`Error publishing post destination ${dest.id}`, err);

  // Record the cooldown on the shared account row so every caller backs off
  // together — this route, the other one, and the scheduler's claim query.
  if (isRateLimitError(err)) {
    try {
      await prisma.socialAccount.update({
        where: { id: dest.socialAccountId },
        data: {
          healthStatus: 'rate_limited',
          healthMessage: `Rate limit hit: ${error}`,
          rateLimitedUntil: new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS),
        },
      });
    } catch (dbErr: unknown) {
      logSocialError(`Could not record rate limit for account ${dest.socialAccountId}`, dbErr);
    }
  }

  const nextAttempts = (dest.attempts ?? 0) + 1;
  try {
    await prisma.socialPostDestination.update({
      where: { id: dest.id },
      data: {
        status: nextAttempts >= opts.maxAttempts ? 'FAILED' : 'QUEUED',
        attempts: nextAttempts,
        lockedAt: null,
        lastError: error,
      },
    });
  } catch (dbErr: unknown) {
    // Left PUBLISHING; the stale-lock recovery re-queues or fails it later.
    logSocialError(`Could not record failure for destination ${dest.id}`, dbErr);
  }

  return { outcome: 'failed', error };
}

/**
 * Recompute a post's aggregate status from its destinations and write it.
 * `whenQueued` is what to set while some destinations are still QUEUED (null =
 * leave the post's status alone). Never throws.
 */
export async function finalizePostStatus(postId: string, whenQueued: string | null): Promise<void> {
  try {
    const [post, allDests] = await Promise.all([
      prisma.socialPost.findUnique({ where: { id: postId }, select: { publishedAt: true } }),
      prisma.socialPostDestination.findMany({ where: { postId } }),
    ]);
    if (!post) return;
    const decision = decidePostStatus(allDests, whenQueued);
    if (!decision.status) return;

    const failedErrors = allDests
      .filter((d) => d.status === 'FAILED' && d.lastError)
      .map((d) => `${d.platform}: ${d.lastError}`)
      .join('; ');

    if (decision.status === 'PUBLISHED') {
      await prisma.socialPost.update({
        where: { id: postId },
        data: { status: 'PUBLISHED', publishedAt: post.publishedAt ?? new Date(), errorMessage: null },
      });
      for (const dest of allDests) {
        await prisma.postInsight.upsert({
          where: { postId_platform: { postId, platform: dest.platform } },
          create: { postId, platform: dest.platform, likes: 0, comments: 0, shares: 0, saved: 0, views: 0, impressions: 0, reach: 0 },
          update: {},
        }).catch(() => {});
      }
      return;
    }

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: decision.status,
        // Keep the first successful publish time on partial failures.
        publishedAt: decision.published > 0 ? (post.publishedAt ?? new Date()) : null,
        errorMessage:
          decision.failed > 0
            ? failedErrors || `Failed to publish to ${decision.failed} out of ${decision.total} platforms.`
            : null,
      },
    });
  } catch (err: unknown) {
    logSocialError(`Could not finalize status for post ${postId}`, err);
  }
}
