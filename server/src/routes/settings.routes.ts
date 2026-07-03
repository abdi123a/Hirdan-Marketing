import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { PATHS } from '../lib/paths.js';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    // All branding uploads go to the branding folder
    // (files.routes.ts serves them via /:folder/:filename + auth)
    cb(null, PATHS.BRANDING);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

const router = Router();

// ─── GET /api/settings/public ───────────────────────────────────────────

router.get('/public', async (req: Request, res: Response, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();

    if (!settings) {
      res.json({ settings: { enableRecaptcha: false } });
      return;
    }

    res.json({
      settings: {
        agencyName: settings.agencyName,
        logo: settings.logo,
        whiteLogo: settings.whiteLogo,
        favicon: settings.favicon,
        primaryColor: settings.primaryColor,
        enableRecaptcha: settings.enableRecaptcha,
        recaptchaSiteKey: settings.recaptchaSiteKey,
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/settings ───────────────────────────────────────────
// Public endpoint for guest users to see agency branding

router.get('/', async (req: Request, res: Response, next) => {
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

    // Determine if requester is an admin
    let isAdmin = false;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        if (decoded.role === 'ADMIN') isAdmin = true;
      }
    } catch (e) {
      // Ignore token errors; default to guest access
    }

    if (isAdmin) {
      // Parse JSON fields for the full response
      res.json({
        settings: {
          ...settings,
          paymentMethods: settings.paymentMethods ? JSON.parse(settings.paymentMethods) : [],
          socialLinks: settings.socialLinks ? JSON.parse(settings.socialLinks) : {},
          notifications: settings.notifications ? JSON.parse(settings.notifications) : {},
        },
      });
    } else {
      // Expose ONLY safe public fields for guest/client branding
      res.json({
        settings: {
          agencyName: settings.agencyName,
          adminEmail: settings.adminEmail,
          phone: settings.phone,
          website: settings.website,
          address: settings.address,
          currency: settings.currency,
          timezone: settings.timezone,
          logo: settings.logo,
          whiteLogo: settings.whiteLogo,
          favicon: settings.favicon,
          primaryColor: settings.primaryColor,
          signature: settings.signature,
          stamp: settings.stamp,
          enableRecaptcha: settings.enableRecaptcha,
          recaptchaSiteKey: settings.recaptchaSiteKey,
          recaptchaSecretKey: settings.recaptchaSecretKey,
          socialLinks: settings.socialLinks ? JSON.parse(settings.socialLinks) : {},
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/settings ───────────────────────────────────────────

const settingsDtoSchema = z.object({
  agencyName: z.string().optional(),
  adminEmail: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  logo: z.string().optional().nullable(),
  whiteLogo: z.string().optional().nullable(),
  favicon: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  taxRate: z.number().optional().nullable(),
  defaultInvoiceNotes: z.string().optional().nullable(),
  paymentMethods: z.any().optional(),   // JSON arrays stored as strings
  socialLinks: z.any().optional(),      // JSON objects stored as strings
  notifications: z.any().optional(),    // JSON objects stored as strings
  signature: z.string().optional().nullable(),
  stamp: z.string().optional().nullable(),
  enableRecaptcha: z.boolean().optional(),
  recaptchaSiteKey: z.string().optional().nullable(),
  recaptchaSecretKey: z.string().optional().nullable(),
  openAiApiKey: z.string().optional().nullable(),
  id: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

router.put('/', authenticate, requireAdmin, validate({ body: settingsDtoSchema }), async (req: Request, res: Response, next) => {
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

// ─── POST /api/settings/upload ───────────────────────────────────

router.post('/upload', authenticate, requireAdmin, upload.single('file'), async (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      throw AppError.badRequest('No file uploaded');
    }

    // All branding assets are stored under /uploads/branding/
    const fileUrl = `/uploads/branding/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
});

export default router;
