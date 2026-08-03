import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const registerSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().max(255).optional(),
});

router.use(authenticate);

/**
 * POST /api/devices — register or refresh an Expo push token for the current user.
 */
router.post(
  '/',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { token, platform, deviceName } = req.body;
      const userId = req.user!.userId;

      const device = await prisma.deviceToken.upsert({
        where: { token },
        create: {
          token,
          platform,
          deviceName: deviceName || null,
          userId,
          lastSeenAt: new Date(),
        },
        update: {
          platform,
          deviceName: deviceName || undefined,
          userId,
          lastSeenAt: new Date(),
        },
      });

      res.json({ id: device.id, token: device.token, platform: device.platform });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/devices/:token — unregister a device token (logout / uninstall).
 */
router.delete('/:token', async (req: Request, res: Response, next) => {
  try {
    const token = decodeURIComponent(req.params.token || '');
    if (!token) throw AppError.badRequest('Token is required');

    await prisma.deviceToken.deleteMany({
      where: {
        token,
        userId: req.user!.userId,
      },
    });

    res.json({ message: 'Device unregistered' });
  } catch (error) {
    next(error);
  }
});

export default router;
