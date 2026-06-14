import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// ─── Rate Limiter ───────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: true, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Validation Schemas ───────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  recaptchaToken: z.string().optional().nullable(),
});

const clientLoginSchema = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
  recaptchaToken: z.string().optional().nullable(),
});

// ─── Helper: Generate Tokens ─────────────────────────────────────

function generateAccessToken(payload: any) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

function generateRefreshToken(payload: any) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
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
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Protect against CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// ─── POST /api/auth/login ─────────────────────────────────────────

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email, password, recaptchaToken } = req.body;

      // Google reCAPTCHA Verification (supports both v2 checkbox and v3 invisible)
      const settings = await prisma.agencySettings.findFirst();
      if (settings?.enableRecaptcha) {
        if (!recaptchaToken) {
          throw AppError.badRequest('Please complete the reCAPTCHA verification.');
        }

        try {
          const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
          const verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              secret: settings.recaptchaSecretKey || '',
              response: recaptchaToken,
            }).toString(),
          });
          const verifyData = (await verifyRes.json()) as any;
          if (!verifyData.success) {
            throw AppError.unauthorized('reCAPTCHA verification failed. Please try again.');
          }
          // For v3: also check the score (>= 0.5 = likely human)
          if (typeof verifyData.score === 'number' && verifyData.score < 0.5) {
            throw AppError.unauthorized('Suspicious activity detected. Please try again.');
          }
        } catch (err: any) {
          if (err.status) throw err;
          console.error('reCAPTCHA verification error:', err);
          throw AppError.internal('Failed to verify reCAPTCHA. Please try again.');
        }
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw AppError.unauthorized('Invalid email or password');
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw AppError.unauthorized('Invalid email or password');
      }

      const tokenPayload = { userId: user.id, email: user.email, role: user.role };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Store refresh token in database
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshTokenCookie(res, refreshToken);

      res.json({
        accessToken,
        // refreshToken is now handled via cookie
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
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
      const { email, accessCode, recaptchaToken } = req.body;

      // Google reCAPTCHA Verification
      const settings = await prisma.agencySettings.findFirst();
      if (settings?.enableRecaptcha) {
        if (!recaptchaToken) {
          throw AppError.badRequest('Please complete the reCAPTCHA verification.');
        }

        try {
          const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
          const verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              secret: settings.recaptchaSecretKey || '',
              response: recaptchaToken,
            }).toString(),
          });
          const verifyData = (await verifyRes.json()) as any;
          if (!verifyData.success) {
            throw AppError.unauthorized('reCAPTCHA verification failed. Please try again.');
          }
        } catch (err: any) {
          if (err.status) throw err;
          console.error('reCAPTCHA verification error:', err);
          throw AppError.internal('Failed to verify reCAPTCHA. Please try again.');
        }
      }

      // Find the specific client user by email
      const matchedUser = await prisma.user.findFirst({
        where: { 
          email: email,
          role: 'CLIENT' 
        },
        include: { client: true },
      }) as any;

      if (!matchedUser || !matchedUser.client) {
        throw AppError.unauthorized('Invalid email or access code');
      }

      const isValid = await bcrypt.compare(accessCode.toUpperCase(), matchedUser.passwordHash);
      if (!isValid) {
        throw AppError.unauthorized('Invalid email or access code');
      }

      const tokenPayload = { 
        userId: matchedUser.id, 
        email: matchedUser.email, 
        role: matchedUser.role,
        clientId: matchedUser.client.id,
        company: matchedUser.client.company
      };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: matchedUser.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshTokenCookie(res, refreshToken);

      res.json({
        accessToken,
        // refreshToken handled via cookie
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          name: matchedUser.name,
          role: matchedUser.role,
          clientId: matchedUser.client.id,
          company: matchedUser.client.company,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/auth/refresh ───────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      throw AppError.badRequest('Refresh token is required');
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Delete old refresh token (rotation)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new tokens
    const tokenPayload = { 
      userId: decoded.userId, 
      email: decoded.email, 
      role: decoded.role,
      clientId: decoded.clientId,
      company: decoded.company
    };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: decoded.userId,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      // refreshToken handled via cookie
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response, next) => {
  try {
    // Delete all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user!.userId },
    });

    res.clearCookie('refreshToken');
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

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
