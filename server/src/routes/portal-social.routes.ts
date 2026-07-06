import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('CLIENT'));

// ─── Helper: Get client ID from JWT ───────────────────────────────

async function getClientId(req: Request): Promise<string> {
  // clientId is embedded in the JWT for client users
  if (req.user?.clientId) return req.user.clientId;

  // Fallback: look up client by userId
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!client) throw AppError.forbidden('Client profile not found');
  return client.id;
}
// ─── GET /api/portal/social ───────────────────────────────────────
// Aggregated data for the client portal: profiles, docs, and tasks

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const clientId = await getClientId(req);

    const [socialProfiles, documents, tasks] = await Promise.all([
      // 1. Active social profiles
      prisma.clientSocialProfile.findMany({
        where: { clientId, isActive: true },
        select: {
          id: true,
          platform: true,
          handle: true,
          profileUrl: true,
        },
        orderBy: { platform: 'asc' },
      }),

      // 2. Client-visible documents
      prisma.clientDocument.findMany({
        where: { clientId, clientVisible: true },
        select: {
          id: true,
          title: true,
          type: true,
          fileUrl: true,
          clientNotes: true,
          expiryDate: true,
          isSigned: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Client-visible tasks (commonly completed or awaiting approval)
      prisma.deliverableTask.findMany({
        where: {
          clientId,
          clientVisible: true,
          status: { in: ['COMPLETED', 'WAITING_APPROVAL'] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          clientNotes: true,
          postUrl: true,
          postedAt: true,
          proofUrl: true,
          dueDate: true,
          createdAt: true,
          platforms: { select: { platform: true } },
          cycle: { select: { id: true, label: true } },
        },
        orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    res.json({ socialProfiles, documents, tasks });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/portal/social/summary ───────────────────────────────
// Returns the client's active subscription, current cycle, and progress

router.get('/summary', async (req: Request, res: Response, next): Promise<void> => {
  try {
    const clientId = await getClientId(req);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Find the client's active subscription with its package
    const subscription = await prisma.subscription.findFirst({
      where: {
        clientId,
        status: 'ACTIVE',
        OR: [
          { endDate: null },
          { endDate: { gte: todayStart } },
        ],
      },
      include: {
        package: { select: { id: true, name: true, description: true, price: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!subscription) {
      res.json({ subscription: null, cycle: null, progress: null });
      return;
    }

    // Find the current/latest cycle
    const now = new Date();
    let cycle = await prisma.subscriptionCycle.findFirst({
      where: {
        subscriptionId: subscription.id,
        cycleStart: { lte: now },
        cycleEnd: { gte: now },
      },
    });

    // If no current cycle, get the most recent one
    if (!cycle) {
      cycle = await prisma.subscriptionCycle.findFirst({
        where: { subscriptionId: subscription.id },
        orderBy: { cycleStart: 'desc' },
      });
    }

    let progress = null;
    if (cycle) {
      const totalTasks = await prisma.deliverableTask.count({
        where: { cycleId: cycle.id, clientVisible: true },
      });
      const completedTasks = await prisma.deliverableTask.count({
        where: { cycleId: cycle.id, clientVisible: true, status: 'COMPLETED' },
      });
      progress = {
        total: totalTasks,
        completed: completedTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    }

    res.json({ subscription, cycle, progress });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/portal/social/tasks ─────────────────────────────────
// Returns only client-visible tasks, optionally filtered by status

router.get('/tasks', async (req: Request, res: Response, next) => {
  try {
    const clientId = await getClientId(req);

    const where: any = {
      clientId,
      clientVisible: true,
    };

    // Optionally filter by status (clients typically see COMPLETED and WAITING_APPROVAL)
    if (req.query.status) {
      where.status = String(req.query.status);
    } else {
      // Default: show COMPLETED and WAITING_APPROVAL only
      where.status = { in: ['COMPLETED', 'WAITING_APPROVAL'] };
    }

    if (req.query.cycleId) {
      where.cycleId = String(req.query.cycleId);
    }

    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const tasks = await prisma.deliverableTask.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        clientNotes: true, // Only client-facing notes
        postUrl: true,
        postedAt: true,
        proofUrl: true,
        dueDate: true,
        createdAt: true,
        platforms: { select: { platform: true } },
        cycle: { select: { id: true, label: true } },
      },
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
    });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/portal/social/documents ─────────────────────────────
// Returns only client-visible documents

router.get('/documents', async (req: Request, res: Response, next) => {
  try {
    const clientId = await getClientId(req);

    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const documents = await prisma.clientDocument.findMany({
      where: {
        clientId,
        clientVisible: true,
      },
      select: {
        id: true,
        title: true,
        type: true,
        fileUrl: true,
        clientNotes: true, // Only client-facing notes — NOT internalNotes
        expiryDate: true,
        isSigned: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/portal/social/planner ────────────────────────────────
// Returns client content planner posts for a given month/year

router.get('/planner', async (req: Request, res: Response, next) => {
  try {
    const clientId = await getClientId(req);
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();

    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 200 });
    const posts = await prisma.contentPost.findMany({
      where: {
        clientId,
        month,
        year,
      },
      select: {
        id: true,
        title: true,
        platform: true,
        status: true,
        shootingDate: true,
        publishDate: true,
        notes: true,
        attachmentUrl: true,
        createdAt: true,
      },
      orderBy: [{ publishDate: 'asc' }, { shootingDate: 'asc' }, { createdAt: 'asc' }],
      take,
      skip,
    });

    res.json({ posts, month, year });
  } catch (error) {
    next(error);
  }
});

export default router;
