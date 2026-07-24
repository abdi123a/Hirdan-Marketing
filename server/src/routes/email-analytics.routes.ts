import { Router, type Request, type Response } from 'express';
import type { EmailStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess, accessibleMailboxIds } from '../lib/mail/access.js';

const router = Router();
router.use(authenticate, requireStaff);

/** Resolve the mailbox scope for a request (specific mailbox or all accessible). */
async function resolveScope(req: Request): Promise<{ ids: 'ALL' | string[]; emailWhere: Prisma.EmailWhereInput; convWhere: Prisma.ConversationWhereInput }> {
  const mailboxId = req.query.mailboxId as string | undefined;
  if (mailboxId) {
    await assertMailboxAccess(req.user!, mailboxId, 'READ');
    return { ids: [mailboxId], emailWhere: { mailboxId }, convWhere: { mailboxId } };
  }
  const ids = await accessibleMailboxIds(req.user!);
  if (ids === 'ALL') return { ids: 'ALL', emailWhere: {}, convWhere: {} };
  return { ids, emailWhere: { mailboxId: { in: ids } }, convWhere: { mailboxId: { in: ids } } };
}

function ratesFromStatus(counts: Record<string, number>) {
  const c = (s: EmailStatus) => counts[s] ?? 0;
  const clicked = c('CLICKED');
  const opened = c('OPENED') + clicked;
  const delivered = c('DELIVERED') + opened;
  const bounced = c('BOUNCED');
  const failed = c('FAILED');
  const sent = delivered + bounced + c('COMPLAINED') + failed + c('SENT') + c('DELIVERY_DELAYED');
  const rate = (n: number) => (sent > 0 ? Math.round((n / sent) * 1000) / 10 : 0);
  return {
    sent, delivered, opened, clicked, bounced, failed,
    deliveryRate: rate(delivered), openRate: rate(opened), clickRate: rate(clicked),
    bounceRate: rate(bounced), failureRate: rate(failed),
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── GET /api/email/analytics/overview ───────────────────────────
router.get('/analytics/overview', async (req: Request, res: Response, next) => {
  try {
    const { emailWhere, convWhere } = await resolveScope(req);
    const today = startOfToday();

    const [inbox, unread, todayReceived, todaySent, replies, grouped, respConvos] = await Promise.all([
      prisma.conversation.count({ where: { ...convWhere, deletedAt: null, isSpam: false, isArchived: false } }),
      prisma.conversation.count({ where: { ...convWhere, deletedAt: null, unreadCount: { gt: 0 } } }),
      prisma.email.count({ where: { ...emailWhere, direction: 'INBOUND', createdAt: { gte: today } } }),
      prisma.email.count({ where: { ...emailWhere, direction: 'OUTBOUND', sentAt: { gte: today } } }),
      prisma.emailEvent.count({ where: { type: 'REPLIED', email: emailWhere } }),
      prisma.email.groupBy({ by: ['status'], where: { ...emailWhere, direction: 'OUTBOUND' }, _count: { _all: true } }),
      prisma.conversation.findMany({
        where: { ...convWhere, lastInboundAt: { not: null }, lastOutboundAt: { not: null } },
        select: { lastInboundAt: true, lastOutboundAt: true },
        orderBy: { lastMessageAt: 'desc' },
        take: 300,
      }),
    ]);

    const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    const rates = ratesFromStatus(counts);

    // Approx avg response time: (lastOutbound - lastInbound) where we replied after them.
    const diffs = respConvos
      .filter((c) => c.lastOutboundAt && c.lastInboundAt && c.lastOutboundAt > c.lastInboundAt)
      .map((c) => c.lastOutboundAt!.getTime() - c.lastInboundAt!.getTime());
    const avgResponseMs = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;

    res.json({
      cards: {
        inbox,
        unread,
        todayReceived,
        todaySent,
        replies,
        openRate: rates.openRate,
        clickRate: rates.clickRate,
        bounceRate: rates.bounceRate,
        deliveryRate: rates.deliveryRate,
        avgResponseMinutes: Math.round(avgResponseMs / 60000),
      },
      rates,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/analytics/volume?days=30 ─────────────────────
router.get('/analytics/volume', async (req: Request, res: Response, next) => {
  try {
    const { emailWhere } = await resolveScope(req);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const emails = await prisma.email.findMany({
      where: { ...emailWhere, createdAt: { gte: since } },
      select: { direction: true, createdAt: true },
    });

    // Bucket by day.
    const buckets = new Map<string, { sent: number; received: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), { sent: 0, received: 0 });
    }
    for (const e of emails) {
      const key = e.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      if (e.direction === 'OUTBOUND') b.sent += 1;
      else b.received += 1;
    }

    res.json({ series: [...buckets.entries()].map(([date, v]) => ({ date, ...v })) });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/analytics/by-mailbox ─────────────────────────
router.get('/analytics/by-mailbox', async (req: Request, res: Response, next) => {
  try {
    const ids = await accessibleMailboxIds(req.user!);
    const mailboxes = await prisma.mailbox.findMany({
      where: ids === 'ALL' ? {} : { id: { in: ids } },
      select: { id: true, displayName: true, color: true, department: true },
      orderBy: { displayName: 'asc' },
    });

    const rows = await Promise.all(
      mailboxes.map(async (m) => {
        const [sent, received, unread, grouped] = await Promise.all([
          prisma.email.count({ where: { mailboxId: m.id, direction: 'OUTBOUND' } }),
          prisma.email.count({ where: { mailboxId: m.id, direction: 'INBOUND' } }),
          prisma.conversation.count({ where: { mailboxId: m.id, deletedAt: null, unreadCount: { gt: 0 } } }),
          prisma.email.groupBy({ by: ['status'], where: { mailboxId: m.id, direction: 'OUTBOUND' }, _count: { _all: true } }),
        ]);
        const rates = ratesFromStatus(Object.fromEntries(grouped.map((g) => [g.status, g._count._all])));
        return {
          id: m.id, displayName: m.displayName, color: m.color, department: m.department,
          sent, received, unread, openRate: rates.openRate, deliveryRate: rates.deliveryRate,
        };
      })
    );

    res.json({ mailboxes: rows });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/analytics/by-agent — who's sending ───────────
router.get('/analytics/by-agent', async (req: Request, res: Response, next) => {
  try {
    const { emailWhere } = await resolveScope(req);
    const base: Prisma.EmailWhereInput = { ...emailWhere, direction: 'OUTBOUND' };

    const [sentGroups, openGroups] = await Promise.all([
      prisma.email.groupBy({ by: ['sentById'], where: base, _count: { _all: true } }),
      prisma.email.groupBy({ by: ['sentById'], where: { ...base, status: { in: ['OPENED', 'CLICKED'] } }, _count: { _all: true } }),
    ]);

    const ids = sentGroups.map((g) => g.sentById).filter((v): v is string => !!v);
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const openedById = new Map(openGroups.map((g) => [g.sentById ?? 'automated', g._count._all]));

    const agents = sentGroups
      .map((g) => {
        const key = g.sentById ?? 'automated';
        const sent = g._count._all;
        const opened = openedById.get(key) ?? 0;
        return {
          userId: g.sentById,
          name: g.sentById ? nameById.get(g.sentById) ?? 'Unknown' : 'Automated / System',
          automated: !g.sentById,
          sent,
          opened,
          openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.sent - a.sent);

    res.json({ agents });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/analytics/by-department ──────────────────────
router.get('/analytics/by-department', async (req: Request, res: Response, next) => {
  try {
    const ids = await accessibleMailboxIds(req.user!);
    const mailboxes = await prisma.mailbox.findMany({
      where: ids === 'ALL' ? {} : { id: { in: ids } },
      select: { id: true, department: true },
    });
    const deptByMailbox = new Map(mailboxes.map((m) => [m.id, m.department || 'Unassigned']));

    const grouped = await prisma.email.groupBy({
      by: ['mailboxId', 'direction'],
      where: { mailboxId: { in: mailboxes.map((m) => m.id) } },
      _count: { _all: true },
    });

    const depts = new Map<string, { department: string; sent: number; received: number }>();
    for (const g of grouped) {
      const dept = deptByMailbox.get(g.mailboxId) || 'Unassigned';
      const row = depts.get(dept) ?? { department: dept, sent: 0, received: 0 };
      if (g.direction === 'OUTBOUND') row.sent += g._count._all;
      else row.received += g._count._all;
      depts.set(dept, row);
    }

    res.json({ departments: [...depts.values()].sort((a, b) => b.sent + b.received - (a.sent + a.received)) });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/analytics/activity — recent sent, by whom ────
router.get('/analytics/activity', async (req: Request, res: Response, next) => {
  try {
    const { emailWhere } = await resolveScope(req);
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const emails = await prisma.email.findMany({
      where: { ...emailWhere, direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, conversationId: true, subject: true, toEmails: true, status: true,
        sentAt: true, createdAt: true, sentById: true,
        mailbox: { select: { displayName: true, color: true } },
        sentBy: { select: { id: true, name: true } },
      },
    });
    res.json({
      activity: emails.map((e) => ({
        id: e.id,
        conversationId: e.conversationId,
        subject: e.subject,
        to: (e.toEmails as string[] | null)?.[0] ?? '',
        status: e.status,
        at: e.sentAt || e.createdAt,
        mailbox: e.mailbox,
        agent: e.sentBy?.name ?? 'Automated / System',
        automated: !e.sentById,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/analytics/top-senders?limit=10 ───────────────
router.get('/analytics/top-senders', async (req: Request, res: Response, next) => {
  try {
    const { emailWhere } = await resolveScope(req);
    const limit = Math.min(Number(req.query.limit) || 10, 25);
    const grouped = await prisma.email.groupBy({
      by: ['fromEmail'],
      where: { ...emailWhere, direction: 'INBOUND' },
      _count: { _all: true },
      orderBy: { _count: { fromEmail: 'desc' } },
      take: limit,
    });
    res.json({ senders: grouped.map((g) => ({ email: g.fromEmail, count: g._count._all })) });
  } catch (error) {
    next(error);
  }
});

export default router;
