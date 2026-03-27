import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// ─── GET /api/settings ───────────────────────────────────────────
// Public endpoint for guest users to see agency branding

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    // Get the singleton settings row (there should only be one)
    let settings = await prisma.agencySettings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.agencySettings.create({
        data: {
          agencyName: 'My Agency',
          adminEmail: 'admin@agency.com',
          currency: 'USD',
          timezone: 'UTC',
          taxRate: 0,
        },
      });
    }

    // Parse JSON fields for the response
    res.json({
      settings: {
        ...settings,
        paymentMethods: settings.paymentMethods ? JSON.parse(settings.paymentMethods) : [],
        socialLinks: settings.socialLinks ? JSON.parse(settings.socialLinks) : {},
        notifications: settings.notifications ? JSON.parse(settings.notifications) : {},
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/settings ───────────────────────────────────────────

router.put('/', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    let existing = await prisma.agencySettings.findFirst();

    // If no settings exist yet, create a default row first
    if (!existing) {
      existing = await prisma.agencySettings.create({
        data: {
          agencyName: 'My Agency',
          adminEmail: 'admin@agency.com',
          currency: 'USD',
          timezone: 'UTC',
          taxRate: 0,
        },
      });
    }

    const { 
      paymentMethods, 
      socialLinks, 
      notifications, 
      id, 
      createdAt, 
      updatedAt, 
      taxRate,
      ...rest 
    } = req.body;

    const settings = await prisma.agencySettings.update({
      where: { id: existing.id },
      data: {
        ...rest,
        taxRate: taxRate !== undefined ? Number(taxRate) : undefined,
        ...(paymentMethods !== undefined && { paymentMethods: JSON.stringify(paymentMethods) }),
        ...(socialLinks !== undefined && { socialLinks: JSON.stringify(socialLinks) }),
        ...(notifications !== undefined && { notifications: JSON.stringify(notifications) }),
      },
    });

    res.json({
      settings: {
        ...settings,
        paymentMethods: settings.paymentMethods ? JSON.parse(settings.paymentMethods) : [],
        socialLinks: settings.socialLinks ? JSON.parse(settings.socialLinks) : {},
        notifications: settings.notifications ? JSON.parse(settings.notifications) : {},
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
