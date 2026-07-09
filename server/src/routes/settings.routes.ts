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
import { sendEmail, maskApiKey } from '../lib/email.js';

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
  resendApiKey: z.string().optional().nullable(),
  emailFrom: z.preprocess((val) => val === '' ? null : val, z.string().email().optional().nullable()),
  mailerName: z.string().optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().optional().nullable(),
  smtpUsername: z.string().optional().nullable(),
  smtpEncryption: z.string().optional().nullable(),
  smtpDriver: z.string().optional().nullable(),
  mailEnabled: z.boolean().optional(),
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

// ─── GET /api/settings/email ─────────────────────────────────────
// Returns masked key status. Never exposes the full key.

router.get('/email', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();

    // Prefer DB value, fall back to env var
    const rawKey = settings?.resendApiKey ?? process.env.RESEND_API_KEY ?? null;
    const emailFrom = settings?.emailFrom ?? process.env.EMAIL_FROM ?? null;

    res.json({
      configured: !!rawKey,
      maskedKey: maskApiKey(rawKey),
      emailFrom,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/settings/email ────────────────────────────────────
// Save Resend API key + sender address. Writes to DB and syncs process.env
// so the change takes effect immediately without a restart.

const emailSettingsSchema = z.object({
  resendApiKey: z.string().min(1).startsWith('re_', 'API key must start with re_'),
  emailFrom: z.preprocess((val) => val === '' ? undefined : val, z.string().email('Must be a valid email address').optional()),
});

router.post('/email', authenticate, requireAdmin, validate({ body: emailSettingsSchema }), async (req: Request, res: Response, next) => {
  try {
    const { resendApiKey, emailFrom } = req.body;

    // Persist to DB
    let existing = await prisma.agencySettings.findFirst();
    if (!existing) {
      existing = await prisma.agencySettings.create({
        data: { agencyName: 'My Agency', adminEmail: 'admin@agency.com', currency: 'USD', timezone: 'UTC', taxRate: 0 },
      });
    }

    await prisma.agencySettings.update({
      where: { id: existing.id },
      data: {
        resendApiKey,
        ...(emailFrom !== undefined ? { emailFrom } : {}),
      },
    });

    // Sync into process.env so the running process picks them up immediately
    process.env.RESEND_API_KEY = resendApiKey;
    if (emailFrom) process.env.EMAIL_FROM = emailFrom;

    const updatedKey = process.env.RESEND_API_KEY;
    res.json({
      success: true,
      maskedKey: maskApiKey(updatedKey),
      emailFrom: process.env.EMAIL_FROM ?? null,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/settings/email/test ───────────────────────────────
// Sends a test email to the admin's address so they can confirm delivery.

router.post('/email/test', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();

    // Apply DB key to process.env if not already there
    if (settings?.resendApiKey && !process.env.RESEND_API_KEY) {
      process.env.RESEND_API_KEY = settings.resendApiKey;
    }
    if (settings?.emailFrom && !process.env.EMAIL_FROM) {
      process.env.EMAIL_FROM = settings.emailFrom;
    }

    if (!process.env.RESEND_API_KEY) {
      throw AppError.badRequest('Resend API key is not configured. Save it in Email Settings first.');
    }

    const adminEmail = settings?.adminEmail ?? req.user!.email;
    const agencyName = settings?.agencyName ?? 'Agency Flow Pro';

    const result = await sendEmail({
      to: adminEmail,
      subject: `✅ Test email from ${agencyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a2e;">Email delivery confirmed ✓</h2>
          <p>This is a test message sent from <strong>${agencyName}</strong> via Resend.</p>
          <p>If you received this, your email integration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 13px;">Sent by Agency Flow Pro · Admin Settings</p>
        </div>
      `,
    });

    if (!result.success) {
      throw AppError.badRequest(result.error ?? 'Test email failed to send. Check your API key and sender address.');
    }

    res.json({ success: true, sentTo: adminEmail, emailId: result.id });
  } catch (error) {
    next(error);
  }
});

export default router;
