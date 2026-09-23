import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import bcrypt from 'bcryptjs';
import { parsePagination } from '../lib/pagination.js';
import { createNotification } from '../lib/notifications.js';
import { sendEmail, generateWelcomeEmailHtml } from '../lib/email.js';
import { Prisma } from '@prisma/client';
import { deactivateUser, generateTempPassword, revokeUserSessions } from '../lib/auth-security.js';

/** Remove agency-internal fields before a client sees their own record. */
function toClientFacing<T extends Record<string, any>>(client: T) {
  const { notes: _notes, ...rest } = client;
  return rest;
}


const router = Router();

// All client routes require authentication
router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────

const clientDtoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().or(z.literal('')).nullable().transform(val => val === '' ? null : val),
  phone: z.string().optional().nullable().transform(val => val || null),
  company: z.string().optional().nullable().transform(val => val || ''), // Prisma needs non-null
  type: z.enum(['BUSINESS', 'INDIVIDUAL']).optional(),
  website: z.string().optional().nullable().transform(val => val || null),
  address: z.string().optional().nullable().transform(val => val || null),
  city: z.string().optional().nullable().transform(val => val || null),
  country: z.string().optional().nullable().transform(val => val || null),
  industry: z.string().optional().nullable().transform(val => val || null),
  notes: z.string().optional().nullable().transform(val => val || null),
  status: z.enum(['ACTIVE', 'PAUSED', 'CHURNED']).optional(),
  initials: z.string().optional().nullable().transform(val => val || null),
  invoiceGenerationDay: z.number().int().min(1).max(28).optional().nullable(),
  paymentReminderDelay: z.number().int().min(0).max(30).optional().nullable(),
  overdueNoticeDelay: z.number().int().min(0).max(60).optional().nullable(),
  portalAccess: z.any().optional().nullable(),
});

const clientSelfUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().or(z.literal('')).nullable().optional().transform(val => val === '' ? null : val),
  phone: z.string().optional().nullable().transform(val => val || null),
  company: z.string().optional().nullable().transform(val => val || ''),
  website: z.string().optional().nullable().transform(val => val || null),
  address: z.string().optional().nullable().transform(val => val || null),
  city: z.string().optional().nullable().transform(val => val || null),
  country: z.string().optional().nullable().transform(val => val || null),
});

// ─── GET /api/clients ─────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CLIENT') {
      where.userId = req.user!.userId;
    }

    const { take, skip } = parsePagination(req.query, { maxTake: 100, defaultTake: 50 });
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        _count: {
          select: {
            projects: true,
            invoices: true,
            subscriptions: true,
            socialAccounts: true,
          },
        },
        // Only include invoices for aggregation if user is ADMIN
        ...(req.user!.role === 'ADMIN' && {
          invoices: {
            where: { status: { in: ['PAID', 'PARTIALLY_PAID'] } },
            select: { amount: true, deposit: true, status: true },
          },
        }),
      },
    });

    const clientsWithRevenue = clients.map(client => {
      const revenue = (client as any).invoices?.reduce((sum: number, inv: any) => {
        if (inv.status === 'PAID') return sum + inv.amount;
        if (inv.status === 'PARTIALLY_PAID') return sum + (inv.deposit || 0);
        return sum;
      }, 0) ?? 0;
      const { invoices, ...rest } = client as any;
      const shaped = req.user!.role === 'CLIENT' ? toClientFacing(rest) : rest;
      return { ...shaped, role: req.user!.role, revenue };
    });

    res.json({ clients: clientsWithRevenue });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/clients/portal/next-meeting (client portal) ────────────────────
// Returns the next upcoming meeting for the authenticated client
router.get('/portal/next-meeting', async (req: Request, res: Response, next) => {
  try {
    if (req.user!.role !== 'CLIENT') throw AppError.forbidden('Clients only');

    const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
    if (!client) throw AppError.notFound('Client not found');

    const now = new Date();
    const meeting = await prisma.clientMeeting.findFirst({
      where: {
        clientId: client.id,
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ meeting: meeting ?? null });
  } catch (error) {
    next(error);
  }
});

// NOTE: /me routes must be declared before /:id so they aren't shadowed.
// ─── GET /api/clients/me ──────────────────────────────────────────

router.get('/me', async (req: Request, res: Response, next) => {
  try {
    if (req.user!.role !== 'CLIENT') {
      throw AppError.forbidden('Only clients can access this resource');
    }

    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client) {
      throw AppError.notFound('Client account not found');
    }

    res.json({ client: toClientFacing(client) });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/clients/me ──────────────────────────────────────────

router.put('/me', validate({ body: clientSelfUpdateSchema }), async (req: Request, res: Response, next) => {
  try {
    if (req.user!.role !== 'CLIENT') {
      throw AppError.forbidden('Only clients can update this resource');
    }

    const existingClient = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
      include: { user: true },
    });

    if (!existingClient) {
      throw AppError.notFound('Client account not found');
    }

    const data = req.body;

    const client = await prisma.client.update({
      where: { id: existingClient.id },
      data,
    });

    if (existingClient.userId && (data.name !== undefined || data.email !== undefined)) {
      await prisma.user.update({
        where: { id: existingClient.userId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
        },
      });
    }

    res.json({ client: toClientFacing(client) });
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
        invoices: { include: { items: { orderBy: { position: 'asc' } } } },
        proformas: { include: { items: { orderBy: { position: 'asc' } } } },
        subscriptions: { include: { package: true } },
        socialProfiles: { orderBy: { platform: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
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

router.post('/', requireAdmin, validate({ body: clientDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const client = await prisma.client.create({
      data: req.body,
    });
    createNotification({
      title: 'New Client Added',
      message: `${client.company || client.name} has been added as a new client.`,
      type: 'CLIENT_CREATED',
      category: 'INFORMATION',
      entityType: 'CLIENT',
      entityId: client.id,
      actionUrl: `/dashboard/clients/view/${client.id}`,
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
    const existing = await prisma.client.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) throw AppError.notFound('Client not found');
    try {
      await prisma.client.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw AppError.conflict(
          'This client has invoices, proformas or subscriptions and cannot be deleted. Set the client status to CHURNED instead.'
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw AppError.notFound('Client not found');
      }
      throw err;
    }
    // The portal login has nothing left to access.
    if (existing.userId) await deactivateUser(existing.userId);
    res.json({ message: 'Client deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /api/clients/:id/portal-access ─────────────────────────

router.patch('/:id/portal-access', requireAdmin, validate({ body: z.object({ portalAccess: z.any() }) }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const client = await prisma.client.update({
      where: { id },
      data: { portalAccess: req.body.portalAccess },
    });
    res.json({ client });
  } catch (error) {
    next(error);
  }
});


// ─── GET /api/clients/:id/invoices ────────────────────────────────

router.get('/:id/invoices', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const invoices = await prisma.invoice.findMany({
      where: { clientId: req.params.id as string },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { date: 'desc' },
      take,
      skip,
    });
    res.json({ invoices });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/clients/:id/projects ────────────────────────────────

router.get('/:id/projects', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const projects = await prisma.project.findMany({
      where: { clientId: req.params.id as string },
      include: { teamMembers: { include: { teamMember: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
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

    if (!client.email) {
      throw AppError.badRequest('Client must have an email address to generate portal access');
    }

    // Generate a temporary password for first login/reset.
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    let user = client.user;
    if (!user) {
      // Never convert an unrelated account (e.g. staff/admin) into this client's login.
      const existing = await prisma.user.findUnique({ where: { email: client.email } });
      if (existing) {
        throw AppError.conflict(
          'A user account with this email already exists and is not linked to this client. Use a different email for the portal login.'
        );
      }
    }

    if (user) {
      if (user.role !== 'CLIENT') {
        throw AppError.conflict('The linked user account is not a client account; refusing to reset it.');
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      // New credentials end every existing portal session.
      await revokeUserSessions(user.id);
    } else {
      user = await prisma.user.create({
        data: {
          email: client.email,
          name: client.name,
          passwordHash,
          mustChangePassword: true,
          role: 'CLIENT',
        },
      });
      await prisma.client.update({
        where: { id },
        data: { userId: user.id },
      });
    }

    res.json({ tempPassword, message: 'Portal access generated successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:id/send-welcome-email ──────────────────────

router.post('/:id/send-welcome-email', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const { tempPassword } = req.body as { tempPassword?: string };

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw AppError.notFound('Client not found');

    if (!client.email) {
      throw AppError.badRequest('Client must have an email address to receive a welcome email');
    }

    const settings = await prisma.agencySettings.findFirst();
    const website = settings?.website || 'hirdanmarketing.com';
    const frontendUrl = process.env.FRONTEND_URL || `https://app.${website}`;

    const emailHtml = await generateWelcomeEmailHtml({
      clientName: client.name,
      clientEmail: client.email,
      tempPassword: tempPassword || '(see your admin for credentials)',
      portalUrl: frontendUrl,
    });

    const agencyName = settings?.agencyName || 'Hirdan Marketing';

    const result = await sendEmail({
      to: client.email,
      subject: `Welcome to ${agencyName} — Your Client Portal is Ready 🎉`,
      html: emailHtml,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    res.json({ success: true, message: 'Welcome email sent successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
