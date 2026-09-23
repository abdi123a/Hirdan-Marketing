import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';
import { passwordSchema, deactivateUser, revokeUserSessions } from '../lib/auth-security.js';
import {
  ACCESS_LEVELS,
  PERMISSION_MODULES,
  type PermissionMap,
  resolvePermissions,
  sanitizePermissionMap,
} from '../lib/permissions.js';

const router = Router();


const permissionMapSchema = z.record(z.string(), z.enum(ACCESS_LEVELS)).optional().nullable();

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema.optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CLIENT']),
  teamMemberId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  permissions: permissionMapSchema,
  /** false disables the login (and ends its sessions); true re-enables it. */
  isActive: z.boolean().optional(),
});

function shapeUser(user: any) {
  const overrides = (user.permissions as PermissionMap | null) || null;
  // Never return credential material, even to admins.
  const { passwordHash: _passwordHash, passwordResetToken: _resetToken, passwordResetExpiry: _resetExpiry, ...safe } = user;
  return {
    ...safe,
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
    // Deactivated ("deleted") accounts are hidden unless explicitly requested.
    const includeInactive = _req.query.includeInactive === 'true';
    const users = await prisma.user.findMany({
      where: includeInactive ? undefined : { isActive: true },
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
    if (existingUser && existingUser.isActive) {
      throw AppError.badRequest('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const sanitized = permissions != null ? sanitizePermissionMap(permissions) : null;

    const fields = {
      name,
      email,
      passwordHash,
      role,
      permissions: role === 'ADMIN' || sanitized === null
        ? Prisma.DbNull
        : sanitized,
      ...(teamMemberId ? { teamMember: { connect: { id: teamMemberId } } } : {}),
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
    };
    const include = {
      teamMember: { select: { id: true, name: true, role: true } },
      client: { select: { id: true, company: true } },
    };

    // Re-adding a previously deleted (deactivated) account revives its row,
    // which keeps its audit history attached.
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            ...fields,
            isActive: true,
            mustChangePassword: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordResetToken: null,
            passwordResetExpiry: null,
          },
          include,
        })
      : await prisma.user.create({ data: fields, include });

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
    const { name, email, password, role, teamMemberId, clientId, permissions, isActive } = req.body;

    if (id === req.user?.userId && (isActive === false || (role !== undefined && role !== 'ADMIN'))) {
      throw AppError.badRequest('You cannot deactivate or demote your own account');
    }

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
      data.failedLoginAttempts = 0;
      data.lockedUntil = null;
    }
    if (isActive !== undefined) data.isActive = isActive;

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

    // A password reset by an admin, or a disabled account, ends every session.
    if (password || isActive === false) {
      await revokeUserSessions(id);
    }

    res.json({ user: shapeUser(user) });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────────
// Deactivates rather than deletes: the row is referenced by audit history
// (shared files, HR approvals, conversation notes…) that must survive.
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    if (id === req.user?.userId) {
      throw AppError.badRequest('Cannot delete your own account');
    }

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw AppError.notFound('User not found');

    await deactivateUser(id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
