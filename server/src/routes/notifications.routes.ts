import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { resolvePermissions, type ModuleKey, type PermissionMap } from '../lib/permissions.js';

const router = Router();
router.use(authenticate);

/** Which permission module a broadcast notification's entity belongs to. */
const ENTITY_MODULE: Record<string, ModuleKey> = {
  INVOICE: 'invoices',
  PROFORMA: 'proforma',
  SUBSCRIPTION: 'subscriptions',
  CLIENT: 'clients',
  PROJECT: 'projects',
  EMPLOYEE: 'team',
  LEAD: 'leads',
  REPORT: 'monthly_reports',
};

/**
 * Notifications the current user may see: their own, plus (staff only)
 * broadcasts whose module they can read.
 */
async function visibleNotificationsFilter(req: Request): Promise<Record<string, unknown>> {
  const me = req.user!;
  if (me.role === 'CLIENT') return { userId: me.userId };

  const account = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { permissions: true },
  });
  const perms = resolvePermissions(me.role, (account?.permissions as PermissionMap | null) ?? null);
  const hiddenEntityTypes = Object.entries(ENTITY_MODULE)
    .filter(([, mod]) => perms[mod] === 'NONE')
    .map(([entityType]) => entityType);

  const broadcastConditions: Record<string, unknown>[] = [];
  if (hiddenEntityTypes.length > 0) {
    broadcastConditions.push({
      OR: [{ entityType: null }, { entityType: { notIn: hiddenEntityTypes } }],
    });
  }
  if (perms.hr === 'NONE') {
    broadcastConditions.push({ NOT: { type: { startsWith: 'HR_' } } });
  }

  return {
    OR: [
      { userId: me.userId },
      { userId: null, ...(broadcastConditions.length ? { AND: broadcastConditions } : {}) },
    ],
  };
}

// ─── GET /api/notifications ──────────────────────────────────────
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { category, unreadOnly } = req.query;
    const where: any = {};
    if (category) where.category = category as string;
    if (unreadOnly === 'true') where.read = false;

    Object.assign(where, await visibleNotificationsFilter(req));

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/notifications/counts ───────────────────────────────
router.get('/counts', async (req: Request, res: Response, next) => {
  try {
    const userFilter = await visibleNotificationsFilter(req);

    const [total, unread, actionRequired, information, success, warning] = await Promise.all([
      prisma.notification.count({ where: userFilter }),
      prisma.notification.count({ where: { ...userFilter, read: false } }),
      prisma.notification.count({ where: { ...userFilter, category: 'ACTION_REQUIRED', read: false } }),
      prisma.notification.count({ where: { ...userFilter, category: 'INFORMATION', read: false } }),
      prisma.notification.count({ where: { ...userFilter, category: 'SUCCESS', read: false } }),
      prisma.notification.count({ where: { ...userFilter, category: 'WARNING', read: false } }),
    ]);

    res.json({
      total,
      unread,
      byCategory: {
        ACTION_REQUIRED: actionRequired,
        INFORMATION: information,
        SUCCESS: success,
        WARNING: warning,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/notifications ─────────────────────────────────────
router.post('/', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { title, message, type, category, entityType, entityId, actionUrl, userId } = req.body;
    if (!title || !message) {
      throw AppError.badRequest('Title and message are required');
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || 'SYSTEM',
        category: category || 'INFORMATION',
        entityType,
        entityId,
        actionUrl,
        userId,
      },
    });

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/notifications/:id/read ─────────────────────────────
router.put('/:id/read', async (req: Request, res: Response, next) => {
  try {
    // Only the recipient (or, for broadcasts, a staff member allowed to see it) may mark it read.
    const notif = await prisma.notification.findFirst({
      where: { id: req.params.id as string, ...(await visibleNotificationsFilter(req)) },
      select: { id: true },
    });
    if (!notif) throw AppError.notFound('Notification not found');

    const notification = await prisma.notification.update({
      where: { id: req.params.id as string },
      data: { read: true },
    });

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/notifications/mark-all-read ────────────────────────
router.post('/mark-all-read', async (req: Request, res: Response, next) => {
  try {
    const { category } = req.body;
    const userFilter = await visibleNotificationsFilter(req);

    const where: any = {
      ...userFilter,
      read: false,
      ...(category ? { category } : {}),
    };

    await prisma.notification.updateMany({ where, data: { read: true } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/notifications/clear-all ───────────────────────────
// Kept for backward compat
router.post('/clear-all', async (req: Request, res: Response, next) => {
  try {
    const userFilter = await visibleNotificationsFilter(req);

    await prisma.notification.updateMany({
      where: { ...userFilter, read: false },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
