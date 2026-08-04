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

const clientChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1),
});

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

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Relax for subdomains
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: env.COOKIE_DOMAIN, // Share across subdomains (e.g., '.hirdanmarketing.com')
    path: '/',
  });
}

/** True when the client is the native mobile app (not the web dashboard). */
function isMobileClient(req: Request): boolean {
  const platform = String(req.headers['x-client-platform'] || '').toLowerCase();
  return platform === 'mobile' || platform === 'ios' || platform === 'android';
}

/** Prefer httpOnly cookie; fall back to JSON body for native clients. */
function getRefreshTokenFromRequest(req: Request): string | undefined {
  const fromCookie = req.cookies?.refreshToken;
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const fromBody = req.body?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.length > 0) return fromBody;
  return undefined;
}

function authTokenResponse(
  req: Request,
  accessToken: string,
  refreshToken: string,
  extra: Record<string, unknown> = {}
) {
  const payload: Record<string, unknown> = { accessToken, ...extra };
  if (isMobileClient(req)) {
    payload.refreshToken = refreshToken;
  }
  return payload;
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
    if (!valid || score < 0.5) {
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
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;

      await verifyRecaptcha(recaptchaToken, { mobile: isMobileClient(req) });

      const user = await prisma.user.findUnique({ 
        where: { email },
        include: { client: true }
      });
      if (!user) {
        throw AppError.unauthorized('Invalid email or password');
      }

      // Prevent clients from using the admin login portal
      if (user.role === 'CLIENT') {
        throw AppError.unauthorized('This login is for agency staff only. Please use the Client Portal to log in.');
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        auditLog({ action: 'auth.login', success: false, email, ip });
        throw AppError.unauthorized('Invalid email or password');
      }

      auditLog({ action: 'auth.login', success: true, userId: user.id, email: user.email, role: user.role, ip });
      const tokenPayload = { userId: user.id, email: user.email, role: user.role };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Store refresh token in database
      const refreshTokenHash = sha256Hex(refreshToken);
      await prisma.refreshToken.create({
        data: {
          token: refreshTokenHash,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshTokenCookie(res, refreshToken);

      const { resolvePermissions } = await import('../lib/permissions.js');
      const resolvedPermissions = resolvePermissions(
        user.role,
        (user as any).permissions || null
      );

      res.json(
        authTokenResponse(req, accessToken, refreshToken, {
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
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;

      await verifyRecaptcha(recaptchaToken, { mobile: isMobileClient(req) });

      // Find the specific client user by email
      const matchedUser = await prisma.user.findFirst({
        where: { 
          email: email,
          role: 'CLIENT' 
        },
        include: { client: true },
      }) as any;

      if (!matchedUser || !matchedUser.client) {
        throw AppError.unauthorized('Invalid email or password');
      }

      if (matchedUser.client.status === 'PAUSED' || matchedUser.client.status === 'CHURNED') {
        throw AppError.unauthorized('Your account is currently inactive. Please contact support.');
      }

      const isValid = await bcrypt.compare(password, matchedUser.passwordHash);
      if (!isValid) {
        auditLog({ action: 'auth.login', success: false, email, ip });
        throw AppError.unauthorized('Invalid email or password');
      }

      auditLog({ action: 'auth.login', success: true, userId: matchedUser.id, email: matchedUser.email, role: matchedUser.role, ip });
      const tokenPayload = { 
        userId: matchedUser.id, 
        email: matchedUser.email, 
        role: matchedUser.role,
        clientId: matchedUser.client.id,
        company: matchedUser.client.company,
        mustChangePassword: !!matchedUser.mustChangePassword,
      };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      const refreshTokenHash = sha256Hex(refreshToken);
      await prisma.refreshToken.create({
        data: {
          token: refreshTokenHash,
          userId: matchedUser.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshTokenCookie(res, refreshToken);

      res.json(
        authTokenResponse(req, accessToken, refreshToken, {
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            name: matchedUser.name,
            role: matchedUser.role,
            clientId: matchedUser.client.id,
            company: matchedUser.client.company,
            requiresPasswordChange: !!matchedUser.mustChangePassword,
            mustChangePassword: !!matchedUser.mustChangePassword,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/auth/client-change-password ────────────────────────

router.post(
  '/client-change-password',
  authenticate,
  validate({ body: clientChangePasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      if (req.user!.role !== 'CLIENT') {
        throw AppError.forbidden('Only client users can change password');
      }

      const { currentPassword, newPassword } = req.body;
      const { confirmPassword } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;

      if (newPassword !== confirmPassword) {
        throw AppError.badRequest('New passwords do not match');
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!user) {
        throw AppError.notFound('User not found');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        auditLog({ action: 'auth.password_change', success: false, userId: user.id, ip });
        throw AppError.unauthorized('Current password is incorrect');
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });
      auditLog({ action: 'auth.password_change', success: true, userId: user.id, ip });

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: false,
      };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      const refreshTokenHash = sha256Hex(refreshToken);
      await prisma.refreshToken.create({
        data: {
          token: refreshTokenHash,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshTokenCookie(res, refreshToken);

      res.json(
        authTokenResponse(req, accessToken, refreshToken, {
          message: 'Password changed successfully',
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/auth/refresh ───────────────────────────────────────

router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw AppError.badRequest('Refresh token is required');
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;

    // Check if refresh token exists in database
    const refreshTokenHash = sha256Hex(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenHash },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Delete old refresh token (rotation)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Fetch user to ensure they are still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { client: true }
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (user.role === 'CLIENT' && user.client) {
      if (user.client.status === 'PAUSED' || user.client.status === 'CHURNED') {
        throw AppError.unauthorized('Your account is currently inactive. Please contact support.');
      }
    }

    // Generate new tokens
    const tokenPayload = { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      clientId: user.client?.id,
      company: user.client?.company,
      mustChangePassword: !!user.mustChangePassword,
    };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const newRefreshTokenHash = sha256Hex(newRefreshToken);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshTokenHash,
        userId: decoded.userId,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    setRefreshTokenCookie(res, newRefreshToken);

    res.json(authTokenResponse(req, newAccessToken, newRefreshToken));
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response, next) => {
  try {
    const bodyRefresh = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;

    if (bodyRefresh) {
      // Mobile: revoke only the presented refresh token (rotation-safe)
      const refreshTokenHash = sha256Hex(bodyRefresh);
      await prisma.refreshToken.deleteMany({
        where: { token: refreshTokenHash, userId: req.user!.userId },
      });
    } else {
      // Web: revoke all sessions for this user
      await prisma.refreshToken.deleteMany({
        where: { userId: req.user!.userId },
      });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      domain: env.COOKIE_DOMAIN,
      path: '/',
    });
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

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email } = req.body;

      // Always return 200 — never reveal whether an email exists (prevents enumeration)
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
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
          <p style="margin: 0 0 16px 0;">Hi <strong>${user.name}</strong>,</p>
          <p style="margin: 0 0 16px 0;">We received a request to reset the password for your account associated with <strong>${user.email}</strong>.</p>
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
