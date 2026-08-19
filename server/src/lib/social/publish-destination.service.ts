import { prisma } from '../prisma.js';
import { publishPostToPlatform } from './platform-router.service.js';
import { isRateLimitError } from './meta.service.js';
import { captureDestinationPermalink } from './permalink.service.js';
import { extractSocialApiError, logSocialError } from './safe-error.js';

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
 * Publish one destination and record the outcome on it.
 *
 * This is the single copy of a loop body that used to be pasted three times
 * (scheduler, publish-now, retry). Only the scheduler's copy checked rate
 * limits, so a manual publish or retry against a throttled account hammered the
 * API, never recorded the cooldown, and burned a retry attempt each time.
 *
 * The caller is responsible for claiming the destination first (marking it
 * PUBLISHING) — the three call sites claim in meaningfully different ways.
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
    await prisma.socialPostDestination.update({
      where: { id: dest.id },
      data: { status: opts.skippedStatus, lockedAt: null, lastError: error },
    });
    return { outcome: 'skipped', error };
  }

  try {
    const platformPostId = await publishPostToPlatform(post, dest.socialAccount);

    await prisma.socialPostDestination.update({
      where: { id: dest.id },
      data: {
        status: 'PUBLISHED',
        platformPostId,
        publishedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });

    // Store the live post URL for the "View on platform" action. Best-effort and
    // non-fatal: platforms that need processing time (TikTok) get picked up
    // later by resolvePendingPermalinks().
    await captureDestinationPermalink(dest.id, dest.socialAccount, platformPostId);

    return { outcome: 'published' };
  } catch (err: unknown) {
    const error = extractSocialApiError(err);
    logSocialError(`Error publishing post destination ${dest.id}`, err);

    // Record the cooldown on the shared account row so every caller backs off
    // together — this route, the other one, and the scheduler's claim query.
    if (isRateLimitError(err)) {
      await prisma.socialAccount.update({
        where: { id: dest.socialAccountId },
        data: {
          healthStatus: 'rate_limited',
          healthMessage: `Rate limit hit: ${error}`,
          rateLimitedUntil: new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS),
        },
      });
    }

    const nextAttempts = dest.attempts + 1;
    await prisma.socialPostDestination.update({
      where: { id: dest.id },
      data: {
        status: nextAttempts >= opts.maxAttempts ? 'FAILED' : 'QUEUED',
        attempts: nextAttempts,
        lockedAt: null,
        lastError: error,
      },
    });

    return { outcome: 'failed', error };
  }
}
