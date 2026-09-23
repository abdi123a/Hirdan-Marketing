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
 * Tickets are signed with a key derived from JWT_SECRET (not JWT_SECRET
 * itself) so a ticket that leaks via a URL/access log can never be replayed
 * as a bearer token against `authenticate`, which does not check `typ`.
 */
const TICKET_KEY = crypto.createHmac('sha256', env.JWT_SECRET).update('email-stream-ticket:v1').digest();
const TICKET_AUDIENCE = 'email-stream';
const TICKET_TTL_SECONDS = 60;

/** Consumed ticket ids → expiry (ms). Tickets are single-use. */
const usedTickets = new Map<string, number>();
function consumeTicket(jti: string): boolean {
  const now = Date.now();
  for (const [id, exp] of usedTickets) if (exp <= now) usedTickets.delete(id);
  if (usedTickets.has(jti)) return false;
  usedTickets.set(jti, now + TICKET_TTL_SECONDS * 1000);
  return true;
}

/**
 * Mint a short-lived SSE ticket. EventSource cannot send an Authorization
 * header, so the browser first calls this authenticated endpoint and then
 * opens the stream with `?ticket=`. The ticket is a 60s, single-use JWT bound
 * to the user — no long-lived token ever appears in a URL/log.
 * Mounted behind authenticate + requireModuleAccess('email') in routes/index.ts.
 */
router.post('/stream/ticket', authenticate, requireStaff, (req: Request, res: Response) => {
  const ticket = jwt.sign(
    { userId: req.user!.userId, role: req.user!.role, typ: 'email-stream' },
    TICKET_KEY,
    { expiresIn: TICKET_TTL_SECONDS, audience: TICKET_AUDIENCE, jwtid: crypto.randomUUID() }
  );
  res.json({ ticket });
});

/**
 * Public (ticket-authenticated) router: mounted BEFORE the `/email` routers
 * that require a bearer token, because EventSource cannot send one.
 */
export const emailStreamPublicRouter = Router();

/** SSE channel for live inbox / tracking / unread updates. */
emailStreamPublicRouter.get('/stream', async (req: Request, res: Response, next) => {
  try {
    const ticket = req.query.ticket as string | undefined;
    if (!ticket) throw AppError.unauthorized('Missing stream ticket');

    let decoded: { userId: string; role: string; typ?: string; jti?: string };
    try {
      decoded = jwt.verify(ticket, TICKET_KEY, {
        audience: TICKET_AUDIENCE,
        algorithms: ['HS256'],
      }) as typeof decoded;
    } catch {
      throw AppError.unauthorized('Invalid or expired stream ticket');
    }
    if (decoded.typ !== 'email-stream' || !decoded.jti) throw AppError.unauthorized('Invalid stream ticket');
    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(decoded.role)) throw AppError.forbidden('Staff access required');
    if (!consumeTicket(decoded.jti)) throw AppError.unauthorized('Stream ticket already used');

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
