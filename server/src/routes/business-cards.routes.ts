import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { getShortDomainBase } from '../lib/short-url.js';
import { isWalletConfigured, pushWalletUpdate, walletLinkToken } from '../lib/wallet-pass.js';

// CRM → Business Cards (admin side). Mounted behind authenticate + 'business_cards' module.
// Public pages are served by card.routes.ts.

const router = Router();

const optional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

const cardSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, 'Use 1–40 lowercase letters, numbers or dashes'),
  enabled: z.boolean(),
  memberId: z.string().uuid().optional().nullable().transform((v) => v || null),
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  phone: optional(40),
  whatsapp: optional(40),
  email: z.string().trim().email().max(190).optional().nullable().or(z.literal('')).transform((v) => v || null),
  photoUrl: optional(2000),
  bio: optional(1000),
});

async function assertSlugFree(slug: string, exceptId?: string) {
  const taken = await prisma.businessCard.findFirst({
    where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw AppError.conflict('That card link is already used by another card');
}

// ─── GET /api/business-cards ──────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const cards = await prisma.businessCard.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    });
    res.json({ cards });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/business-cards/:id ──────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const card = await prisma.businessCard.findUnique({
      where: { id: req.params.id as string },
      include: { leads: { orderBy: { createdAt: 'desc' }, take: 500 } },
    });
    if (!card) throw AppError.notFound('Business card not found');
    // Link to send the employee: opens their card with an "Add to Apple Wallet" button
    const walletLink = isWalletConfigured() ? `${getShortDomainBase()}/c/${card.slug}?wallet=${walletLinkToken(card.id)}` : null;
    res.json({ card, walletLink });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/business-cards ─────────────────────────────────────

router.post('/', validate({ body: cardSchema }), async (req: Request, res: Response, next) => {
  try {
    await assertSlugFree(req.body.slug);
    const card = await prisma.businessCard.create({ data: req.body });
    res.status(201).json({ card });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/business-cards/:id ──────────────────────────────────

router.put('/:id', validate({ body: cardSchema }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    await assertSlugFree(req.body.slug, id);
    const card = await prisma.businessCard.update({ where: { id }, data: req.body });
    pushWalletUpdate(id).catch((err) => console.error('[wallet] push failed:', err));
    res.json({ card });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/business-cards/:id ───────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await prisma.businessCard.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Business card deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/business-cards/:id/leads/:leadId ─────────────────

router.delete('/:id/leads/:leadId', async (req: Request, res: Response, next) => {
  try {
    await prisma.cardLead.deleteMany({ where: { id: req.params.leadId as string, cardId: req.params.id as string } });
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
