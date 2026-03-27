import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
// ─── GET /api/projects ────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true } },
        teamMembers: { include: { teamMember: true } },
      },
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/projects/:id ────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id as string },
      include: {
        client: true,
        teamMembers: { include: { teamMember: true } },
      },
    });

    if (!project) throw AppError.notFound('Project not found');
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/projects ──────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const project = await prisma.project.create({
      data: req.body,
    });
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/projects/:id ────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
