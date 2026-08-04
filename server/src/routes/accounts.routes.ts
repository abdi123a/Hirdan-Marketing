import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { z } from 'zod';

const router = Router();

// Secure all account endpoints
router.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────────────────

const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['BANK', 'MOBILE_WALLET', 'CASH']),
  currency: z.string().default('USD'),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateAccountSchema = createAccountSchema.partial();

const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive('Amount must be greater than 0'),
  note: z.string().optional().nullable(),
  date: z.string().optional(),
});

const createDepositSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  category: z.string().default('OTHER'),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Calculates account balance dynamically:
 * - Expenses deducted from account
 * - Transfers out deducted
 * - Transfers in added
 * - Deposits added
 */
async function getAccountBalance(accountId: string): Promise<number> {
  const balances = await getAccountBalances([accountId]);
  return balances.get(accountId) ?? 0;
}

/** Batch-compute balances for many accounts (4 groupBy queries total). */
async function getAccountBalances(accountIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of accountIds) map.set(id, 0);
  if (accountIds.length === 0) return map;

  const [expenses, transfersOut, transfersIn, deposits] = await Promise.all([
    prisma.expense.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds } },
      _sum: { amount: true },
    }),
    prisma.accountTransfer.groupBy({
      by: ['fromAccountId'],
      where: { fromAccountId: { in: accountIds } },
      _sum: { amount: true },
    }),
    prisma.accountTransfer.groupBy({
      by: ['toAccountId'],
      where: { toAccountId: { in: accountIds } },
      _sum: { amount: true },
    }),
    prisma.deposit.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds } },
      _sum: { amount: true },
    }),
  ]);

  for (const row of deposits) {
    if (!row.accountId) continue;
    map.set(row.accountId, (map.get(row.accountId) ?? 0) + (row._sum.amount ?? 0));
  }
  for (const row of transfersIn) {
    map.set(row.toAccountId, (map.get(row.toAccountId) ?? 0) + (row._sum.amount ?? 0));
  }
  for (const row of transfersOut) {
    map.set(row.fromAccountId, (map.get(row.fromAccountId) ?? 0) - (row._sum.amount ?? 0));
  }
  for (const row of expenses) {
    if (!row.accountId) continue;
    map.set(row.accountId, (map.get(row.accountId) ?? 0) - (row._sum.amount ?? 0));
  }

  return map;
}

// ─── GET /api/accounts ────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: 'asc' },
    });

    const balances = await getAccountBalances(accounts.map((a) => a.id));
    const accountsWithBalance = accounts.map((account) => ({
      ...account,
      balance: balances.get(account.id) ?? 0,
    }));

    res.json({ accounts: accountsWithBalance });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/accounts/:id ────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.id as string },
    });

    if (!account) {
      throw AppError.notFound('Account not found');
    }

    const balance = await getAccountBalance(account.id);

    res.json({ account: { ...account, balance } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/accounts ───────────────────────────────────────────────
router.post('/', validate({ body: createAccountSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await prisma.account.create({
      data: req.body,
    });

    res.status(201).json({ account: { ...account, balance: 0 } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/accounts/:id ────────────────────────────────────────────
router.put('/:id', validate({ body: updateAccountSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.account.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Account not found');

    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = req.body;

    const account = await prisma.account.update({
      where: { id: req.params.id as string },
      data,
    });

    const balance = await getAccountBalance(account.id);
    res.json({ account: { ...account, balance } });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/accounts/:id ─────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.account.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Account not found');

    // Soft-delete by archiving
    await prisma.account.update({
      where: { id: req.params.id as string },
      data: { isArchived: true },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/accounts/transfer ──────────────────────────────────────
router.post('/transfer', validate({ body: transferSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromAccountId, toAccountId, amount, note, date } = req.body;

    if (fromAccountId === toAccountId) {
      throw AppError.badRequest('Cannot transfer to the same account');
    }

    const [from, to] = await Promise.all([
      prisma.account.findUnique({ where: { id: fromAccountId } }),
      prisma.account.findUnique({ where: { id: toAccountId } }),
    ]);

    if (!from) throw AppError.notFound('Source account not found');
    if (!to) throw AppError.notFound('Destination account not found');

    // Amount comes in as dollars from frontend, store as cents
    const amountCents = Math.round(amount * 100);

    const transfer = await prisma.accountTransfer.create({
      data: {
        fromAccountId,
        toAccountId,
        amount: amountCents,
        note: note || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    res.status(201).json({ transfer });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/accounts/:id/transfers ─────────────────────────────────
router.get('/:id/transfers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfers = await prisma.accountTransfer.findMany({
      where: {
        OR: [
          { fromAccountId: req.params.id as string },
          { toAccountId: req.params.id as string },
        ],
      },
      include: {
        fromAccount: { select: { id: true, name: true, type: true } },
        toAccount: { select: { id: true, name: true, type: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ transfers });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/accounts/deposit ──────────────────────────────────────
router.post('/deposit', validate({ body: createDepositSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, amount, category, description, date } = req.body;

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw AppError.notFound('Account not found');

    // Amount comes in as dollars from frontend, store as cents
    const amountCents = Math.round(amount * 100);

    const deposit = await prisma.deposit.create({
      data: {
        accountId,
        amount: amountCents,
        category: category || 'OTHER',
        description: description || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    res.status(201).json({ deposit });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/accounts/:id/deposits ──────────────────────────────────
router.get('/:id/deposits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deposits = await prisma.deposit.findMany({
      where: { accountId: req.params.id as string },
      orderBy: { date: 'desc' },
    });

    res.json({ deposits });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/accounts/deposit/:id ────────────────────────────────
router.delete('/deposit/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.deposit.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Deposit record not found');

    await prisma.deposit.delete({
      where: { id: req.params.id as string },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
