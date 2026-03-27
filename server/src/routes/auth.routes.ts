import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const clientLoginSchema = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
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

// ─── POST /api/auth/login ─────────────────────────────────────────

router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email, password } = req.body;

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

      res.json({
        accessToken,
        refreshToken,
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
  validate({ body: clientLoginSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email, accessCode } = req.body;

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

      res.json({
        accessToken,
        refreshToken,
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
    const { refreshToken } = req.body;
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

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
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
