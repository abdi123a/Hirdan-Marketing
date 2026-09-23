import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { auditLog } from '../lib/audit.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { getShortDomainBase } from '../lib/short-url.js';
import {
  passwordSchema,
  decideRefreshReuse,
  refreshFamilyOf,
} from '../lib/auth-security.js';

const router = Router();

// ─── Rate Limiter ───────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: true, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: true, message: 'Too many refresh attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 reset requests per IP per hour
  message: { error: true, message: 'Too many password reset requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}


// ─── Validation Schemas ───────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  recaptchaToken: z.string().optional(),
});

const clientLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  recaptchaToken: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1),
});

// ─── Session / lockout policy ─────────────────────────────────────

/** A login session can never outlive this, however often it is refreshed. */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Failed logins allowed before the account is temporarily locked. */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MAX_MINUTES = 60;

/** One message for every failed login (unknown email, wrong password, locked). */
const INVALID_LOGIN_MESSAGE =
  'Invalid email or password. After several failed attempts, sign-in is paused for a few minutes.';

/** Compared against when the email is unknown so response time doesn't reveal it. */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Helper: Generate Tokens ─────────────────────────────────────

function generateAccessToken(payload: any) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

function generateRefreshToken(payload: any) {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
}

function getRefreshTokenExpiry(): Date {
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days

  const value = parseInt(match[1]);
  const unit = match[2];
  const ms = unit === 'd' ? value * 86400000
           : unit === 'h' ? value * 3600000
           : unit === 'm' ? value * 60000
           : value * 1000;

  return new Date(Date.now() + ms);
}

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Relax for subdomains
  domain: env.COOKIE_DOMAIN, // Share across subdomains (e.g., '.hirdanmarketing.com')
  path: '/',
};

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
}

/** True when the client is the native mobile app (not the web dashboard). */
function isMobileClient(req: Request): boolean {
  const platform = String(req.headers['x-client-platform'] || '').toLowerCase();
  return platform === 'mobile' || platform === 'ios' || platform === 'android';
}

/**
 * Native clients send the refresh token in the JSON body; the web dashboard
 * relies on the httpOnly cookie. `fromBody` tells callers whether the token
 * may be echoed back in JSON (never for a cookie-borne token).
 */
function getRefreshTokenFromRequest(req: Request): { token: string; fromBody: boolean } | undefined {
  const fromBody = req.body?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.length > 0) return { token: fromBody, fromBody: true };
  const fromCookie = req.cookies?.refreshToken;
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return { token: fromCookie, fromBody: false };
  return undefined;
}

function authTokenResponse(
  accessToken: string,
  refreshToken: string,
  includeRefreshToken: boolean,
  extra: Record<string, unknown> = {}
) {
  const payload: Record<string, unknown> = { accessToken, ...extra };
  if (includeRefreshToken) {
    payload.refreshToken = refreshToken;
  }
  return payload;
}

type SessionUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';
  mustChangePassword: boolean;
  client?: { id: string; company: string } | null;
};

function buildTokenPayload(user: SessionUser) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    clientId: user.client?.id,
    company: user.client?.company,
    mustChangePassword: !!user.mustChangePassword,
  };
}

/**
 * Issue an access token + a rotated refresh token. A new login starts a new
 * family; a refresh continues the presented token's family and keeps its
 * original start time so the absolute lifetime cap holds.
 */
async function issueSession(
  res: Response,
  user: SessionUser,
  family?: { familyId: string; sessionStartedAt: Date }
) {
  const payload = buildTokenPayload(user);
  const familyId = family?.familyId ?? crypto.randomUUID();
  // `sid` binds the access token to this session: once the family's refresh
  // tokens are revoked, `authenticate` rejects the access token as well.
  const accessToken = generateAccessToken({ ...payload, sid: familyId });
  const refreshToken = generateRefreshToken(payload);

  const sessionStartedAt = family?.sessionStartedAt ?? new Date();
  const sessionEnd = new Date(sessionStartedAt.getTime() + SESSION_MAX_AGE_MS);
  const slidingExpiry = getRefreshTokenExpiry();
  const expiresAt = slidingExpiry < sessionEnd ? slidingExpiry : sessionEnd;

  await prisma.refreshToken.create({
    data: {
      token: sha256Hex(refreshToken),
      userId: user.id,
      expiresAt,
      familyId,
      sessionStartedAt,
    },
  });

  setRefreshTokenCookie(res, refreshToken);
  return { accessToken, refreshToken };
}

async function revokeFamily(stored: { id: string; familyId: string | null; userId: string }) {
  // A legacy row (no familyId) seeds a family keyed by its own id on refresh,
  // so revoke both the row itself and anything rotated from it.
  await prisma.refreshToken.deleteMany({
    where: {
      userId: stored.userId,
      OR: [{ id: stored.id }, { familyId: refreshFamilyOf(stored) }],
    },
  });
}

/** Count a failed password for an existing account; lock it with exponential backoff. */
async function registerFailedLogin(userId: string) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });
  const attempts = updated.failedLoginAttempts;
  if (attempts >= LOCKOUT_THRESHOLD) {
    const minutes = Math.min(LOCKOUT_MAX_MINUTES, 2 ** (attempts - LOCKOUT_THRESHOLD));
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + minutes * 60 * 1000) },
    });
  }
}

/**
 * Verify email + password with uniform timing and error text. Account-state
 * checks (disabled, wrong portal, paused client) happen only after the caller
 * has proven the password, so they can't be used to enumerate accounts.
 */
async function verifyCredentials(email: string, password: string, ip: string | undefined) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { client: true },
  });

  const locked = !!user?.lockedUntil && user.lockedUntil > new Date();
  const hash = user && !locked ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || locked || !passwordMatches) {
    if (user && !locked) await registerFailedLogin(user.id);
    auditLog({ action: 'auth.login', success: false, email, ip });
    throw AppError.unauthorized(INVALID_LOGIN_MESSAGE);
  }

  if (user.failedLoginAttempts !== 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  if (!user.isActive) {
    throw AppError.unauthorized('This account has been disabled. Please contact your administrator.');
  }

  return user;
}

// ─── Helper: Verify reCAPTCHA ────────────────────────────────────

async function verifyRecaptcha(
  token: string | undefined,
  options?: { mobile?: boolean }
): Promise<void> {
  const settings = await prisma.agencySettings.findFirst();
  if (!settings?.enableRecaptcha) return;

  const isMobile = Boolean(options?.mobile);
  const mobileKeyConfigured = Boolean(
    settings.recaptchaAndroidSiteKey || settings.recaptchaIosSiteKey
  );

  // Website keys do not work inside the native app. Until Application-type
  // keys are configured, allow mobile logins without a web v3 token.
  if (isMobile && !mobileKeyConfigured) return;

  if (!token) throw AppError.badRequest('reCAPTCHA validation required');

  // Application-type tokens must use Enterprise assessments (website secret won't verify them).
  if (isMobile && mobileKeyConfigured) {
    if (!settings.recaptchaEnterpriseProjectId || !env.RECAPTCHA_ENTERPRISE_API_KEY) {
      throw AppError.badRequest(
        'Mobile reCAPTCHA requires GCP project ID and RECAPTCHA_ENTERPRISE_API_KEY'
      );
    }

    const siteKey = settings.recaptchaAndroidSiteKey || settings.recaptchaIosSiteKey;
    if (!siteKey) throw AppError.badRequest('reCAPTCHA mobile site key is not configured');

    const url =
      `https://recaptchaenterprise.googleapis.com/v1/projects/` +
      `${encodeURIComponent(settings.recaptchaEnterpriseProjectId)}/assessments` +
      `?key=${encodeURIComponent(env.RECAPTCHA_ENTERPRISE_API_KEY)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          token,
          siteKey,
          expectedAction: 'LOGIN',
        },
      }),
    });

    const data = (await response.json()) as any;
    const valid = data?.tokenProperties?.valid === true;
    const score = typeof data?.riskAnalysis?.score === 'number' ? data.riskAnalysis.score : 0;
    console.log('[reCAPTCHA Enterprise] valid=%s score=%s invalidReason=%s', valid, score, data?.tokenProperties?.invalidReason);
    if (!valid || score < 0.3) {
      throw AppError.unauthorized('reCAPTCHA verification failed or score too low');
    }
    return;
  }

  // Classic siteverify for website v3 keys
  if (!settings.recaptchaSecretKey) return;

  const params = new URLSearchParams();
  params.append('secret', settings.recaptchaSecretKey);
  params.append('response', token);

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await response.json()) as any;
  if (!data.success || (typeof data.score === 'number' && data.score < 0.5)) {
    throw AppError.unauthorized('reCAPTCHA verification failed or score too low');
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email, password, recaptchaToken } = req.body;
      const ip = req.ip;

      await verifyRecaptcha(recaptchaToken, { mobile: isMobileClient(req) });

      const user = await verifyCredentials(email, password, ip);

      // Prevent clients from using the admin login portal (only revealed after a correct password)
      if (user.role === 'CLIENT') {
        throw AppError.unauthorized('This login is for agency staff only. Please use the Client Portal to log in.');
      }

      auditLog({ action: 'auth.login', success: true, userId: user.id, email: user.email, role: user.role, ip });
      const { accessToken, refreshToken } = await issueSession(res, user);

      const { resolvePermissions } = await import('../lib/permissions.js');
      const resolvedPermissions = resolvePermissions(
        user.role,
        (user as any).permissions || null
      );

      res.json(
        authTokenResponse(accessToken, refreshToken, isMobileClient(req), {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: (user as any).permissions || null,
            resolvedPermissions,
            requiresPasswordChange: !!user.mustChangePassword,
            mustChangePassword: !!user.mustChangePassword,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/auth/client-login ──────────────────────────────────

router.post(
  '/client-login',
  authLimiter,
  validate({ body: clientLoginSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email, password, recaptchaToken } = req.body;
      const ip = req.ip;

      await verifyRecaptcha(recaptchaToken, { mobile: isMobileClient(req) });

      const user = await verifyCredentials(email, password, ip);

      if (user.role !== 'CLIENT' || !user.client) {
        throw AppError.unauthorized('This login is for clients. Agency staff should use the staff login.');
      }

      if (user.client.status === 'PAUSED' || user.client.status === 'CHURNED') {
        throw AppError.unauthorized('Your account is currently inactive. Please contact support.');
      }

      auditLog({ action: 'auth.login', success: true, userId: user.id, email: user.email, role: user.role, ip });
      const { accessToken, refreshToken } = await issueSession(res, user);

      res.json(
        authTokenResponse(accessToken, refreshToken, isMobileClient(req), {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.client.id,
            company: user.client.company,
            requiresPasswordChange: !!user.mustChangePassword,
            mustChangePassword: !!user.mustChangePassword,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/auth/change-password (any role) ────────────────────
// ─── POST /api/auth/client-change-password (legacy alias) ─────────

async function changePasswordHandler(req: Request, res: Response, next: (err?: unknown) => void) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const ip = req.ip;

    if (newPassword !== confirmPassword) {
      throw AppError.badRequest('New passwords do not match');
    }
    if (newPassword === currentPassword) {
      throw AppError.badRequest('New password must be different from the current password');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { client: true },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      auditLog({ action: 'auth.password_change', success: false, userId: user.id, ip });
      // 400, not 401: a typo must not look like an expired session to the client.
      throw AppError.badRequest('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      include: { client: true },
    });
    auditLog({ action: 'auth.password_change', success: true, userId: user.id, ip });

    // Sign out every other session; this device gets a fresh one below.
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    const { accessToken, refreshToken } = await issueSession(res, updated);

    res.json(
      authTokenResponse(accessToken, refreshToken, isMobileClient(req), {
        message: 'Password changed successfully',
      })
    );
  } catch (error) {
    next(error);
  }
}

router.post(
  '/change-password',
  authLimiter,
  authenticate,
  validate({ body: changePasswordSchema }),
  changePasswordHandler
);

router.post(
  '/client-change-password',
  authLimiter,
  authenticate,
  validate({ body: changePasswordSchema }),
  changePasswordHandler
);

// ─── POST /api/auth/refresh ───────────────────────────────────────

router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next) => {
  try {
    const presented = getRefreshTokenFromRequest(req);
    if (!presented) {
      throw AppError.badRequest('Refresh token is required');
    }

    // Verify the refresh token
    const decoded = jwt.verify(presented.token, env.JWT_REFRESH_SECRET) as any;

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: sha256Hex(presented.token) },
    });

    const now = new Date();
    if (!storedToken || storedToken.userId !== decoded.userId || storedToken.expiresAt < now) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    if (storedToken.sessionStartedAt.getTime() + SESSION_MAX_AGE_MS < now.getTime()) {
      await revokeFamily(storedToken);
      throw AppError.unauthorized('Session expired. Please log in again.');
    }

    // Rotation: mark the token used (atomically, so concurrent refreshes can't
    // both claim a fresh token) and keep it around for reuse detection.
    const claimed = await prisma.refreshToken.updateMany({
      where: { id: storedToken.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) {
      const usedAt = storedToken.usedAt
        ?? (await prisma.refreshToken.findUnique({ where: { id: storedToken.id }, select: { usedAt: true } }))?.usedAt
        ?? null;
      if (decideRefreshReuse(false, usedAt, now) === 'reuse-detected') {
        // A rotated token came back: assume it was stolen and kill the whole session.
        await revokeFamily(storedToken);
        console.warn('[auth] Refresh token reuse detected; session family revoked for user %s', storedToken.userId);
        throw AppError.unauthorized('Invalid or expired refresh token');
      }
      // Within the grace window (two tabs refreshing at once): fall through and
      // issue tokens for the SAME family — never a new, independent session.
    }

    // Fetch user to ensure they are still active
    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { client: true }
    });

    if (!user || !user.isActive) {
      await prisma.refreshToken.deleteMany({ where: { userId: storedToken.userId } });
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    if (user.role === 'CLIENT') {
      if (!user.client || user.client.status === 'PAUSED' || user.client.status === 'CHURNED') {
        throw AppError.unauthorized('Your account is currently inactive. Please contact support.');
      }
    }

    // Housekeeping: drop this user's expired tokens (used ones included).
    await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } });

    const { accessToken, refreshToken } = await issueSession(res, user, {
      familyId: refreshFamilyOf(storedToken),
      sessionStartedAt: storedToken.sessionStartedAt,
    });

    // Only echo the refresh token to native clients that sent theirs in the body.
    res.json(authTokenResponse(accessToken, refreshToken, presented.fromBody));
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────
// No access token required: possession of the refresh token (cookie for web,
// body for mobile) is what's revoked, so logout works even after the access
// token has expired.

router.post('/logout', refreshLimiter, async (req: Request, res: Response, next) => {
  try {
    const presented = getRefreshTokenFromRequest(req);

    if (presented) {
      const stored = await prisma.refreshToken.findUnique({
        where: { token: sha256Hex(presented.token) },
        select: { id: true, familyId: true, userId: true },
      });
      if (stored) await revokeFamily(stored);
    }

    clearRefreshTokenCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        mustChangePassword: true,
        client: {
          select: {
            id: true,
            company: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    const { resolvePermissions } = await import('../lib/permissions.js');
    const resolvedPermissions = resolvePermissions(
      user.role,
      (user.permissions as any) || null
    );

    res.json({
      user: {
        ...user,
        resolvedPermissions,
        requiresPasswordChange: !!user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────

async function sendPasswordResetEmail(user: { id: string; name: string; email: string }) {
  // Generate a cryptographically secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store hashed token + expiry in DB
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpiry: expiry,
    },
  });

  // Build reset URL using short domain base
  const appUrl = env.SHORT_LINK_DOMAIN || process.env.APP_URL || getShortDomainBase();
  const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hi <strong>${escapeHtml(user.name)}</strong>,</p>
    <p style="margin: 0 0 16px 0;">We received a request to reset the password for your account associated with <strong>${escapeHtml(user.email)}</strong>.</p>
    <p style="margin: 0 0 16px 0;">Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
    <p style="margin: 0 0 16px 0;">If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
  `;

  const html = await generateEmailHtml({
    title: 'Reset Your Password',
    preheader: 'You requested a password reset. Click to set a new password.',
    contentHtml,
    actionButton: {
      label: 'Reset Password',
      url: resetUrl,
    },
  });

  await sendEmail({
    to: user.email,
    subject: 'Reset Your Password',
    html,
  });

  auditLog({ action: 'auth.forgot_password', success: true, email: user.email });
}

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email } = req.body;

      // Always return 200 — never reveal whether an email exists (prevents enumeration)
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, isActive: true },
      });

      if (user && user.isActive) {
        // Fire-and-forget so the response time doesn't depend on whether the
        // account exists (token write + template render + mail relay).
        void sendPasswordResetEmail(user).catch((err) => {
          console.error('[auth] Failed to send password reset email:', err?.message || err);
        });
      }

      // Always respond with the same message
      res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/auth/reset-password ───────────────────────────────

router.post(
  '/reset-password',
  passwordResetLimiter,
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        throw AppError.badRequest('Passwords do not match');
      }

      // Hash the incoming raw token to compare with stored hash
      const tokenHash = sha256Hex(token);

      const user = await prisma.user.findUnique({
        where: { passwordResetToken: tokenHash },
      });

      if (!user) {
        throw AppError.badRequest('Invalid or expired password reset link. Please request a new one.');
      }

      if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
        // Clear expired token
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordResetToken: null, passwordResetExpiry: null },
        });
        throw AppError.badRequest('This password reset link has expired. Please request a new one.');
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password and clear reset token atomically
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordResetToken: null,
          passwordResetExpiry: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Invalidate all existing sessions for security
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

      auditLog({ action: 'auth.reset_password', success: true, userId: user.id, email: user.email });

      res.json({ message: 'Your password has been reset successfully. Please log in with your new password.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
