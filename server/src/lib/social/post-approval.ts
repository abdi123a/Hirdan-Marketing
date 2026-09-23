// Approval rules for social posts.
//
// Kept free of Prisma/Express so the rules can be unit-tested, same split as
// post-status.ts. The routes resolve the caller's permissions and feed them in.
//
// Who may do what:
//   - Approvers — ADMIN, or MANAGE on the social_media module — schedule and
//     publish directly, and approve / reject posts others submitted.
//   - Contributors — WRITE on social_media — create and edit drafts and submit
//     them for approval. They can never put a post into SCHEDULED, and may only
//     publish-now / retry a post an approver has already approved.
//
// A post counts as approved while it carries `approvedAt`. Anything that
// changes what would go out (caption, media, per-platform text, accounts,
// time) done by a contributor clears that and sends the post back for review.

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT' | string;
type Level = 'NONE' | 'READ' | 'WRITE' | 'MANAGE';

export function canApproveSocialPosts(role: Role | undefined, socialLevel: Level | undefined): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'CLIENT') return false;
  return socialLevel === 'MANAGE';
}

/** Statuses from which a post may be submitted for approval. */
export const SUBMITTABLE_POST_STATUSES: ReadonlySet<string> = new Set(['DRAFT', 'AWAITING_APPROVAL']);
/** Statuses an approver may approve from. */
export const APPROVABLE_POST_STATUSES: ReadonlySet<string> = new Set(['AWAITING_APPROVAL', 'DRAFT']);
/** Statuses an approver may reject from (a scheduled post can still be pulled back). */
export const REJECTABLE_POST_STATUSES: ReadonlySet<string> = new Set(['AWAITING_APPROVAL', 'SCHEDULED']);

export const MAX_REJECTION_REASON_CHARS = 1000;

export const APPROVAL_REQUIRED_MESSAGE =
  'Scheduling or publishing needs approval. Submit the post for approval and an approver will schedule it.';
export const APPROVER_ONLY_MESSAGE = 'Only approvers (Manage access to Social Media) can approve or reject posts.';

/**
 * Status a create/update request asks for, checked against the caller's role.
 * Returns an error message for a 403, or null when allowed.
 */
export function requestedStatusError(status: unknown, isApprover: boolean): string | null {
  if (isApprover) return null;
  if (status === 'SCHEDULED') return APPROVAL_REQUIRED_MESSAGE;
  return null;
}

/** Whether a publish-now / retry by this caller may go ahead on this post. */
export function manualPublishError(
  post: { status: string; approvedAt: Date | string | null },
  isApprover: boolean,
): string | null {
  if (isApprover) return null;
  if (!post.approvedAt || post.status === 'DRAFT' || post.status === 'AWAITING_APPROVAL') {
    return 'This post has not been approved yet — submit it for approval before publishing.';
  }
  return null;
}

/** Key-order-independent JSON (MySQL re-orders JSON object keys on storage). */
export function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
    .join(',')}}`;
}

/**
 * platformContent keys that are workflow notes, not publish input: the
 * composer keeps comments, the activity log, the assigned writer and tags in
 * the same JSON. Changing them must not send an approved post back to review.
 */
const NON_PUBLISHED_CONTENT_KEYS = new Set(['comments', 'activities', 'assignedWriter', 'tags']);

function publishedPart(platformContent: unknown): unknown {
  if (!platformContent || typeof platformContent !== 'object' || Array.isArray(platformContent)) {
    return platformContent ?? {};
  }
  return Object.fromEntries(
    Object.entries(platformContent as Record<string, unknown>).filter(([k]) => !NON_PUBLISHED_CONTENT_KEYS.has(k)),
  );
}

export interface PostContentSnapshot {
  caption: string;
  platformContent: unknown;
  mediaUrls: unknown;
  mediaType: string | null;
  scheduledFor: Date | null;
}

export interface PostContentPatch {
  caption?: unknown;
  platformContent?: unknown;
  mediaUrls?: unknown;
  mediaType?: unknown;
  scheduledFor?: unknown;
  /** Destinations the update adds or removes. */
  accountsChanged?: boolean;
}

/**
 * Whether an update changes what the post would publish. Fields left undefined
 * are not being changed; resending the current value is not a change.
 */
export function changesPublishedContent(current: PostContentSnapshot, patch: PostContentPatch): boolean {
  if (patch.accountsChanged) return true;
  if (patch.caption !== undefined && (patch.caption ?? '') !== current.caption) return true;
  if (
    patch.platformContent !== undefined &&
    stableJson(publishedPart(patch.platformContent || {})) !== stableJson(publishedPart(current.platformContent))
  ) {
    return true;
  }
  if (patch.mediaUrls !== undefined && stableJson(patch.mediaUrls || []) !== stableJson(current.mediaUrls ?? [])) return true;
  if (patch.mediaType !== undefined && (patch.mediaType || 'image') !== (current.mediaType || 'image')) return true;
  if (patch.scheduledFor !== undefined) {
    const next = patch.scheduledFor ? new Date(patch.scheduledFor as string).getTime() : null;
    const prev = current.scheduledFor ? current.scheduledFor.getTime() : null;
    if (next !== prev) return true;
  }
  return false;
}

/**
 * Approval bookkeeping for a contributor's (non-approver's) update of a post.
 * Returns the status to write (undefined = leave alone) and whether the
 * existing approval must be cleared.
 */
export function contributorUpdateOutcome(
  currentStatus: string,
  requestedStatus: string | undefined,
  contentChanged: boolean,
): { status: string | undefined; clearApproval: boolean } {
  if (requestedStatus === 'DRAFT' || requestedStatus === 'AWAITING_APPROVAL') {
    return { status: requestedStatus, clearApproval: true };
  }
  if (contentChanged && currentStatus === 'SCHEDULED') {
    // The approved version is no longer what would go out.
    return { status: 'AWAITING_APPROVAL', clearApproval: true };
  }
  return { status: requestedStatus, clearApproval: contentChanged };
}

/** Normalised optional rejection reason, or an error message. */
export function parseRejectionReason(reason: unknown): { reason: string | null } | { error: string } {
  if (reason === undefined || reason === null) return { reason: null };
  if (typeof reason !== 'string') return { error: 'reason must be text' };
  const trimmed = reason.trim();
  if (trimmed.length > MAX_REJECTION_REASON_CHARS) {
    return { error: `reason must be at most ${MAX_REJECTION_REASON_CHARS} characters` };
  }
  return { reason: trimmed || null };
}
