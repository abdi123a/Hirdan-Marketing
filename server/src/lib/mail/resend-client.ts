import { Resend } from 'resend';
import { prisma } from '../prisma.js';

export interface ResendConfig {
  resend: Resend;
  apiKey: string;
  /** Domain used for generated Message-IDs / inbound routing. */
  fromDomain: string | null;
  /** Svix signing secret for verifying inbound webhooks. */
  webhookSecret: string | null;
  defaultFrom: string | null;
  mailerName: string | null;
}

/**
 * Resolve Resend credentials from the admin settings row first, falling back
 * to environment variables. Read fresh each call so settings changes made in
 * the admin panel take effect without a restart (mirrors lib/email.ts).
 */
export async function getResendConfig(): Promise<ResendConfig> {
  const settings = await prisma.agencySettings.findFirst({
    select: {
      resendApiKey: true,
      resendWebhookSecret: true,
      resendInboundDomain: true,
      emailFrom: true,
      mailerName: true,
    },
  });

  const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY || '';
  const defaultFrom = settings?.emailFrom || process.env.EMAIL_FROM || null;
  const fromDomain =
    settings?.resendInboundDomain ||
    process.env.RESEND_INBOUND_DOMAIN ||
    (defaultFrom && defaultFrom.includes('@') ? defaultFrom.split('@')[1] : null);

  return {
    resend: new Resend(apiKey || 're_placeholder'),
    apiKey,
    fromDomain,
    webhookSecret: settings?.resendWebhookSecret || process.env.RESEND_WEBHOOK_SECRET || null,
    defaultFrom,
    mailerName: settings?.mailerName || process.env.MAILER_NAME || null,
  };
}

export function isResendConfigured(config: ResendConfig): boolean {
  return !!config.apiKey && config.apiKey.startsWith('re_') && !config.apiKey.includes('placeholder');
}
