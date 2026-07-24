import { Router, type Request, type Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../lib/prisma.js';
import { getResendConfig } from '../lib/mail/resend-client.js';
import { processEmailEvent } from '../lib/mail/events.service.js';
import { processInboundEmail } from '../lib/mail/inbound.service.js';

const router = Router();

const INBOUND_TYPES = new Set(['email.received', 'inbound.email.received', 'email.inbound']);

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

/**
 * Resend webhook receiver.
 *
 * Mounted in app.ts with an `express.raw()` body parser BEFORE the global
 * `express.json()` so the exact bytes are available for Svix signature
 * verification. Every event is stored in email_webhook_logs (full history),
 * then dispatched to the tracking or inbound processor.
 */
router.post('/resend', async (req: Request, res: Response) => {
  const raw = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const config = await getResendConfig();
  const secret = config.webhookSecret;

  let payload: any = null;
  let verified = false;

  if (secret) {
    try {
      const wh = new Webhook(secret);
      payload = wh.verify(raw, {
        'svix-id': req.header('svix-id') || '',
        'svix-timestamp': req.header('svix-timestamp') || '',
        'svix-signature': req.header('svix-signature') || '',
      });
      verified = true;
    } catch (err) {
      await prisma.webhookLog.create({
        data: {
          source: 'resend',
          eventType: safeParse(raw)?.type || 'unknown',
          payload: safeParse(raw),
          verified: false,
          processed: false,
          error: err instanceof Error ? err.message : 'signature verification failed',
        },
      });
      return res.status(401).json({ error: true, message: 'Invalid webhook signature' });
    }
  } else {
    // No signing secret configured yet — accept but mark unverified.
    // (Configure RESEND_WEBHOOK_SECRET / settings before going live.)
    payload = safeParse(raw);
    verified = false;
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: true, message: 'Invalid webhook payload' });
  }

  const type: string = payload.type || 'unknown';
  const data = payload.data ?? payload;

  const log = await prisma.webhookLog.create({
    data: {
      source: 'resend',
      eventType: type,
      resendId: data?.email_id || data?.id || null,
      payload,
      verified,
      processed: false,
    },
  });

  try {
    if (INBOUND_TYPES.has(type)) {
      await processInboundEmail(data);
    } else {
      await processEmailEvent(type, data, payload.created_at);
    }
    await prisma.webhookLog.update({ where: { id: log.id }, data: { processed: true } });
  } catch (err) {
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { processed: false, error: err instanceof Error ? err.message : 'processing error' },
    });
    // Still 200 so Resend doesn't hammer retries for a bug on our side;
    // the failure is captured in the log for reprocessing.
  }

  return res.status(200).json({ received: true });
});

export default router;
