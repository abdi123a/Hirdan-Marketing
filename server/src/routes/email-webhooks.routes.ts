import { Router, type Request, type Response } from 'express';
import { Webhook } from 'svix';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { getResendConfig } from '../lib/mail/resend-client.js';
import { processEmailEvent } from '../lib/mail/events.service.js';
import { processInboundEmail } from '../lib/mail/inbound.service.js';

const router = Router();

// Unauthenticated endpoint — cap how fast any one source can make us verify
// signatures and write log rows. Resend's legitimate volume is far below this.
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Too many webhook requests' },
  })
);

/**
 * Record a rejected (unauthenticated) delivery. Only metadata is stored —
 * never the untrusted body — so an anonymous caller can't use the log table
 * as free storage or plant content for admins to view.
 */
async function logRejected(req: Request, rawLength: number, error: string): Promise<void> {
  try {
    await prisma.webhookLog.create({
      data: {
        source: 'resend',
        eventType: 'rejected',
        payload: {
          rejected: true,
          bytes: rawLength,
          ip: req.ip ?? null,
          userAgent: (req.get('user-agent') || '').slice(0, 200),
          svixId: (req.header('svix-id') || '').slice(0, 100) || null,
        },
        verified: false,
        processed: false,
        error,
      },
    });
  } catch (err) {
    console.error('[email-webhooks] failed to log rejected webhook', err);
  }
}

const INBOUND_TYPES = new Set(['email.received', 'inbound.email.received', 'email.inbound']);

/**
 * Resend webhook receiver.
 *
 * Mounted in app.ts with an `express.raw()` body parser BEFORE the global
 * `express.json()` so the exact bytes are available for Svix signature
 * verification. Every verified event is stored in email_webhook_logs (full
 * history; rejected deliveries are logged as metadata only),
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
      await logRejected(req, raw.length, err instanceof Error ? err.message : 'signature verification failed');
      return res.status(401).json({ error: true, message: 'Invalid webhook signature' });
    }
  } else {
    // SECURITY: fail closed. This endpoint is unauthenticated by necessity —
    // without a signing secret there is nothing distinguishing Resend from an
    // arbitrary caller, and processing the payload would let anyone inject
    // inbound emails into the Email Center and forge delivery/open/click events.
    // Configure RESEND_WEBHOOK_SECRET (or the Resend webhook secret in admin
    // settings) to enable the endpoint.
    await logRejected(req, raw.length, 'rejected: no webhook signing secret configured');
    console.error(
      '[email-webhooks] Rejected Resend webhook — no signing secret configured. ' +
        'Set RESEND_WEBHOOK_SECRET or the Resend webhook secret in admin settings.'
    );
    return res.status(401).json({ error: true, message: 'Webhook signature verification is not configured' });
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
