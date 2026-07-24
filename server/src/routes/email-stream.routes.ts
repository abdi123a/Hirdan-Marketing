import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireStaff, accessibleMailboxIds } from '../lib/mail/access.js';
import { addClient, removeClient } from '../lib/mail/sse.js';

const router = Router();

/**
 * Mint a short-lived SSE ticket. EventSource cannot send an Authorization
 * header, so the browser first calls this authenticated endpoint and then
 * opens the stream with `?ticket=`. The ticket is a 60s JWT — no long-lived
 * token ever appears in a URL/log.
 */
router.post('/stream/ticket', authenticate, requireStaff, (req: Request, res: Response) => {
  const ticket = jwt.sign(
    { userId: req.user!.userId, role: req.user!.role, typ: 'email-stream' },
    env.JWT_SECRET,
    { expiresIn: '60s' }
  );
  res.json({ ticket });
});

/** SSE channel for live inbox / tracking / unread updates. */
router.get('/stream', async (req: Request, res: Response, next) => {
  try {
    const ticket = req.query.ticket as string | undefined;
    if (!ticket) throw AppError.unauthorized('Missing stream ticket');

    let decoded: { userId: string; role: string; typ?: string };
    try {
      decoded = jwt.verify(ticket, env.JWT_SECRET) as typeof decoded;
    } catch {
      throw AppError.unauthorized('Invalid or expired stream ticket');
    }
    if (decoded.typ !== 'email-stream') throw AppError.unauthorized('Invalid stream ticket');

    const user = { userId: decoded.userId, role: decoded.role };
    const mailboxIds = await accessibleMailboxIds(user);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();

    const id = crypto.randomUUID();
    addClient({ id, userId: user.userId, mailboxIds, res });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* ignore broken pipe; close handler cleans up */
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(id);
    });
  } catch (error) {
    next(error);
  }
});

export default router;
