import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);

// ─── GET /api/notifications ──────────────────────────────────────
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { category, unreadOnly } = req.query;
    const where: any = {};
    if (category) where.category = category as string;
    if (unreadOnly === 'true') where.read = false;

    if (req.user!.role === 'CLIENT') {
      where.userId = req.user!.userId;
    } else {
      where.OR = [
        { userId: null },
        { userId: req.user!.userId }
      ];
    }

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
    const isClient = req.user!.role === 'CLIENT';
    const userFilter = isClient
      ? { userId: req.user!.userId }
      : { OR: [{ userId: null }, { userId: req.user!.userId }] };

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
    const notif = await prisma.notification.findUnique({
      where: { id: req.params.id as string }
    });
    if (!notif) throw AppError.notFound('Notification not found');

    if (req.user!.role === 'CLIENT' && notif.userId !== req.user!.userId) {
      throw AppError.forbidden('You do not have permission to modify this notification');
    }

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
    const isClient = req.user!.role === 'CLIENT';
    
    const userFilter = isClient
      ? { userId: req.user!.userId }
      : { OR: [{ userId: null }, { userId: req.user!.userId }] };

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
    const isClient = req.user!.role === 'CLIENT';
    const userFilter = isClient
      ? { userId: req.user!.userId }
      : { OR: [{ userId: null }, { userId: req.user!.userId }] };

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
