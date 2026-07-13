import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PATHS } from '../lib/paths.js';

const router = Router();

// Secure all expense endpoints
router.use(authenticate);
router.use(requireAdmin);

// ─── Multer for receipt uploads ──────────────────────────────────────
const receiptStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    const receiptDir = path.join(PATHS.UPLOADS, 'receipts');
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    cb(null, receiptDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed for receipts'));
    }
  },
});

// ─── Validation Schemas ──────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'FOOD', 'TRANSPORT', 'SOFTWARE', 'OFFICE', 'MARKETING',
  'RENT', 'UTILITIES', 'PAYROLL', 'EQUIPMENT', 'TRAVEL',
  'COMMUNICATION', 'ENTERTAINMENT', 'TAXES', 'OTHER',
] as const;

const createExpenseSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  employeeId: z.string().uuid().optional().nullable(),
  amount: z.number().positive('Amount must be greater than 0'),
  category: z.string().default('OTHER'),
  description: z.string().min(1, 'Description is required'),
  date: z.string(),
  notes: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

const updateExpenseSchema = createExpenseSchema.partial();

// ─── GET /api/expenses ────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      accountId,
      category,
      employeeId,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (accountId) where.accountId = accountId as string;
    if (category) where.category = category as string;
    if (employeeId) where.employeeId = employeeId as string;

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, type: true, color: true, currency: true } },
          employee: { select: { id: true, name: true, role: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.expense.count({ where }),
    ]);

    // Summary stats
    const stats = await prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    res.json({
      expenses,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      stats,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/expenses/summary ────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    const now = new Date();
    const fromDate = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to ? new Date(to as string) : now;

    const [totalAgg, byCategory, byAccount] = await Promise.all([
      prisma.expense.aggregate({
        where: { date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: { date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.expense.groupBy({
        by: ['accountId'],
        where: { date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      total: totalAgg._sum.amount ?? 0,
      count: totalAgg._count.id ?? 0,
      byCategory,
      byAccount,
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/expenses/:id ────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id as string },
      include: {
        account: { select: { id: true, name: true, type: true, color: true, currency: true } },
        employee: { select: { id: true, name: true, role: true } },
      },
    });

    if (!expense) throw AppError.notFound('Expense not found');
    res.json({ expense });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/expenses ───────────────────────────────────────────────
router.post('/', validate({ body: createExpenseSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, amount, category, description, date, notes, receiptUrl, employeeId } = req.body;

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw AppError.notFound('Account not found');

    if (employeeId) {
      const employee = await prisma.teamMember.findUnique({ where: { id: employeeId } });
      if (!employee) throw AppError.notFound('Employee not found');
    }

    if (category === 'PAYROLL' && employeeId) {
      const expDate = new Date(date);
      const startOfMonth = new Date(expDate.getFullYear(), expDate.getMonth(), 1);
      const endOfMonth = new Date(expDate.getFullYear(), expDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const existingPayroll = await prisma.expense.findFirst({
        where: {
          employeeId,
          category: 'PAYROLL',
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });
      if (existingPayroll) {
        throw AppError.badRequest('A payroll expense has already been recorded for this employee for this month.');
      }
    }

    // Amount comes in as dollars, store as cents
    const amountCents = Math.round(amount * 100);

    const expense = await prisma.expense.create({
      data: {
        accountId,
        employeeId: employeeId || null,
        amount: amountCents,
        category,
        description,
        date: new Date(date),
        notes: notes || null,
        receiptUrl: receiptUrl || null,
      },
      include: {
        account: { select: { id: true, name: true, type: true, color: true, currency: true } },
        employee: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/expenses/:id ────────────────────────────────────────────
router.put('/:id', validate({ body: updateExpenseSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Expense not found');

    const { id: _id, createdAt: _c, updatedAt: _u, account: _a, employee: _e, ...data } = req.body;

    if (data.employeeId) {
      const employee = await prisma.teamMember.findUnique({ where: { id: data.employeeId } });
      if (!employee) throw AppError.notFound('Employee not found');
    }

    const targetCategory = data.category !== undefined ? data.category : existing.category;
    const targetEmployeeId = data.employeeId !== undefined ? data.employeeId : existing.employeeId;
    const targetDate = data.date !== undefined ? new Date(data.date) : existing.date;

    if (targetCategory === 'PAYROLL' && targetEmployeeId) {
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const existingPayroll = await prisma.expense.findFirst({
        where: {
          id: { not: req.params.id as string },
          employeeId: targetEmployeeId,
          category: 'PAYROLL',
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });
      if (existingPayroll) {
        throw AppError.badRequest('A payroll expense has already been recorded for this employee for this month.');
      }
    }

    const updateData: any = { ...data };
    if (data.amount !== undefined) updateData.amount = Math.round(data.amount * 100);
    if (data.date !== undefined) updateData.date = new Date(data.date);

    const expense = await prisma.expense.update({
      where: { id: req.params.id as string },
      data: updateData,
      include: {
        account: { select: { id: true, name: true, type: true, color: true, currency: true } },
        employee: { select: { id: true, name: true, role: true } },
      },
    });

    res.json({ expense });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/expenses/:id ─────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Expense not found');

    await prisma.expense.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/expenses/upload-receipt ───────────────────────────────
// Upload a receipt image and get back the URL
router.post(
  '/upload-receipt',
  receiptUpload.single('receipt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw AppError.badRequest('No file uploaded');
      const fileUrl = `/uploads/receipts/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/expenses/scan ─────────────────────────────────────────
// Scan a receipt image with AI (GPT-4o vision) to extract fields
router.post(
  '/scan',
  receiptUpload.single('receipt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw AppError.badRequest('No file uploaded');

      const settings = await prisma.agencySettings.findFirst();
      const apiKey = settings?.openAiApiKey || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        // If no AI key, return the file URL only without OCR
        const fileUrl = `/uploads/receipts/${req.file.filename}`;
        res.json({
          receiptUrl: fileUrl,
          extracted: null,
          message: 'No OpenAI API key configured. File uploaded without OCR.',
        });
        return;
      }

      // Read and base64-encode the uploaded file
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Image = fileBuffer.toString('base64');
      const mimeType = req.file.mimetype;

      const fileUrl = `/uploads/receipts/${req.file.filename}`;

      // Call OpenAI Vision
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are a receipt scanner. Analyze this receipt image and extract key information. 
                  Return ONLY a valid JSON object with these fields (use null if not found):
                  {
                    "amount": <number in major currency unit, e.g. 25.50>,
                    "description": <merchant name or item description, string>,
                    "date": <date in YYYY-MM-DD format, string>,
                    "category": <one of: FOOD, TRANSPORT, SOFTWARE, OFFICE, MARKETING, RENT, UTILITIES, PAYROLL, EQUIPMENT, TRAVEL, COMMUNICATION, ENTERTAINMENT, TAXES, OTHER>
                  }
                  Return only the JSON, no explanation.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: 'low',
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('OpenAI API error:', errText);
        res.json({ receiptUrl: fileUrl, extracted: null, message: 'AI scanning failed. Please fill in fields manually.' });
        return;
      }

      const aiResult: any = await response.json();
      const content = aiResult.choices?.[0]?.message?.content?.trim() ?? '';

      let extracted = null;
      try {
        // Strip markdown code fences if present
        const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        extracted = JSON.parse(cleaned);
      } catch {
        console.warn('Could not parse AI response:', content);
      }

      res.json({ receiptUrl: fileUrl, extracted });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
