import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();

// All client routes require authentication
router.use(authenticate);

// ─── GET /api/clients ─────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CLIENT') {
      where.userId = req.user!.userId;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            projects: true,
            invoices: true,
            subscriptions: true,
          },
        },
      },
    });
    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/clients/:id ─────────────────────────────────────────

router.get('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        projects: true,
        invoices: { include: { items: true } },
        proformas: { include: { items: true } },
        subscriptions: true,
      },
    });

    if (!client) {
      throw AppError.notFound('Client not found');
    }

    res.json({ client });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients ───────────────────────────────────────────

const clientDtoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable().default(''),
  type: z.enum(['BUSINESS', 'INDIVIDUAL']).optional(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CHURNED']).optional(),
  initials: z.string().optional().nullable(),
});


router.post('/', requireAdmin, validate({ body: clientDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const client = await prisma.client.create({
      data: req.body,
    });
    res.status(201).json({ client });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/clients/:id ─────────────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: clientDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const client = await prisma.client.update({
      where: { id },
      data: req.body,
    });
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/clients/:id ──────────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    await prisma.client.delete({ where: { id } });
    res.json({ message: 'Client deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/clients/:id/invoices ────────────────────────────────

router.get('/:id/invoices', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { clientId: req.params.id as string },
      include: { items: true },
      orderBy: { date: 'desc' },
    });
    res.json({ invoices });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/clients/:id/projects ────────────────────────────────

router.get('/:id/projects', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { clientId: req.params.id as string },
      include: { teamMembers: { include: { teamMember: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:id/portal-access ──────────────────────────

router.post('/:id/portal-access', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const client = await prisma.client.findUnique({ 
      where: { id }, 
      include: { user: true } 
    });

    if (!client) throw AppError.notFound('Client not found');

    const accessCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 uppercase hex chars, CSPRNG
    const passwordHash = await bcrypt.hash(accessCode, 12);

    let user = client.user;
    if (!user) {
      // Check if a user with this email already exists but isn't linked to this client
      user = await prisma.user.findUnique({ where: { email: client.email } });
    }

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          passwordHash, 
          role: 'CLIENT',
          // If the user wasn't linked to the client yet, we might want to ensure they are
          // but the link is on the Client side (userId)
        },
      });
      
      // Ensure the client is linked to this user
      if (client.userId !== user.id) {
        await prisma.client.update({
          where: { id },
          data: { userId: user.id },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: client.email,
          name: client.name,
          passwordHash,
          role: 'CLIENT',
        },
      });
      await prisma.client.update({
        where: { id },
        data: { userId: user.id },
      });
    }

    res.json({ accessCode, message: 'Portal access generated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
