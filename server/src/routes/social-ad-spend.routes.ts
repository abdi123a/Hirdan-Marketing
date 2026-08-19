// Manual monthly ad-spend entry.
//
// None of the connected platforms expose ad spend through the organic insights
// APIs this app uses — reading it would mean a separate Ads API integration per
// platform, each behind its own business verification. These hand-entered rows
// are therefore the only source for the monthly report's Paid & Organic section.

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { dollarsToCents } from '../lib/money.js';

const router = Router();

const PLATFORMS = new Set([
  'facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'x', 'threads', 'pinterest',
]);

function parseBody(body: any): {
  ok: true;
  data: {
    platform: string; month: number; year: number; spendCents: number; currency: string;
    paidReach: number | null; linkClicks: number | null; paidEngagement: number | null;
    messagesStarted: number | null; notes: string | null;
  };
} | { ok: false; error: string } {
  const platform = String(body.platform || '').toLowerCase();
  if (!PLATFORMS.has(platform)) return { ok: false, error: 'Unknown platform' };

  const month = Number(body.month);
  const year = Number(body.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, error: 'Month must be 1-12' };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: 'Year is out of range' };

  const spend = Number(body.spend);
  if (!Number.isFinite(spend) || spend < 0) return { ok: false, error: 'Spend must be a positive number' };

  const optionalInt = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };

  return {
    ok: true,
    data: {
      platform,
      month,
      year,
      spendCents: dollarsToCents(spend),
      currency: String(body.currency || 'USD').toUpperCase().slice(0, 8),
      paidReach: optionalInt(body.paidReach),
      linkClicks: optionalInt(body.linkClicks),
      paidEngagement: optionalInt(body.paidEngagement),
      messagesStarted: optionalInt(body.messagesStarted),
      notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    },
  };
}

// ── List spend rows, optionally scoped to a client / period ──────────────────
router.get('/ad-spend', async (req, res, next) => {
  try {
    const { clientId, month, year } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const rows = await prisma.socialAdSpend.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { platform: 'asc' }],
      include: { client: { select: { id: true, name: true, company: true } } },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── Create or replace the row for a (client, platform, month, year) ──────────
router.post('/ad-spend', async (req, res, next) => {
  try {
    const { clientId } = req.body as { clientId?: string };
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }

    const parsed = parseBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const { platform, month, year, ...rest } = parsed.data;
    const row = await prisma.socialAdSpend.upsert({
      where: { clientId_platform_month_year: { clientId, platform, month, year } },
      create: { clientId, platform, month, year, ...rest, createdById: req.user?.userId ?? null },
      update: { ...rest },
    });

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// ── Delete one row ───────────────────────────────────────────────────────────
router.delete('/ad-spend/:id', async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.socialAdSpend.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    await prisma.socialAdSpend.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
