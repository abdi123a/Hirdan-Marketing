import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';

const packageDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().int().nonnegative(),
  features: z.string().optional().nullable(),
  type: z.enum(['SERVICE', 'SUBSCRIPTION', 'ONE_TIME']).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  deliverables: z.array(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      type: z.enum(['POST', 'STORY', 'REEL', 'SHORT', 'VIDEO', 'REPORT', 'OTHER']),
      quantity: z.number().int().positive(),
      description: z.string().optional().nullable(),
      platforms: z.array(z.enum(['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER'])).min(1),
    })
  ).optional(),
});

const router = Router();
router.use(authenticate);
// Authentication is required for all routes, admin for modifications

// ─── GET /api/packages ───────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(_req.query, { maxTake: 100, defaultTake: 50 });
    const packages = await prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        packageServices: { include: { service: true } },
        deliverables: { include: { platforms: { select: { platform: true } } } },
        _count: { select: { subscriptions: true } },
      },
    });
    res.json({ packages });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/packages/:id ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id as string },
      include: {
        packageServices: { include: { service: true } },
        deliverables: { include: { platforms: { select: { platform: true } } } },
        subscriptions: true,
      },
    });

    if (!pkg) throw AppError.notFound('Package not found');
    res.json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/packages ─────────────────────────────────────────

router.post('/', requireAdmin, validate({ body: packageDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const { serviceIds, deliverables, ...packageData } = req.body;
    const pkg = await prisma.package.create({ 
      data: {
        ...packageData,
        packageServices: serviceIds && serviceIds.length > 0 ? {
          create: serviceIds.map((id: string) => ({ serviceId: id }))
        } : undefined,
        deliverables: deliverables && deliverables.length > 0 ? {
          create: deliverables.map((d: any) => ({
             name: d.name,
             type: d.type,
             quantity: d.quantity,
             description: d.description,
             platforms: {
                create: d.platforms.map((p: string) => ({ platform: p }))
             }
          }))
        } : undefined
      }
    });
    res.status(201).json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/packages/:id ──────────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: packageDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const { serviceIds, deliverables, ...packageData } = req.body;
    const updateData: any = { ...packageData };
    
    if (serviceIds !== undefined) {
      updateData.packageServices = {
        deleteMany: {},
        create: serviceIds.map((id: string) => ({ serviceId: id }))
      };
    }

    if (deliverables !== undefined) {
      updateData.deliverables = {
        deleteMany: {},
        create: deliverables.map((d: any) => ({
             name: d.name,
             type: d.type,
             quantity: d.quantity,
             description: d.description,
             platforms: {
                create: d.platforms.map((p: string) => ({ platform: p }))
             }
        }))
      };
    }

    const pkg = await prisma.package.update({
      where: { id: req.params.id as string },
      data: updateData,
    });
    res.json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/packages/:id ───────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.package.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Package deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
