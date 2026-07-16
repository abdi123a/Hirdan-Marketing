import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);

const meetingSchema = z.object({
  title: z.string().min(1),
  date: z.string().datetime({ offset: true }),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── GET /api/clients/:id/meetings (admin) ───────────────────────────────────
router.get('/:id/meetings', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const meetings = await prisma.clientMeeting.findMany({
      where: { clientId: req.params.id as string },
      orderBy: { date: 'asc' },
    });
    res.json({ meetings });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:id/meetings (admin) ──────────────────────────────────
router.post(
  '/:id/meetings',
  requireAdmin,
  validate({ body: meetingSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const clientId = req.params.id as string;
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw AppError.notFound('Client not found');

      const meeting = await prisma.clientMeeting.create({
        data: {
          clientId,
          title: req.body.title,
          date: new Date(req.body.date),
          location: req.body.location ?? null,
          notes: req.body.notes ?? null,
        },
      });
      res.status(201).json({ meeting });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/clients/:id/meetings/:meetingId (admin) ────────────────────────
router.put(
  '/:id/meetings/:meetingId',
  requireAdmin,
  validate({ body: meetingSchema.partial() }),
  async (req: Request, res: Response, next) => {
    try {
      const meetingId = req.params.meetingId as string;
      const data: Record<string, any> = {};
      if (req.body.title !== undefined) data.title = req.body.title;
      if (req.body.date !== undefined) data.date = new Date(req.body.date);
      if (req.body.location !== undefined) data.location = req.body.location ?? null;
      if (req.body.notes !== undefined) data.notes = req.body.notes ?? null;

      const meeting = await prisma.clientMeeting.update({
        where: { id: meetingId },
        data,
      });
      res.json({ meeting });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/clients/:id/meetings/:meetingId (admin) ─────────────────────
router.delete('/:id/meetings/:meetingId', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.clientMeeting.delete({ where: { id: req.params.meetingId as string } });
    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    next(error);
  }
});


export default router;

