import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';
import {
  ACCESS_LEVELS,
  PERMISSION_MODULES,
  type PermissionMap,
  resolvePermissions,
  sanitizePermissionMap,
} from '../lib/permissions.js';

const router = Router();

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[\W_]/, 'Password must contain at least one special character');

const permissionMapSchema = z.record(z.string(), z.enum(ACCESS_LEVELS)).optional().nullable();

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema.optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CLIENT']),
  teamMemberId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  permissions: permissionMapSchema,
});

function shapeUser(user: any) {
  const overrides = (user.permissions as PermissionMap | null) || null;
  return {
    ...user,
    permissions: overrides,
    resolvedPermissions: resolvePermissions(user.role, overrides),
  };
}

router.use(authenticate);
router.use(requireAdmin);

// ─── GET /api/users/permission-catalog ────────────────────────────
router.get('/permission-catalog', (_req: Request, res: Response) => {
  res.json({
    modules: PERMISSION_MODULES,
    levels: ACCESS_LEVELS,
  });
});

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
    res.json({ users: users.map(shapeUser) });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/users ──────────────────────────────────────────────
router.post('/', validate({ body: userSchema.extend({ password: passwordSchema }) }), async (req: Request, res: Response, next) => {
  try {
    const { name, email, password, role, teamMemberId, clientId, permissions } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw AppError.badRequest('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const sanitized = permissions != null ? sanitizePermissionMap(permissions) : null;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        permissions: role === 'ADMIN' || sanitized === null
          ? Prisma.DbNull
          : sanitized,
        ...(teamMemberId ? { teamMember: { connect: { id: teamMemberId } } } : {}),
        ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      },
      include: {
        teamMember: { select: { id: true, name: true, role: true } },
        client: { select: { id: true, company: true } },
      }
    });

    res.status(201).json({ user: shapeUser(user) });
  } catch (error) {
    console.error('Add user error:', error);
    next(error);
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────
router.put('/:id', validate({ body: userSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const { name, email, password, role, teamMemberId, clientId, permissions } = req.body;

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

    if (permissions !== undefined) {
      const effectiveRole = role ?? (await prisma.user.findUnique({ where: { id }, select: { role: true } }))?.role;
      if (effectiveRole === 'ADMIN') {
        data.permissions = Prisma.DbNull;
      } else if (permissions === null) {
        data.permissions = Prisma.DbNull;
      } else {
        data.permissions = sanitizePermissionMap(permissions);
      }
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

    res.json({ user: shapeUser(user) });
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
