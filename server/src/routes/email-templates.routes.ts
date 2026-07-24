import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff } from '../lib/mail/access.js';

const router = Router();
router.use(authenticate, requireStaff);

const CATEGORIES = ['SUPPORT', 'SALES', 'INVOICES', 'MARKETING', 'HR', 'LEGAL', 'SAVED_REPLY'] as const;

const templateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(CATEGORIES).default('SUPPORT'),
  subject: z.string().default(''),
  body: z.string().default(''),
  mailboxId: z.string().nullable().optional(),
});

/** Auto-detect {{variable}} tokens used in the subject + body. */
function detectVariables(subject: string, body: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  for (const text of [subject, body]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text || ''))) found.add(m[1]);
  }
  return [...found];
}

function zodErr(e: z.ZodError): AppError {
  return AppError.badRequest(e.issues.map((i) => i.message).join(', '));
}

// ─── GET /api/email/templates ────────────────────────────────────
router.get('/templates', async (req: Request, res: Response, next) => {
  try {
    const category = req.query.category as string | undefined;
    const templates = await prisma.emailTemplate.findMany({
      where: category ? { category: category as any } : {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/templates/:id ────────────────────────────────
router.get('/templates/:id', async (req: Request, res: Response, next) => {
  try {
    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id as string } });
    if (!template) throw AppError.notFound('Template not found');
    res.json({ template });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/email/templates ───────────────────────────────────
router.post('/templates', async (req: Request, res: Response, next) => {
  try {
    const data = templateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        subject: data.subject,
        body: data.body,
        mailboxId: data.mailboxId ?? null,
        createdById: req.user!.userId,
        variables: detectVariables(data.subject, data.body),
      },
    });
    res.status(201).json({ template });
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    next(error);
  }
});

// ─── PUT /api/email/templates/:id ────────────────────────────────
router.put('/templates/:id', async (req: Request, res: Response, next) => {
  try {
    const data = templateSchema.partial().parse(req.body);
    const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw AppError.notFound('Template not found');

    const subject = data.subject ?? existing.subject;
    const body = data.body ?? existing.body;

    const template = await prisma.emailTemplate.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.mailboxId !== undefined ? { mailboxId: data.mailboxId } : {}),
        variables: detectVariables(subject, body),
      },
    });
    res.json({ template });
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    next(error);
  }
});

// ─── DELETE /api/email/templates/:id ─────────────────────────────
router.delete('/templates/:id', async (req: Request, res: Response, next) => {
  try {
    await prisma.emailTemplate.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
