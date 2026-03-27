import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// ─── GET /api/team ────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const team = await prisma.teamMember.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { projects: true } },
      },
    });
    res.json({ team });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/team/:id ────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const member = await prisma.teamMember.findUnique({
      where: { id: req.params.id as string },
      include: {
        projects: { include: { project: true } },
      },
    });

    if (!member) throw AppError.notFound('Team member not found');
    res.json({ member });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/team ──────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const member = await prisma.teamMember.create({ data: req.body });
    res.status(201).json({ member });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/team/:id ────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const member = await prisma.teamMember.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ member });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/team/:id ─────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await prisma.teamMember.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Team member deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
