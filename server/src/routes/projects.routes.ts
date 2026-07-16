import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { createNotification } from '../lib/notifications.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';

const projectDtoSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  description: z.string().optional().nullable(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'ARCHIVED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  budget: z.number().int().optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  tags: z.string().optional().nullable(),
});

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

    const { take, skip } = parsePagination(req.query, { maxTake: 100, defaultTake: 50 });
    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
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
    const where: any = { id: req.params.id as string };
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const project = await prisma.project.findFirst({
      where,
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

router.post('/', requireAdmin, validate({ body: projectDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const project = await prisma.project.create({
      data: req.body,
      include: { client: { select: { name: true, company: true } } },
    });
    const clientName = (project as any).client?.company || (project as any).client?.name || 'Unknown Client';
    createNotification({
      title: 'New Project Assigned',
      message: `Project "${project.name}" for ${clientName} has been created.`,
      type: 'PROJECT_CREATED',
      category: 'ACTION_REQUIRED',
      entityType: 'PROJECT',
      entityId: project.id,
      actionUrl: `/dashboard/projects/${project.id}`,
    });
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/projects/:id ────────────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: projectDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const prev = await prisma.project.findUnique({ where: { id: req.params.id as string } });
    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    // Notify on status changes
    if (prev && req.body.status && prev.status !== req.body.status) {
      if (req.body.status === 'COMPLETED') {
        createNotification({
          title: 'Project Completed 🎉',
          message: `Project "${project.name}" has been marked as completed.`,
          type: 'PROJECT_COMPLETED',
          category: 'SUCCESS',
          entityType: 'PROJECT',
          entityId: project.id,
          actionUrl: `/dashboard/projects/${project.id}`,
        });
      } else if (req.body.status === 'ARCHIVED') {
        createNotification({
          title: 'Project Archived',
          message: `Project "${project.name}" has been archived.`,
          type: 'PROJECT_ARCHIVED',
          category: 'INFORMATION',
          entityType: 'PROJECT',
          entityId: project.id,
          actionUrl: `/dashboard/projects/${project.id}`,
        });
      } else if (req.body.status === 'ON_HOLD') {
        createNotification({
          title: 'Project On Hold',
          message: `Project "${project.name}" has been placed on hold.`,
          type: 'PROJECT_ON_HOLD',
          category: 'WARNING',
          entityType: 'PROJECT',
          entityId: project.id,
          actionUrl: `/dashboard/projects/${project.id}`,
        });
      }
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
