import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { z } from 'zod';

const router = Router();

// Secure all recurring expense endpoints to admin
router.use(authenticate);

const EXPENSE_CATEGORIES = [
  'FOOD', 'TRANSPORT', 'SOFTWARE', 'OFFICE', 'MARKETING',
  'RENT', 'UTILITIES', 'PAYROLL', 'EQUIPMENT', 'TRAVEL',
  'COMMUNICATION', 'ENTERTAINMENT', 'TAXES', 'OTHER',
] as const;

// ─── Validation Schemas ──────────────────────────────────────────────

const createRecurringSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().default('OTHER'),
  amount: z.number().positive('Amount must be greater than 0'),
  accountId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ON_DEMAND']).default('MONTHLY'),
});

const updateRecurringSchema = createRecurringSchema.partial();

// ─── GET /api/recurring-expenses ─────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const recurring = await prisma.recurringExpense.findMany({
      include: {
        account: { select: { id: true, name: true, type: true, currency: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ recurring });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/recurring-expenses ────────────────────────────────────
router.post('/', validate({ body: createRecurringSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, amount, accountId, description, isActive, dayOfMonth, startDate, endDate, frequency } = req.body;

    if (accountId) {
      const account = await prisma.account.findUnique({ where: { id: accountId } });
      if (!account) throw AppError.notFound('Account not found');
    }

    // Amount comes in as dollars, store as cents
    const amountCents = Math.round(amount * 100);

    const recurring = await prisma.recurringExpense.create({
      data: {
        name,
        category,
        amount: amountCents,
        accountId: accountId || null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
        dayOfMonth: dayOfMonth || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        frequency: frequency || 'MONTHLY',
      },
      include: {
        account: { select: { id: true, name: true, type: true, currency: true } },
      },
    });

    res.status(201).json({ recurring });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/recurring-expenses/:id ─────────────────────────────────
router.put('/:id', validate({ body: updateRecurringSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.recurringExpense.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Recurring expense template not found');

    const { id: _id, createdAt: _c, updatedAt: _u, account: _a, ...data } = req.body;

    if (data.accountId) {
      const account = await prisma.account.findUnique({ where: { id: data.accountId } });
      if (!account) throw AppError.notFound('Account not found');
    }

    const updateData: any = { ...data };
    if (data.amount !== undefined) updateData.amount = Math.round(data.amount * 100);
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    const recurring = await prisma.recurringExpense.update({
      where: { id: req.params.id as string },
      data: updateData,
      include: {
        account: { select: { id: true, name: true, type: true, currency: true } },
      },
    });

    res.json({ recurring });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/recurring-expenses/:id ──────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.recurringExpense.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Recurring expense template not found');

    await prisma.recurringExpense.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/recurring-expenses/:id/post ───────────────────────────
// Creates a real Expense entry from this recurring template for the current month
router.post('/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recurring = await prisma.recurringExpense.findUnique({ where: { id: req.params.id as string } });
    if (!recurring) throw AppError.notFound('Recurring expense template not found');

    let finalAccountId = recurring.accountId;
    if (!finalAccountId) {
      const defaultAcc = await prisma.account.findFirst({ where: { isArchived: false } });
      if (!defaultAcc) {
        throw AppError.badRequest('No payment account configured or selected.');
      }
      finalAccountId = defaultAcc.id;
    }

    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const expense = await prisma.expense.create({
      data: {
        accountId: finalAccountId,
        amount: recurring.amount,
        category: recurring.category,
        description: `${recurring.name} — ${periodLabel}`,
        date: now,
        notes: recurring.description || `Recorded from monthly recurring template.`,
      },
      include: {
        account: { select: { id: true, name: true, type: true, color: true, currency: true } },
      },
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
});

export default router;
