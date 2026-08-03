import fs from 'fs';
import { Router, type Request, type Response } from 'express';
import type { EmailStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess, accessibleMailboxIds } from '../lib/mail/access.js';
import { ensureAttachmentFile, isInlinePreviewable } from '../lib/mail/attachment-resolver.js';

import { publishMailEvent } from '../lib/mail/sse.js';

const router = Router();

// 1x1 transparent GIF buffer
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// ─── GET /api/email/track/open/:id.png — Unauthenticated Open Pixel ──
router.get('/track/open/:id.png', async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id as string;
    if (emailId) {
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        select: { id: true, status: true, mailboxId: true, conversationId: true },
      });

      if (email) {
        // Debounce rapid prefetch/reloads (same open within 45s) but still
        // record genuine re-opens so the timeline reflects real engagement.
        const recentOpen = await prisma.emailEvent.findFirst({
          where: {
            emailId: email.id,
            type: 'OPENED',
            occurredAt: { gte: new Date(Date.now() - 45_000) },
          },
          orderBy: { occurredAt: 'desc' },
        });

        if (!recentOpen) {
          await prisma.emailEvent.create({
            data: {
              emailId: email.id,
              type: 'OPENED',
              payload: {
                source: 'pixel',
                userAgent: req.get('user-agent') || undefined,
                ip: req.ip || undefined,
              },
              occurredAt: new Date(),
            },
          });

          const statusRank: Record<EmailStatus, number> = {
            DRAFT: 0,
            QUEUED: 1,
            SCHEDULED: 1,
            SENT: 2,
            DELIVERY_DELAYED: 2,
            DELIVERED: 3,
            OPENED: 4,
            CLICKED: 5,
            RECEIVED: 5,
            BOUNCED: 100,
            COMPLAINED: 100,
            FAILED: 100,
            CANCELED: 100,
          };

          const currentRank = statusRank[email.status] ?? 0;
          const openRank = statusRank.OPENED;
          const newStatus = openRank > currentRank ? 'OPENED' : email.status;

          if (newStatus !== email.status) {
            await prisma.email.update({
              where: { id: email.id },
              data: { status: newStatus },
            });
          }

          publishMailEvent({
            type: 'event-update',
            mailboxId: email.mailboxId,
            conversationId: email.conversationId,
            emailId: email.id,
            status: newStatus,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Tracking Pixel Error]', err);
  } finally {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(TRANSPARENT_GIF_BUFFER);
  }
});

router.use(authenticate, requireStaff);

// ─── GET /api/email/attachments/:id — authenticated download/preview ─
// `?inline=1` serves images/PDFs inline for preview; inbound attachments are
// fetched from Resend and cached on first access.
router.get('/attachments/:id', async (req: Request, res: Response, next) => {
  try {
    const att = await prisma.attachment.findUnique({
      where: { id: req.params.id as string },
      include: { email: { select: { mailboxId: true } } },
    });
    if (!att || !att.email) throw AppError.notFound('Attachment not found');
    await assertMailboxAccess(req.user!, att.email.mailboxId, 'READ');

    const abs = await ensureAttachmentFile(att);
    if (!fs.existsSync(abs)) throw AppError.notFound('File no longer available');

    const inline = req.query.inline === '1' && isInlinePreviewable(att.mimeType || '');
    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.filename)}"`
    );
    fs.createReadStream(abs).pipe(res);
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/emails/:id — one email + timeline + attachments ─
router.get('/emails/:id', async (req: Request, res: Response, next) => {
  try {
    const email = await prisma.email.findUnique({
      where: { id: req.params.id as string },
      include: {
        events: { orderBy: { occurredAt: 'asc' } },
        attachments: true,
        conversation: { select: { id: true, subject: true } },
        mailbox: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!email) throw AppError.notFound('Email not found');
    await assertMailboxAccess(req.user!, email.mailboxId, 'READ');
    res.json({ email });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/emails/:id/events — timeline only ────────────
router.get('/emails/:id/events', async (req: Request, res: Response, next) => {
  try {
    const email = await prisma.email.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, mailboxId: true, status: true },
    });
    if (!email) throw AppError.notFound('Email not found');
    await assertMailboxAccess(req.user!, email.mailboxId, 'READ');
    const events = await prisma.emailEvent.findMany({
      where: { emailId: email.id },
      orderBy: { occurredAt: 'asc' },
    });
    res.json({ status: email.status, events });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/tracking/summary — delivery/open/click rates ──
// Lightweight rollup for the tracking dashboard (full analytics land in P3).
router.get('/tracking/summary', async (req: Request, res: Response, next) => {
  try {
    const mailboxId = req.query.mailboxId as string | undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    let mailboxScope: Prisma.EmailWhereInput = {};
    if (mailboxId) {
      await assertMailboxAccess(req.user!, mailboxId, 'READ');
      mailboxScope = { mailboxId };
    } else {
      const ids = await accessibleMailboxIds(req.user!);
      mailboxScope = ids === 'ALL' ? {} : { mailboxId: { in: ids } };
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (from && !isNaN(from.getTime())) createdAt.gte = from;
    if (to && !isNaN(to.getTime())) createdAt.lte = to;

    const outboundWhere: Prisma.EmailWhereInput = {
      ...mailboxScope,
      direction: 'OUTBOUND',
      ...(from || to ? { createdAt } : {}),
    };

    const grouped = await prisma.email.groupBy({
      by: ['status'],
      where: outboundWhere,
      _count: { _all: true },
    });

    const counts = Object.fromEntries(
      grouped.map((g) => [g.status, g._count._all])
    ) as Record<EmailStatus, number>;
    const c = (s: EmailStatus) => counts[s] ?? 0;

    // Furthest-status roll-up.
    const clicked = c('CLICKED');
    const opened = c('OPENED') + clicked;
    const delivered = c('DELIVERED') + opened;
    const bounced = c('BOUNCED');
    const complained = c('COMPLAINED');
    const failed = c('FAILED');
    const scheduled = c('SCHEDULED');
    const queued = c('QUEUED');
    const sentTotal = delivered + bounced + complained + failed + c('SENT') + c('DELIVERY_DELAYED');

    const repliedEvents = await prisma.emailEvent.count({
      where: {
        type: 'REPLIED',
        email: outboundWhere,
      },
    });

    const rate = (n: number) => (sentTotal > 0 ? Math.round((n / sentTotal) * 1000) / 10 : 0);

    res.json({
      totals: {
        sent: sentTotal,
        delivered,
        opened,
        clicked,
        replied: repliedEvents,
        bounced,
        complained,
        failed,
        scheduled,
        queued,
      },
      rates: {
        deliveryRate: rate(delivered),
        openRate: rate(opened),
        clickRate: rate(clicked),
        replyRate: rate(repliedEvents),
        bounceRate: rate(bounced),
        failureRate: rate(failed),
      },
      byStatus: counts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
