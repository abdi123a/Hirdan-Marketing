import { Resend } from 'resend';

// ─── Types ────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ─── Core Utility ─────────────────────────────────────────────────

/**
 * Send a transactional email via Resend.
 *
 * Credentials are read from process.env at call-time (not import-time) so that
 * runtime updates via the admin settings panel take effect immediately without
 * needing a server restart.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not configured — skipping send.');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  if (!from) {
    console.warn('[email] EMAIL_FROM is not configured — skipping send.');
    return { success: false, error: 'EMAIL_FROM not configured' };
  }

  try {
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    });

    if (result.error) {
      console.error('[email] Resend API error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[email] Unexpected error sending email:', err);
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Returns true if the Resend integration is fully configured.
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Returns a masked version of the API key for display in admin UIs.
 * e.g.  re_••••••••1a2b
 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return 're_••••••••' + key.slice(-4);
}
