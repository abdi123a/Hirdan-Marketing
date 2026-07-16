import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import bcrypt from 'bcryptjs';

import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';

const teamDtoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  role: z.string().min(1),
  department: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PENDING_DOCUMENTS', 'ACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  avatar: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  hourlyRate: z.number().int().optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  bio: z.string().optional().nullable(),

  // Personal Info
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  nationalIdType: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),

  // Employment Info
  employmentType: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),

  // Payroll Info
  isHourlyMode: z.boolean().optional(),
  basicSalary: z.number().int().optional().nullable(),
  housingAllowance: z.number().int().optional().nullable(),
  transportAllowance: z.number().int().optional().nullable(),
  otherAllowances: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
});

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// ─── GET /api/team ────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(_req.query, { maxTake: 200, defaultTake: 50 });
    const team = await prisma.teamMember.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip,
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
        manager: true,
      },
    });

    if (!member) throw AppError.notFound('Team member not found');
    res.json({ member });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/team ──────────────────────────────────────────────

router.post('/', validate({ body: teamDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const { startDate, ...rest } = req.body;
    const userEmail = (req.user as any)?.email || 'Admin';

    const parsedStartDate = startDate ? new Date(startDate) : null;

    const member = await prisma.teamMember.create({
      data: {
        ...rest,
        startDate: parsedStartDate,
      },
    });

    // Log activity
    await prisma.employeeActivity.create({
      data: {
        employeeId: member.id,
        actionType: 'CREATED',
        performedBy: userEmail,
        notes: `Employee record created with status ${member.status}`,
      },
    });

    const { createNotification } = await import('../lib/notifications.js');
    createNotification({
      title: 'New Employee Added',
      message: `${member.name} has been added to the team (${member.role}).`,
      type: 'EMPLOYEE_CREATED',
      category: 'INFORMATION',
      entityType: 'EMPLOYEE',
      entityId: member.id,
      actionUrl: `/dashboard/team/view/${member.id}`,
    });

    res.status(201).json({ member });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/team/:id ────────────────────────────────────────────

router.put('/:id', validate({ body: teamDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const memberId = req.params.id as string;
    const userEmail = (req.user as any)?.email || 'Admin';

    const currentMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });
    if (!currentMember) throw AppError.notFound('Team member not found');

    const { startDate, ...rest } = req.body;
    const parsedStartDate = startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined;

    const updateData: any = {
      ...rest,
    };
    if (startDate !== undefined) {
      updateData.startDate = parsedStartDate;
    }

    // Validate manager_id — must exist in team_members or be null
    if ('managerId' in updateData) {
      if (updateData.managerId) {
        const managerExists = await prisma.teamMember.findUnique({
          where: { id: updateData.managerId },
          select: { id: true },
        });
        if (!managerExists) {
          updateData.managerId = null; // silently clear invalid manager reference
        }
      } else {
        updateData.managerId = null;
      }
    }

    if (req.body.status && req.body.status !== currentMember.status) {
      if (req.body.status === 'TERMINATED') {
        updateData.archivedAt = new Date();
      } else {
        updateData.archivedAt = null;
      }
    }

    const member = await prisma.teamMember.update({
      where: { id: memberId },
      data: updateData,
    });

    // Check what was updated to log meaningful activities
    const logs = [];
    if (req.body.status && req.body.status !== currentMember.status) {
      const isTerminated = req.body.status === 'TERMINATED';
      const isReactivated = currentMember.status === 'TERMINATED' && req.body.status !== 'TERMINATED';
      
      logs.push(
        prisma.employeeActivity.create({
          data: {
            employeeId: member.id,
            actionType: isTerminated ? 'ARCHIVED' : isReactivated ? 'REACTIVATED' : 'STATUS_CHANGED',
            performedBy: userEmail,
            notes: `Status changed from ${currentMember.status} to ${req.body.status}`,
          },
        })
      );
    } else {
      logs.push(
        prisma.employeeActivity.create({
          data: {
            employeeId: member.id,
            actionType: 'EDITED',
            performedBy: userEmail,
            notes: 'Employee profile updated',
          },
        })
      );
    }

    await Promise.all(logs);

    res.json({ member });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/team/:id ─────────────────────────────────────────
// SOFT DELETE ONLY - Set status to TERMINATED
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const memberId = req.params.id as string;
    const userEmail = (req.user as any)?.email || 'Admin';

    const currentMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });
    if (!currentMember) throw AppError.notFound('Team member not found');

    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        status: 'TERMINATED',
        archivedAt: new Date(),
      },
    });

    await prisma.employeeActivity.create({
      data: {
        employeeId: memberId,
        actionType: 'ARCHIVED',
        performedBy: userEmail,
        notes: 'Employee terminated (soft deleted via DELETE request)',
      },
    });

    res.json({ message: 'Team member soft-deleted (status set to TERMINATED)' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/team/:id/provision-access ────────────────────────
// Create or update system login credentials for a team member
router.post('/:id/provision-access', async (req: Request, res: Response, next) => {
  try {
    const memberId = req.params.id as string;
    const { password, role } = req.body;
    const userEmail = (req.user as any)?.email || 'Admin';

    if (!password || password.length < 6) {
      throw AppError.badRequest('Password must be at least 6 characters');
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });
    if (!member) throw AppError.notFound('Team member not found');

    const passwordHash = await bcrypt.hash(password, 12);
    const assignedRole = role || 'STAFF';

    let user;
    if (member.userId && member.user) {
      // Update existing user account
      user = await prisma.user.update({
        where: { id: member.userId },
        data: { passwordHash, role: assignedRole, mustChangePassword: true },
      });
    } else {
      // Check if there's already a user with this email
      const existing = await prisma.user.findUnique({ where: { email: member.email } });
      if (existing) {
        // Link existing user and update password
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, role: assignedRole, mustChangePassword: true },
        });
        await prisma.teamMember.update({
          where: { id: memberId },
          data: { userId: existing.id },
        });
      } else {
        // Create new user account
        user = await prisma.user.create({
          data: {
            email: member.email,
            name: member.name,
            passwordHash,
            role: assignedRole,
            mustChangePassword: true,
            teamMember: { connect: { id: memberId } },
          },
        });
      }
    }

    // Log activity
    await prisma.employeeActivity.create({
      data: {
        employeeId: memberId,
        actionType: 'EDITED',
        performedBy: userEmail,
        notes: `System access ${member.userId ? 'updated' : 'provisioned'} with role ${assignedRole}`,
      },
    });

    res.json({
      message: 'System access provisioned successfully',
      userId: user.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
