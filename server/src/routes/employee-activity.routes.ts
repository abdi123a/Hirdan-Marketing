import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);

// ─── GET /api/team/:employeeId/activity ───────────────────────────
router.get('/:employeeId/activity', async (req: Request, res: Response, next) => {
  try {
    const employeeId = req.params.employeeId as string;
    const user = req.user as any;

    // Permissions check
    if (user.role === 'CLIENT') {
      throw AppError.forbidden('Access denied');
    }
    if (user.role === 'STAFF') {
      const employee = await prisma.teamMember.findUnique({
        where: { id: employeeId },
      });
      if (!employee || employee.userId !== user.userId) {
        throw AppError.forbidden('Access denied');
      }
    }

    const activities = await prisma.employeeActivity.findMany({
      where: { employeeId },
      orderBy: { timestamp: 'desc' },
    });

    res.json({ activities });
  } catch (error) {
    next(error);
  }
});

export default router;
