import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import {
  publishDestination, claimDestination, finalizePostStatus,
} from '../lib/social/publish-destination.service.js';
import { diffDestinations } from '../lib/social/destination-diff.js';
import { uploadSocialMediaFile, sniffUploadedMedia } from '../lib/social/storage.service.js';
import { isAllowedUploadDeclaration, isOwnMediaUrl, ownMediaBases } from '../lib/social/media-safety.js';
import {
  CLIENT_SETTABLE_POST_STATUSES, MANUALLY_PUBLISHABLE_DESTINATION_STATUSES,
} from '../lib/social/post-status.js';
import { callAI, resolveProviderKey } from '../lib/ai-provider.js';
import { AppError } from '../lib/errors.js';
import { logSocialError } from '../lib/social/safe-error.js';
import multer from 'multer';
import path from 'path';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { PATHS } from '../lib/paths.js';
import {
  findLinkCandidates, linkImportedPostToGroup, unlinkImportedPost, PostLinkError,
} from '../lib/social/post-link.service.js';
import {
  canApproveSocialPosts, requestedStatusError, manualPublishError, changesPublishedContent,
  contributorUpdateOutcome, parseRejectionReason, SUBMITTABLE_POST_STATUSES,
  APPROVABLE_POST_STATUSES, REJECTABLE_POST_STATUSES, APPROVER_ONLY_MESSAGE,
} from '../lib/social/post-approval.js';
import { getRequestPermissions } from '../lib/permission-guard.js';
import type { Request } from 'express';

/**
 * Whether the caller may schedule/publish directly and approve or reject
 * others' posts: ADMIN, or MANAGE on social_media. Everyone else who reaches
 * these routes (WRITE) works through submit-for-approval.
 */
async function isSocialApprover(req: Request): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'ADMIN') return true;
  const permissions = await getRequestPermissions(req);
  return canApproveSocialPosts(req.user.role, permissions.social_media);
}

/** Social account shape returned to the browser: never the encrypted tokens. */
const SAFE_ACCOUNT = { omit: { accessTokenEnc: true, refreshTokenEnc: true } } as const;

/**
 * Every account a post targets must belong to the post's client and still be
 * connected — otherwise one client's post could go out on another client's
 * Pages. Returns the accounts keyed by id, or an error message for a 400.
 */
async function loadPublishableAccounts(
  clientId: string,
  accountIds: string[],
): Promise<{ accounts: Map<string, { id: string; platform: string }> } | { error: string }> {
  if (accountIds.some((id) => typeof id !== 'string' || !id)) {
    return { error: 'accountIds must be a list of account ids' };
  }
  const accounts = accountIds.length
    ? await prisma.socialAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, platform: true, clientId: true, isActive: true },
      })
    : [];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const missing = accountIds.filter((id) => !byId.has(id));
  if (missing.length > 0) return { error: `Unknown account id(s): ${missing.join(', ')}` };
  const foreign = accounts.filter((a) => a.clientId !== clientId);
  if (foreign.length > 0) {
    return { error: `Account(s) not connected to this client: ${foreign.map((a) => a.id).join(', ')}` };
  }
  const inactive = accounts.filter((a) => !a.isActive);
  if (inactive.length > 0) {
    return { error: `Account(s) are disconnected — reconnect before posting: ${inactive.map((a) => a.id).join(', ')}` };
  }
  return { accounts: new Map(accounts.map((a) => [a.id, { id: a.id, platform: a.platform }])) };
}

/**
 * mediaUrls may only reference media this app uploaded — the publisher fetches
 * each one server-side and pushes it to a social platform, so an arbitrary URL
 * is an SSRF / file-exfiltration primitive. URLs already stored on the post are
 * accepted unchanged so pre-existing posts stay editable (the fetch layer still
 * refuses private addresses and non-upload local paths for those).
 */
function validateMediaUrls(mediaUrls: unknown, alreadyOnPost: unknown = []): string | null {
  if (mediaUrls === undefined || mediaUrls === null) return null;
  if (!Array.isArray(mediaUrls) || mediaUrls.length > 20) return 'mediaUrls must be a list of at most 20 URLs';
  const existing = new Set(Array.isArray(alreadyOnPost) ? alreadyOnPost.filter((u) => typeof u === 'string') : []);
  const bases = ownMediaBases(process.env);
  for (const url of mediaUrls) {
    if (typeof url !== 'string') return 'mediaUrls must be a list of URLs';
    if (existing.has(url)) continue;
    if (!isOwnMediaUrl(url, bases)) return 'Media must be uploaded through the media uploader';
  }
  return null;
}

/**
 * Status a create/update request may set: DRAFT / AWAITING_APPROVAL /
 * SCHEDULED, never an engine-owned status. Whether the caller may pick
 * SCHEDULED is an approval question, checked separately (post-approval.ts).
 */
function validateRequestedStatus(status: unknown): string | null {
  if (status === undefined || status === null || status === '') return null;
  if (typeof status !== 'string' || !CLIENT_SETTABLE_POST_STATUSES.has(status)) {
    return `status must be one of ${[...CLIENT_SETTABLE_POST_STATUSES].join(', ')}`;
  }
  return null;
}

const router = Router();
// 500MB covers any realistic social video/image upload while bounding worst-case
// disk/memory usage — multer's default fileSize limit is Infinity. Only image
// and video declarations get through; the bytes are checked after upload.
const upload = multer({
  dest: path.join(PATHS.UPLOADS_ROOT, 'social-temp'),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUploadDeclaration(file.originalname || '', file.mimetype || '')) cb(null, true);
    else cb(AppError.badRequest('Only JPG, PNG, GIF, WebP, MP4 and MOV files can be uploaded.'));
  },
});

// The AI caption helper spends the agency's own provider key — bound it per user.
const captionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? ''),
  message: { error: 'Too many caption requests — please try again later.' },
});
const MAX_CAPTION_PROMPT_CHARS = 4000;

// 1. Create a Post (Draft or Scheduled)
router.post('/posts', authenticate, async (req, res, next) => {
  try {
    const { clientId, caption, platformContent, mediaUrls, mediaType, accountIds, scheduledFor, campaignId, status } = req.body;

    if (!clientId || !accountIds || !Array.isArray(accountIds)) {
      res.status(400).json({ error: 'Missing required fields: clientId, accountIds' });
      return;
    }

    const safeCaption = caption ?? '';

    const statusError = validateRequestedStatus(status);
    const mediaError = validateMediaUrls(mediaUrls);
    if (statusError || mediaError) {
      res.status(400).json({ error: statusError || mediaError });
      return;
    }
    const approver = await isSocialApprover(req);
    const approvalError = requestedStatusError(status, approver);
    if (approvalError) {
      res.status(403).json({ error: approvalError });
      return;
    }
    const now = new Date();
    const userId = req.user?.userId ?? null;

    // One destination per account (a repeated id would publish twice).
    const uniqueAccountIds = [...new Set(accountIds as string[])];

    // Resolve accounts first, then create the post with the correct platform on
    // every destination in one write.
    const loaded = await loadPublishableAccounts(clientId as string, uniqueAccountIds);
    if ('error' in loaded) {
      res.status(400).json({ error: loaded.error });
      return;
    }
    const accountMap = loaded.accounts;

    const post = await prisma.socialPost.create({
      data: {
        clientId: clientId as string,
        caption: safeCaption,
        platformContent: platformContent || {},
        mediaUrls: mediaUrls || [],
        mediaType: mediaType || 'image',
        status: status || 'DRAFT',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        campaignId: campaignId as string | null,
        createdById: userId,
        // An approver scheduling their own post approves it by doing so.
        ...(status === 'SCHEDULED' ? { approvedAt: now, approvedById: userId } : {}),
        ...(status === 'AWAITING_APPROVAL' ? { submittedAt: now, submittedById: userId } : {}),
        destinations: {
          create: uniqueAccountIds.map(accountId => ({
            socialAccountId: accountId,
            platform: accountMap.get(accountId)!.platform,
            status: 'QUEUED',
          })),
        },
      },
      include: {
        destinations: true,
      },
    });

    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 2. List posts (paginated with filters)
router.get('/posts', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const { clientId, status, platform, campaignId } = req.query;

    const where: any = {};
    if (clientId) where.clientId = clientId as string;
    if (status) where.status = status as string;
    if (campaignId) where.campaignId = campaignId as string;
    if (platform) {
      where.destinations = {
        some: {
          platform: platform as string,
        },
      };
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          destinations: {
            include: {
              socialAccount: {
                select: { displayName: true, platformUsername: true, avatarUrl: true },
              },
            },
          },
        },
      }),
      prisma.socialPost.count({ where }),
    ]);

    res.json({ posts, total, page, limit });
    return;
  } catch (err) {
    next(err);
  }
});

// 3. Get single post detail
router.get('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: {
        destinations: {
          include: {
            socialAccount: SAFE_ACCOUNT,
          },
        },
        insights: true,
      },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 4. Update post (Draft or Scheduled)
router.put('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    // Express 5 leaves req.body undefined for a request with no body at all,
    // which would make this destructure throw before any validation runs.
    const { caption, platformContent, mediaUrls, mediaType, scheduledFor, campaignId, status, accountIds } =
      req.body ?? {};

    const currentPost = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: { destinations: true },
    });

    if (!currentPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const statusError = validateRequestedStatus(status);
    const mediaError = validateMediaUrls(mediaUrls, currentPost.mediaUrls);
    if (statusError || mediaError) {
      res.status(400).json({ error: statusError || mediaError });
      return;
    }
    // While a publish is in flight the engine owns the status; a PUT would
    // either be overwritten or strand the post.
    if (status && currentPost.status === 'PUBLISHING') {
      res.status(409).json({ error: 'This post is being published right now — try again in a moment.' });
      return;
    }
    const approver = await isSocialApprover(req);
    const approvalError = requestedStatusError(status, approver);
    if (approvalError) {
      res.status(403).json({ error: approvalError });
      return;
    }
    let accountsChanged = false;

    if (accountIds && Array.isArray(accountIds)) {
      // Reconcile destinations as a DIFF, never a wipe-and-rebuild.
      //
      // This used to deleteMany({ status: { not: 'PUBLISHED' } }) then recreate a
      // fresh QUEUED row for every selected account. Because most callers resend
      // the post's *existing* accountIds just to change one unrelated field (a
      // reschedule, a comment, a bulk status change), that rebuilt every
      // destination on every such edit and destroyed attempts / lastError /
      // lastAttemptAt / lockedAt / platformPostUrl. Two consequences were severe:
      // a FAILED destination came back QUEUED with attempts reset to 0, so the
      // scheduler re-published a post that had already exhausted its retry budget
      // (adding a comment could republish a post); and a destination the scheduler
      // was mid-publish on could be deleted underneath it.
      //
      // Diffing keeps untouched rows byte-identical, so resending the same
      // accountIds is now a genuine no-op.
      const { toRemove, toCreate: accountsToQueue } = diffDestinations(
        currentPost.destinations,
        accountIds as string[],
      );
      accountsChanged = toRemove.length > 0 || accountsToQueue.length > 0;

      // Validate newly added accounts before touching anything.
      let accountMap = new Map<string, { id: string; platform: string }>();
      if (accountsToQueue.length > 0) {
        const loaded = await loadPublishableAccounts(currentPost.clientId, accountsToQueue);
        if ('error' in loaded) {
          res.status(400).json({ error: loaded.error });
          return;
        }
        accountMap = loaded.accounts;
      }

      if (toRemove.length > 0) {
        // Conditional on status so a destination the scheduler claimed since we
        // read it is never deleted out from under an in-flight publish.
        await prisma.socialPostDestination.deleteMany({
          where: { id: { in: toRemove }, status: { notIn: ['PUBLISHED', 'PUBLISHING'] } },
        });
      }

      if (accountsToQueue.length > 0) {
        await prisma.socialPostDestination.createMany({
          data: accountsToQueue.map((accountId: string) => ({
            postId: id as string,
            socialAccountId: accountId,
            platform: accountMap.get(accountId)!.platform,
            status: 'QUEUED',
          })),
          // (postId, socialAccountId) is unique: a concurrent edit that already
          // added the same account is not an error.
          skipDuplicates: true,
        });
      }
    }

    // Approval bookkeeping. An approver setting SCHEDULED approves the post; a
    // contributor changing what would go out on an approved post sends it back
    // for review (see post-approval.ts).
    const now = new Date();
    const userId = req.user?.userId ?? null;
    let nextStatus: string | undefined = status || undefined;
    let approvalData: Record<string, unknown> = {};
    if (approver) {
      if (status === 'SCHEDULED' && (!currentPost.approvedAt || currentPost.status !== 'SCHEDULED')) {
        approvalData = { approvedAt: now, approvedById: userId, rejectedAt: null, rejectedById: null, rejectionReason: null };
      } else if (status === 'DRAFT' || status === 'AWAITING_APPROVAL') {
        approvalData = { approvedAt: null, approvedById: null };
      }
    } else {
      const contentChanged = changesPublishedContent(
        {
          caption: currentPost.caption,
          platformContent: currentPost.platformContent,
          mediaUrls: currentPost.mediaUrls,
          mediaType: currentPost.mediaType,
          scheduledFor: currentPost.scheduledFor,
        },
        { caption, platformContent, mediaUrls, mediaType, scheduledFor, accountsChanged },
      );
      const outcome = contributorUpdateOutcome(currentPost.status, status || undefined, contentChanged);
      nextStatus = outcome.status;
      if (outcome.clearApproval && currentPost.approvedAt) {
        approvalData = { approvedAt: null, approvedById: null };
      }
    }
    if (nextStatus === 'AWAITING_APPROVAL' && currentPost.status !== 'AWAITING_APPROVAL') {
      approvalData = { ...approvalData, submittedAt: now, submittedById: userId };
    }

    await prisma.socialPost.update({
      where: { id: id as string },
      data: {
        ...approvalData,
        caption: caption !== undefined ? (caption ?? '') : undefined,
        platformContent: platformContent !== undefined ? (platformContent || {}) : undefined,
        mediaUrls: mediaUrls !== undefined ? (mediaUrls || []) : undefined,
        mediaType: mediaType !== undefined ? (mediaType || 'image') : undefined,
        scheduledFor: scheduledFor !== undefined ? (scheduledFor ? new Date(scheduledFor) : null) : undefined,
        campaignId: campaignId !== undefined ? (campaignId as string | null) : undefined,
        // Omitting status must mean "leave it alone". This used to fall back to
        // `currentPost.status`, re-writing the value read a few awaits earlier —
        // so a PUT that raced the scheduler could revert a just-PUBLISHED post to
        // SCHEDULED, where nothing would ever pick it up again.
        status: nextStatus,
      },
    });

    const updatedPost = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: { destinations: true },
    });

    res.json(updatedPost);
    return;
  } catch (err) {
    next(err);
  }
});

// 5. Delete post
router.delete('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.socialPost.delete({
      where: { id: id as string },
    });
    res.json({ success: true, message: 'Post successfully deleted' });
    return;
  } catch (err) {
    next(err);
  }
});

// 6. Submit post for approval (anyone with write access)
router.post('/posts/:id/submit', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const current = await prisma.socialPost.findUnique({ where: { id: id as string }, select: { status: true } });
    if (!current) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    // Conditional on the status we checked, so a post the scheduler or an
    // approver moved on meanwhile is not dragged back into review.
    const { count } = await prisma.socialPost.updateMany({
      where: { id: id as string, status: { in: [...SUBMITTABLE_POST_STATUSES] } },
      data: {
        status: 'AWAITING_APPROVAL',
        submittedAt: new Date(),
        submittedById: req.user?.userId ?? null,
        approvedAt: null,
        approvedById: null,
      },
    });
    if (count === 0) {
      res.status(409).json({ error: `Only draft posts can be submitted for approval (this one is ${current.status.toLowerCase().replace(/_/g, ' ')}).` });
      return;
    }
    res.json(await prisma.socialPost.findUnique({ where: { id: id as string }, include: { destinations: true } }));
    return;
  } catch (err) {
    next(err);
  }
});

// 7. Approve post (approvers only). Moves it to SCHEDULED — the scheduler
// publishes it at scheduledFor, or on its next tick if that time has passed —
// or, with { publishNow: true }, publishes it straight away.
router.post('/posts/:id/approve', authenticate, async (req, res, next) => {
  try {
    if (!(await isSocialApprover(req))) {
      res.status(403).json({ error: APPROVER_ONLY_MESSAGE });
      return;
    }
    const { id } = req.params;
    const publishNow = req.body?.publishNow === true;
    const current = await prisma.socialPost.findUnique({ where: { id: id as string } });
    if (!current) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    if (!APPROVABLE_POST_STATUSES.has(current.status)) {
      res.status(409).json({ error: `This post is ${current.status.toLowerCase().replace(/_/g, ' ')} and cannot be approved.` });
      return;
    }
    // The scheduler only ever claims posts with a scheduledFor in the past — an
    // approved post with none would sit in SCHEDULED forever with no error.
    if (!current.scheduledFor && !publishNow) {
      res.status(400).json({ error: 'Cannot approve a post with no scheduled time. Set a schedule first, or approve and publish now.' });
      return;
    }
    const { count } = await prisma.socialPost.updateMany({
      where: { id: id as string, status: current.status },
      data: {
        status: 'SCHEDULED',
        approvedAt: new Date(),
        approvedById: req.user?.userId ?? null,
        rejectedAt: null,
        rejectedById: null,
        rejectionReason: null,
      },
    });
    if (count === 0) {
      res.status(409).json({ error: 'This post changed while you were reviewing it — reload and try again.' });
      return;
    }
    if (publishNow) {
      const finalPost = await publishPostNow(
        id as string,
        (dests) => dests.filter((dest: any) =>
          (MANUALLY_PUBLISHABLE_DESTINATION_STATUSES as readonly string[]).includes(dest.status)),
        MANUALLY_PUBLISHABLE_DESTINATION_STATUSES,
      );
      res.json(finalPost);
      return;
    }
    res.json(await prisma.socialPost.findUnique({ where: { id: id as string }, include: { destinations: true } }));
    return;
  } catch (err) {
    next(err);
  }
});

// 8. Reject post (approvers only): back to draft, with an optional reason.
router.post('/posts/:id/reject', authenticate, async (req, res, next) => {
  try {
    if (!(await isSocialApprover(req))) {
      res.status(403).json({ error: APPROVER_ONLY_MESSAGE });
      return;
    }
    const { id } = req.params;
    const parsed = parseRejectionReason(req.body?.reason);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const current = await prisma.socialPost.findUnique({ where: { id: id as string }, select: { status: true } });
    if (!current) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const { count } = await prisma.socialPost.updateMany({
      where: { id: id as string, status: { in: [...REJECTABLE_POST_STATUSES] } },
      data: {
        status: 'DRAFT',
        approvedAt: null,
        approvedById: null,
        rejectedAt: new Date(),
        rejectedById: req.user?.userId ?? null,
        rejectionReason: parsed.reason,
      },
    });
    if (count === 0) {
      res.status(409).json({ error: `This post is ${current.status.toLowerCase().replace(/_/g, ' ')} and cannot be rejected.` });
      return;
    }
    res.json(await prisma.socialPost.findUnique({ where: { id: id as string }, include: { destinations: true } }));
    return;
  } catch (err) {
    next(err);
  }
});

// 9/10. Publish immediately, or retry failed destinations.
//
// Both are one-shot (maxAttempts 1, skipped → FAILED): they always finish by
// writing a non-SCHEDULED aggregate, and the scheduler only claims destinations
// of SCHEDULED posts, so nothing may be left QUEUED by them.
async function publishPostNow(
  postId: string,
  pickDestinations: (dests: any[]) => any[],
  claimFrom: readonly string[],
): Promise<any | null> {
  const post = (await prisma.socialPost.findUnique({
    where: { id: postId },
    include: { destinations: { include: { socialAccount: true } } },
  })) as any;
  if (!post) return null;

  // What to put back while untargeted destinations are still QUEUED: the
  // status the post had (never an engine status), so they are neither
  // stranded in PUBLISHING nor published behind the user's back.
  const restoreStatus = CLIENT_SETTABLE_POST_STATUSES.has(post.status) ? post.status : 'DRAFT';

  await prisma.socialPost.update({ where: { id: postId }, data: { status: 'PUBLISHING' } });
  try {
    for (const dest of pickDestinations(post.destinations)) {
      try {
        // Claim atomically and only from a publishable state. This used to be
        // `status != 'PUBLISHING'`, which also matched PUBLISHED — so a
        // destination the scheduler had just published was published again.
        if (!(await claimDestination(dest.id as string, claimFrom))) continue;
        await publishDestination(dest, post, { maxAttempts: 1, skippedStatus: 'FAILED' });
      } catch (err: unknown) {
        logSocialError(`Manual publish of destination ${dest.id} failed`, err);
      }
    }
  } finally {
    // Always re-derive the post status, even if something above threw — a
    // post left in PUBLISHING is invisible to the scheduler and the UI.
    await finalizePostStatus(postId, restoreStatus);
  }

  return prisma.socialPost.findUnique({
    where: { id: postId },
    include: { destinations: { include: { socialAccount: SAFE_ACCOUNT } } },
  });
}

/** 403 message when the caller may not publish-now / retry this post, else null. */
async function manualPublishBlocked(req: Request, postId: string): Promise<string | null> {
  if (await isSocialApprover(req)) return null;
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, select: { status: true, approvedAt: true } });
  if (!post) return null; // publishPostNow answers 404
  return manualPublishError(post, false);
}

router.post('/posts/:id/publish-now', authenticate, async (req, res, next) => {
  try {
    const blocked = await manualPublishBlocked(req, req.params.id as string);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
    if (await isSocialApprover(req)) {
      // An approver publishing directly approves what they publish.
      await prisma.socialPost.updateMany({
        where: { id: req.params.id as string, approvedAt: null },
        data: { approvedAt: new Date(), approvedById: req.user?.userId ?? null },
      });
    }
    const { accountIds: targetAccountIds } = req.body || {};
    const targetSet =
      Array.isArray(targetAccountIds) && targetAccountIds.length > 0
        ? new Set(targetAccountIds as string[])
        : null;

    const finalPost = await publishPostNow(
      req.params.id as string,
      // Never re-publish destinations that already succeeded — only QUEUED/FAILED
      // (optionally narrowed to the accounts the caller targeted).
      (dests) => dests.filter((dest: any) =>
        (MANUALLY_PUBLISHABLE_DESTINATION_STATUSES as readonly string[]).includes(dest.status) &&
        (!targetSet || targetSet.has(dest.socialAccountId))),
      MANUALLY_PUBLISHABLE_DESTINATION_STATUSES,
    );
    if (!finalPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(finalPost);
    return;
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/retry', authenticate, async (req, res, next) => {
  try {
    const blocked = await manualPublishBlocked(req, req.params.id as string);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
    const finalPost = await publishPostNow(
      req.params.id as string,
      (dests) => dests.filter((dest: any) => dest.status === 'FAILED'),
      ['FAILED'],
    );
    if (!finalPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(finalPost);
    return;
  } catch (err) {
    next(err);
  }
});

// ── 11. Grouping content published outside the system ───────────────────────
//
// TikTok has no publish approval on these accounts, so a video that goes out to
// Instagram and Facebook through the composer is posted to TikTok by hand and
// only arrives here later, in a Studio export. Nothing in the two records ties
// them together, so these three endpoints let the user say "this export row is
// that post" and have the dashboard treat them as the single post they are.

// 11a. Export rows this post could be — best guess first.
router.get('/posts/:id/link-candidates', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 40, 100);
    res.json(await findLinkCandidates(req.params.id as string, limit));
    return;
  } catch (err) {
    if (err instanceof PostLinkError) { res.status(err.status).json({ error: err.message }); return; }
    next(err);
  }
});

// 11b. Attach one export row to this post as a real destination.
router.post('/posts/:id/linked-imports', authenticate, async (req, res, next) => {
  try {
    const importedPostId = (req.body || {}).importedPostId;
    if (!importedPostId || typeof importedPostId !== 'string') {
      res.status(400).json({ error: 'importedPostId is required' });
      return;
    }

    const { destination, platform } = await linkImportedPostToGroup(req.params.id as string, importedPostId);

    // Answer with the post in the same shape the detail views already consume,
    // so the client can drop it straight into state without a second round trip.
    const post = await prisma.socialPost.findUnique({
      where: { id: req.params.id as string },
      include: { destinations: { include: { socialAccount: SAFE_ACCOUNT } }, insights: true },
    });
    res.status(201).json({ linked: true, platform, destinationId: destination.id, post });
    return;
  } catch (err) {
    if (err instanceof PostLinkError) { res.status(err.status).json({ error: err.message }); return; }
    next(err);
  }
});

// 11c. Detach a hand-linked destination; the export row stands alone again.
router.delete('/posts/:id/linked-imports/:destinationId', authenticate, async (req, res, next) => {
  try {
    const result = await unlinkImportedPost(req.params.id as string, req.params.destinationId as string);
    res.json({ unlinked: true, ...result });
    return;
  } catch (err) {
    if (err instanceof PostLinkError) { res.status(err.status).json({ error: err.message }); return; }
    next(err);
  }
});

// 12. Media Upload
router.post('/media/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Type the file by its bytes; the stored extension/Content-Type come from
    // this, so nothing uploaded here can be served back as HTML/SVG/JS.
    const detected = await sniffUploadedMedia(file);
    if (!detected) {
      res.status(400).json({ error: 'File content is not a supported image or video (JPG, PNG, GIF, WebP, MP4, MOV).' });
      return;
    }

    const publicUrl = await uploadSocialMediaFile(file, detected);
    res.json({ url: publicUrl });
    return;
  } catch (err) {
    next(err);
  }
});

// 12. AI generate caption (Gemini/configured model)
router.post('/ai/caption', authenticate, captionLimiter, async (req, res, next) => {
  try {
    const { prompt, platform } = req.body ?? {};
    if (!prompt || !platform || typeof prompt !== 'string' || typeof platform !== 'string') {
      res.status(400).json({ error: 'Missing prompt or platform' });
      return;
    }
    if (prompt.length > MAX_CAPTION_PROMPT_CHARS || platform.length > 32) {
      res.status(400).json({ error: `Prompt is too long (max ${MAX_CAPTION_PROMPT_CHARS} characters)` });
      return;
    }

    const settings = await prisma.agencySettings.findFirst();
    if (!settings) {
      res.status(400).json({ error: 'Agency settings not configured' });
      return;
    }

    const { provider, apiKey } = resolveProviderKey(settings);
    if (!apiKey) {
      res.status(400).json({ error: `API key for provider ${provider} is not configured` });
      return;
    }

    const messages = [
      {
        role: 'system' as const,
        content: `You are an expert social media copywriter. Write a highly engaging caption for ${platform}. Optimize the tone, formatting, and hashtag usage specifically for ${platform}. Stay strictly within ${platform}'s character limit. Do not include quotes around the output.`,
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const aiRes = await callAI(provider, apiKey, messages);
    res.json({ caption: aiRes.content });
    return;
  } catch (err) {
    next(err);
  }
});

// 13. Campaigns CRUD
router.get('/campaigns', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    const where = clientId ? { clientId } : {};
    const campaigns = await prisma.socialCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
    return;
  } catch (err) {
    next(err);
  }
});

router.post('/campaigns', authenticate, async (req, res, next) => {
  try {
    const { clientId, name } = req.body;
    if (!clientId || !name) {
      res.status(400).json({ error: 'Missing clientId or name' });
      return;
    }
    const campaign = await prisma.socialCampaign.create({
      data: { clientId: clientId as string, name },
    });
    res.json(campaign);
    return;
  } catch (err) {
    next(err);
  }
});

export default router;
