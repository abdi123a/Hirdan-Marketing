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
import { execSync } from 'child_process';

import { PATHS } from '../lib/paths.js';
import { sendEmail, maskApiKey, generateEmailHtml } from '../lib/email.js';
import { enforceMagicBytes } from '../lib/upload.js';

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
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (.png, .jpg, .jpeg, .webp, .gif)'));
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
        googleAnalyticsEnabled: settings.googleAnalyticsEnabled,
        googleAnalyticsMeasurementId: settings.googleAnalyticsMeasurementId,
        developmentMode: settings.developmentMode,
        comingSoonMessage: settings.comingSoonMessage,
        comingSoonCountdown: settings.comingSoonCountdown,
        comingSoonBullets: settings.comingSoonBullets,
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/settings ───────────────────────────────────────────
// Public endpoint for guest users to see agency branding.
// Authenticated staff/admin users receive all fields including
// sensitive API keys and mail config.  A `_isAdminResponse` flag is
// included so the frontend can tell whether the sensitive fields
// were intentionally returned or simply absent from a guest response.

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

    // Determine if requester is an authenticated staff member or admin
    let isStaffOrAdmin = false;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        if (['ADMIN', 'MANAGER', 'STAFF'].includes(decoded.role)) {
          isStaffOrAdmin = true;
        }
      }
    } catch (e) {
      // Token expired or invalid — fall back to guest access silently.
      // This is expected for unauthenticated requests (login page, etc.).
    }

    if (isStaffOrAdmin) {
      // Parse JSON fields for the full response.
      // Include `_isAdminResponse: true` so the frontend store knows
      // that sensitive fields (API keys, mail config) are genuinely
      // present in this response — even when their value is null.
      res.json({
        settings: {
          ...settings,
          _isAdminResponse: true,
          paymentMethods: settings.paymentMethods ? JSON.parse(settings.paymentMethods) : [],
          socialLinks: settings.socialLinks ? JSON.parse(settings.socialLinks) : {},
          notifications: settings.notifications ? JSON.parse(settings.notifications) : {},
        },
      });
    } else {
      // Expose ONLY safe public fields for guest/client branding.
      // `_isAdminResponse` is intentionally omitted (undefined) so the
      // frontend knows NOT to overwrite sensitive fields from this response.
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
          hrFallbackApproverId: (settings as any).hrFallbackApproverId,
          enableRecaptcha: settings.enableRecaptcha,
          recaptchaSiteKey: settings.recaptchaSiteKey,
          recaptchaSecretKey: settings.recaptchaSecretKey,
          googleAnalyticsEnabled: settings.googleAnalyticsEnabled,
          googleAnalyticsMeasurementId: settings.googleAnalyticsMeasurementId,
          developmentMode: settings.developmentMode,
          comingSoonMessage: settings.comingSoonMessage,
          comingSoonCountdown: settings.comingSoonCountdown,
          comingSoonBullets: settings.comingSoonBullets,
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
  hrFallbackApproverId: z.string().optional().nullable(),
  enableRecaptcha: z.boolean().optional(),
  recaptchaSiteKey: z.string().optional().nullable(),
  recaptchaSecretKey: z.string().optional().nullable(),
  googleAnalyticsEnabled: z.boolean().optional(),
  googleAnalyticsMeasurementId: z.string().optional().nullable(),
  developmentMode: z.boolean().optional(),
  comingSoonMessage: z.string().optional().nullable(),
  comingSoonCountdown: z.string().optional().nullable(),
  comingSoonBullets: z.string().optional().nullable(),
  openAiApiKey: z.string().optional().nullable(),
  claudeApiKey: z.string().optional().nullable(),
  geminiApiKey: z.string().optional().nullable(),
  mainAiProvider: z.enum(['openai', 'claude', 'gemini']).optional(),
  // Allow empty string (stored as null) — actual re_ check is done in /settings/email
  resendApiKey: z.preprocess((val) => val === '' ? null : val, z.string().optional().nullable()),
  // Coerce empty string → null, validate email format only when non-null
  emailFrom: z.preprocess(
    (val) => (val === '' || val === undefined) ? null : val,
    z.string().email('Must be a valid email address').optional().nullable()
  ),
  mailerName: z.string().optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  // Coerce string → number → null so HTML number inputs don't cause type errors
  smtpPort: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    },
    z.number().int().positive().optional().nullable()
  ),
  smtpUsername: z.string().optional().nullable(),
  smtpEncryption: z.string().optional().nullable(),
  smtpDriver: z.string().optional().nullable(),
  mailEnabled: z.boolean().optional(),
  googleDriveFolderId: z.string().optional().nullable(),
  googleDriveServiceAccountJson: z.string().optional().nullable(),
  googleDriveClientId: z.string().optional().nullable(),
  googleDriveClientSecret: z.string().optional().nullable(),
  googleDriveRefreshToken: z.string().optional().nullable(),
  googleDriveEnabled: z.boolean().optional(),
  oneSignalAppId: z.string().optional().nullable(),
  oneSignalApiKey: z.string().optional().nullable(),
  oneSignalEnabled: z.boolean().optional(),
  metaEnabled: z.boolean().optional(),
  tiktokEnabled: z.boolean().optional(),
  linkedinEnabled: z.boolean().optional(),
  googleEnabled: z.boolean().optional(),
  xEnabled: z.boolean().optional(),
  pinterestEnabled: z.boolean().optional(),
  id: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Frontend-only fields — declared here so .strip() removes them silently
  // instead of throwing "Unrecognized key(s)" ZodError
  appVersion: z.string().optional(),
  versionHistory: z.array(z.any()).optional(),
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

    // Safeguard: strip empty-string, null, or undefined values for sensitive fields so a
    // frontend that loaded defaults (because it received a guest/public
    // response) doesn't accidentally wipe real API keys and credentials from the DB.
    // Sending `undefined` tells Prisma to skip updating the column.
    const sensitiveKeys = [
      'openAiApiKey', 'claudeApiKey', 'geminiApiKey',
      'resendApiKey', 'emailFrom', 'mailerName',
      'smtpHost', 'smtpPort', 'smtpUsername', 'smtpEncryption', 'smtpDriver',
      'googleDriveFolderId', 'googleDriveServiceAccountJson',
      'googleDriveClientId', 'googleDriveClientSecret', 'googleDriveRefreshToken',
      'oneSignalAppId', 'oneSignalApiKey', 'recaptchaSecretKey'
    ] as const;
    for (const key of sensitiveKeys) {
      if (rest[key] === '' || rest[key] === null || rest[key] === undefined) {
        rest[key] = undefined;
      }
    }

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

router.post('/upload', authenticate, requireAdmin, upload.single('file'), enforceMagicBytes({ kind: 'media' }), async (req: Request, res: Response, next) => {
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
// Sends a test email to the specified or admin's address so they can confirm delivery.

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

    // Accept custom recipient from body, fallback to settings adminEmail or request user's email
    const { to } = req.body;
    const testRecipient = to || settings?.adminEmail || req.user!.email;
    const agencyName = settings?.agencyName ?? 'Hirdan Marketing';

    const emailHtml = await generateEmailHtml({
      title: 'Email Delivery Test',
      preheader: 'Your email integration is working correctly.',
      contentHtml: `
        <h2 style="color: #1e293b; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">Email Integration Successful! ✓</h2>
        <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">This is a test message sent from your dashboard to confirm that your email delivery configuration is fully operational.</p>
        <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">Your custom branding (including company logo, site color palette, and physical address details) has been automatically applied to this message template.</p>
      `,
      actionButton: {
        label: 'Go to Settings',
        url: `${process.env.FRONTEND_URL || 'https://app.hirdanmarketing.com'}/settings`
      }
    });

    const result = await sendEmail({
      to: testRecipient,
      subject: `✅ Test email from ${agencyName}`,
      html: emailHtml,
    });

    if (!result.success) {
      throw AppError.badRequest(result.error ?? 'Test email failed to send. Check your API key and sender address.');
    }

    res.json({ success: true, sentTo: testRecipient, emailId: result.id });
  } catch (error) {
    next(error);
  }
});

// ─── GOOGLE DRIVE HELPER ──────────────────────────────────────────
async function uploadToGoogleDrive(
  filePath: string,
  filename: string,
  serviceAccountJsonStr: string | null | undefined,
  folderId: string | null | undefined,
  oauthConfig?: {
    clientId?: string | null;
    clientSecret?: string | null;
    refreshToken?: string | null;
  }
) {
  let accessToken: string;

  if (oauthConfig && oauthConfig.clientId && oauthConfig.clientSecret && oauthConfig.refreshToken) {
    // OAuth 2.0 User Authentication Flow
    const authResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        refresh_token: oauthConfig.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      throw new Error(`Google OAuth token refresh failed: ${errText}`);
    }

    const authData = await authResponse.json() as any;
    accessToken = authData.access_token;
  } else {
    // Service Account Flow
    if (!serviceAccountJsonStr) {
      throw new Error('Google Drive integration is not configured. Configure OAuth 2.0 or Service Account first.');
    }
    const credentials = JSON.parse(serviceAccountJsonStr);
    const clientEmail = credentials.client_email;
    const privateKey = credentials.private_key;

    if (!clientEmail || !privateKey) {
      throw new Error('Invalid Google Service Account JSON structure. Ensure client_email and private_key are present.');
    }

    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    const authResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      })
    });

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      throw new Error(`Google Auth failed: ${errText}`);
    }

    const authData = await authResponse.json() as any;
    accessToken = authData.access_token;
  }

  const fileContent = fs.readFileSync(filePath);
  const metadata = {
    name: filename,
    parents: folderId ? [folderId] : undefined
  };

  const boundary = 'foo_bar_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const requestBody = Buffer.concat([
    Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)),
    Buffer.from(delimiter + 'Content-Type: application/octet-stream\r\n\r\n'),
    fileContent,
    Buffer.from(closeDelimiter)
  ]);

  const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': requestBody.length.toString()
    },
    body: requestBody
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Google Drive upload failed: ${errText}`);
  }

  const uploadData = await uploadResponse.json() as any;
  return uploadData.id;
}

// ─── GET /api/settings/backups ────────────────────────────────────
// Lists all local backup files.
router.get('/backups', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const backupDir = path.resolve(__dirname, '../../backups');

    if (!fs.existsSync(backupDir)) {
      res.json({ backups: [] });
      return;
    }

    const files = fs.readdirSync(backupDir);
    const backups = files
      .filter(file => file.startsWith('backup_') && file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({ backups });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/settings/backups ───────────────────────────────────
// Manually triggers a database backup and uploads to Google Drive if configured.
router.post('/backups', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.resolve(__dirname, '../../scripts/backup.cjs');

    console.log('⚡ Triggering database backup script...');
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });

    // Find the latest backup file created
    const backupDir = path.resolve(__dirname, '../../backups');
    const files = fs.readdirSync(backupDir);
    const sqlFiles = files
      .filter(file => file.startsWith('backup_') && file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return { filename: file, path: filePath, createdAt: stats.mtime };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (sqlFiles.length === 0) {
      throw AppError.badRequest('Failed to generate local backup file.');
    }

    const latestBackup = sqlFiles[0];

    // Check if Google Drive integration is configured
    const settings = await prisma.agencySettings.findFirst();
    let uploadedToGDrive = false;
    let gDriveFileId = undefined;
    let uploadError = undefined;

    const hasServiceAccount = !!settings?.googleDriveServiceAccountJson;
    const hasOAuth = !!(settings?.googleDriveClientId && settings?.googleDriveClientSecret && settings?.googleDriveRefreshToken);

    if (settings?.googleDriveEnabled && (hasServiceAccount || hasOAuth)) {
      try {
        console.log('☁️ Auto-uploading backup to Google Drive...');
        gDriveFileId = await uploadToGoogleDrive(
          latestBackup.path,
          latestBackup.filename,
          settings.googleDriveServiceAccountJson,
          settings.googleDriveFolderId,
          {
            clientId: settings.googleDriveClientId,
            clientSecret: settings.googleDriveClientSecret,
            refreshToken: settings.googleDriveRefreshToken,
          }
        );
        uploadedToGDrive = true;
      } catch (err: any) {
        console.error('❌ Google Drive auto-upload failed:', err.message);
        uploadError = err.message;
      }
    }

    res.json({
      success: true,
      filename: latestBackup.filename,
      uploadedToGDrive,
      gDriveFileId,
      uploadError
    });
  } catch (error: any) {
    next(error);
  }
});

// ─── POST /api/settings/backups/gdrive-oauth-callback ───────────────
// Exchanges OAuth 2.0 authorization code for refresh token and saves it.
router.post('/backups/gdrive-oauth-callback', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      throw AppError.badRequest('Authorization code and redirect URI are required.');
    }

    const settings = await prisma.agencySettings.findFirst();
    if (!settings?.googleDriveClientId || !settings?.googleDriveClientSecret) {
      throw AppError.badRequest('Google Client ID and Client Secret must be configured first.');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: settings.googleDriveClientId,
        client_secret: settings.googleDriveClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData = await tokenResponse.json() as any;
    const { refresh_token } = tokenData;

    if (!refresh_token) {
      if (!settings.googleDriveRefreshToken) {
        throw new Error('No refresh token returned by Google. Try revoking app access and authenticating again.');
      }
    }

    await prisma.agencySettings.update({
      where: { id: settings.id },
      data: {
        googleDriveRefreshToken: refresh_token || settings.googleDriveRefreshToken,
        googleDriveEnabled: true
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// ─── POST /api/settings/backups/gdrive-test ───────────────────────
// Tests Google Drive integration by uploading a small test file.
router.post('/backups/gdrive-test', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { serviceAccountJson, folderId } = req.body;
    const settings = await prisma.agencySettings.findFirst();

    const hasServiceAccount = !!(serviceAccountJson || settings?.googleDriveServiceAccountJson);
    const hasOAuth = !!(settings?.googleDriveClientId && settings?.googleDriveClientSecret && settings?.googleDriveRefreshToken);

    if (!hasServiceAccount && !hasOAuth) {
      throw AppError.badRequest('Google Drive integration is not configured. Configure OAuth 2.0 or Service Account JSON key first.');
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const testFilePath = path.join(__dirname, 'gdrive-test.txt');
    fs.writeFileSync(testFilePath, `Connection test successful! Created at: ${new Date().toISOString()}`);

    try {
      const gDriveFileId = await uploadToGoogleDrive(
        testFilePath,
        'connection_test.txt',
        serviceAccountJson || settings?.googleDriveServiceAccountJson,
        folderId || settings?.googleDriveFolderId,
        {
          clientId: settings?.googleDriveClientId,
          clientSecret: settings?.googleDriveClientSecret,
          refreshToken: settings?.googleDriveRefreshToken,
        }
      );

      // Clean up local test file
      fs.unlinkSync(testFilePath);

      res.json({ success: true, fileId: gDriveFileId });
    } catch (err: any) {
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
      throw AppError.badRequest(err.message || 'Google Drive test failed.');
    }
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/settings/backups/:filename/download ─────────────────
// Downloads a specific local backup file.
router.get('/backups/:filename/download', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const filename = req.params.filename as string;

    // Security: Prevent path traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw AppError.badRequest('Invalid backup filename.');
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(__dirname, '../../backups', filename);

    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('Backup file not found.');
    }

    res.download(filePath, filename);
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/settings/backups/:filename/upload-gdrive ────────────
// Manually uploads an existing local backup to Google Drive.
router.post('/backups/:filename/upload-gdrive', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const filename = req.params.filename as string;

    // Security check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw AppError.badRequest('Invalid backup filename.');
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(__dirname, '../../backups', filename);

    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('Backup file not found.');
    }

    const settings = await prisma.agencySettings.findFirst();
    const hasServiceAccount = !!settings?.googleDriveServiceAccountJson;
    const hasOAuth = !!(settings?.googleDriveClientId && settings?.googleDriveClientSecret && settings?.googleDriveRefreshToken);

    if (!hasServiceAccount && !hasOAuth) {
      throw AppError.badRequest('Google Drive integration is not configured. Configure OAuth 2.0 or Service Account JSON key first.');
    }

    const fileId = await uploadToGoogleDrive(
      filePath,
      filename,
      settings.googleDriveServiceAccountJson,
      settings.googleDriveFolderId,
      {
        clientId: settings.googleDriveClientId,
        clientSecret: settings.googleDriveClientSecret,
        refreshToken: settings.googleDriveRefreshToken,
      }
    );

    res.json({ success: true, fileId });
  } catch (error: any) {
    next(error);
  }
});

// ─── POST /api/settings/backups/:filename/restore ─────────────────
// Restores the database from a local backup file.
router.post('/backups/:filename/restore', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const filename = req.params.filename as string;

    // Security check: Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw AppError.badRequest('Invalid backup filename.');
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(__dirname, '../../backups', filename);

    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('Backup file not found.');
    }

    const scriptPath = path.resolve(__dirname, '../../scripts/restore.cjs');

    console.log(`⚡ Triggering database restore script for ${filename}...`);
    execSync(`node "${scriptPath}" "${filename}"`, { stdio: 'inherit' });

    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// ─── DELETE /api/settings/backups/:filename ───────────────────────
// Deletes a local backup file.
router.delete('/backups/:filename', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const filename = req.params.filename as string;

    // Security check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw AppError.badRequest('Invalid backup filename.');
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(__dirname, '../../backups', filename);

    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('Backup file not found.');
    }

    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
