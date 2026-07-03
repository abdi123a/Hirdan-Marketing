import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';

const router = Router();

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[\W_]/, 'Password must contain at least one special character');

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema.optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CLIENT']),
  teamMemberId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

router.use(authenticate);
router.use(requireAdmin);

// ─── GET /api/users ───────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(_req.query, { maxTake: 100, defaultTake: 50 });
    const users = await prisma.user.findMany({
      include: {
        teamMember: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        },
        client: {
          select: {
            id: true,
            company: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/users ──────────────────────────────────────────────
router.post('/', validate({ body: userSchema.extend({ password: passwordSchema }) }), async (req: Request, res: Response, next) => {
  try {
    const { name, email, password, role, teamMemberId, clientId } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw AppError.badRequest('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        ...(teamMemberId ? { teamMember: { connect: { id: teamMemberId } } } : {}),
        ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      },
      include: {
        teamMember: { select: { id: true, name: true, role: true } },
        client: { select: { id: true, company: true } },
      }
    });

    res.status(201).json({ user });
  } catch (error) {
    console.error('Add user error:', error);
    next(error);
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────
router.put('/:id', validate({ body: userSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const { name, email, password, role, teamMemberId, clientId } = req.body;

    // Check email uniqueness if email is being changed
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { 
          email,
          NOT: { id }
        }
      });
      if (existing) {
        throw AppError.badRequest('Email already in use by another user');
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    if (teamMemberId !== undefined) {
      if (teamMemberId === null) {
        data.teamMember = { disconnect: true };
      } else {
        data.teamMember = { connect: { id: teamMemberId } };
      }
    }

    if (clientId !== undefined) {
      if (clientId === null) {
        data.client = { disconnect: true };
      } else {
        data.client = { connect: { id: clientId } };
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: {
        teamMember: { select: { id: true, name: true, role: true } },
        client: { select: { id: true, company: true } },
      }
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    // Prevent deleting self?
    if (req.params.id === req.user?.userId) {
      throw AppError.badRequest('Cannot delete your own account');
    }

    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
