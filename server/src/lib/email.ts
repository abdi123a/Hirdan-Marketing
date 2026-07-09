import { Resend } from 'resend';
import { prisma } from './prisma.js';

// ─── Types ────────────────────────────────────────────────────────

export interface Attachment {
  content?: string | Buffer;
  filename: string;
  path?: string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Attachment[];
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
 * Credentials are read dynamically from DB so that runtime updates via
 * the admin settings panel take effect immediately.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const settings = await prisma.agencySettings.findFirst({
    select: { resendApiKey: true, emailFrom: true, mailerName: true }
  });

  const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY;
  const emailFrom = settings?.emailFrom || process.env.EMAIL_FROM;
  const mailerName = settings?.mailerName || process.env.MAILER_NAME;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not configured — skipping send.');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  if (!emailFrom) {
    console.warn('[email] EMAIL_FROM is not configured — skipping send.');
    return { success: false, error: 'EMAIL_FROM not configured' };
  }

  try {
    const resend = new Resend(apiKey);
    const fromAddress = mailerName ? `${mailerName} <${emailFrom}>` : emailFrom;

    const result = await resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.cc ? { cc: options.cc } : {}),
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      ...(options.attachments ? { attachments: options.attachments } : {}),
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
interface EmailWrapperOptions {
  title: string;
  preheader?: string;
  contentHtml: string;
  actionButton?: {
    label: string;
    url: string;
  };
}

/**
 * Wraps email content into a beautifully designed HTML template featuring the agency's
 * primary color, logo, address, contact, and website settings from the database.
 */
export async function generateEmailHtml(options: EmailWrapperOptions): Promise<string> {
  const settings = await prisma.agencySettings.findFirst();

  const agencyName = settings?.agencyName || 'Hirdan Marketing';
  const primaryColor = settings?.primaryColor || '#504289';
  const logo = settings?.logo || null;
  const website = settings?.website || 'hirdanmarketing.com';
  const address = settings?.address || '';
  const phone = settings?.phone || '';
  const adminEmail = settings?.adminEmail || 'info@hirdanmarketing.com';
  const socialLinksRaw = settings?.socialLinks || null;

  // Resolve API Base URL to fetch images
  const apiBaseUrl = process.env.APP_URL 
    ? process.env.APP_URL.replace(/\/$/, '') 
    : 'https://api.hirdanmarketing.com';

  // Logo rendering: Prefer absolute URL image, fallback to typography logo
  let logoHtml = `<h1 class="logo-text" style="color: ${primaryColor}; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">${agencyName}</h1>`;
  if (logo) {
    const logoUrl = logo.startsWith('http') ? logo : `${apiBaseUrl}${logo}`;
    logoHtml = `<img src="${logoUrl}" alt="${agencyName}" class="logo-img" style="max-height: 48px; width: auto; display: inline-block;" />`;
  }

  // Address block formatting
  const addressHtml = address 
    ? `<p class="footer-text" style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 4px 0;">${address.replace(/\n/g, '<br>')}</p>` 
    : '';

  // Contact details formatting
  const contactInfo = [phone, adminEmail].filter(Boolean).join(' &bull; ');
  const contactHtml = contactInfo
    ? `<p class="footer-text" style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 4px 0;">${contactInfo}</p>`
    : '';

  // Social Links rendering
  let socialHtml = '';
  if (socialLinksRaw) {
    try {
      const socials = JSON.parse(socialLinksRaw);
      const platforms = ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube'];
      const links = platforms
        .filter(p => socials[p])
        .map(p => {
          const label = p.charAt(0).toUpperCase() + p.slice(1);
          return `<a href="${socials[p]}" class="footer-link" target="_blank" style="color: ${primaryColor}; text-decoration: none; font-weight: 500; margin: 0 8px; font-size: 13px;">${label}</a>`;
        });
      if (links.length > 0) {
        socialHtml = `<div class="social-icons" style="margin-bottom: 16px;">${links.join(' &bull; ')}</div>`;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Action Button HTML rendering
  let actionButtonHtml = '';
  if (options.actionButton) {
    actionButtonHtml = `
      <div class="btn-container" style="text-align: center; margin: 32px 0;">
        <a href="${options.actionButton.url}" class="btn" style="background-color: ${primaryColor}; border-radius: 8px; color: #ffffff !important; display: inline-block; font-size: 16px; font-weight: 600; line-height: 50px; text-align: center; text-decoration: none; width: 220px; -webkit-text-size-adjust: none;">${options.actionButton.label}</a>
      </div>
    `;
  }

  const preheaderHtml = options.preheader
    ? `<span style="display: none; max-height: 0px; overflow: hidden;">${options.preheader}</span>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    body {
      background-color: #f6f9fc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    a {
      color: ${primaryColor};
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 24px !important;
      }
      .header {
        padding: 24px !important;
      }
      .footer {
        padding: 24px !important;
      }
    }
  </style>
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  ${preheaderHtml}
  <div class="wrapper" style="background-color: #f6f9fc; padding: 40px 20px;">
    <div class="container" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e8ebf0; box-shadow: 0 4px 12px rgba(80, 66, 137, 0.03); max-width: 580px; margin: 0 auto; overflow: hidden;">
      <div class="header" style="background-color: #ffffff; border-bottom: 1px solid #f0f2f5; padding: 32px 40px; text-align: center;">
        ${logoHtml}
      </div>
      <div class="content" style="padding: 40px; color: #334155; font-size: 16px; line-height: 1.6;">
        ${options.contentHtml}
        ${actionButtonHtml}
      </div>
      <div class="footer" style="background-color: #fafbfc; border-top: 1px solid #f0f2f5; padding: 32px 40px; text-align: center;">
        ${socialHtml}
        <p class="footer-text" style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 4px 0;"><strong>${agencyName}</strong></p>
        ${addressHtml}
        ${contactHtml}
        <div class="footer-links" style="margin-top: 16px;">
          <a href="https://${website}" class="footer-link" target="_blank" style="color: ${primaryColor}; text-decoration: none; font-weight: 500; margin: 0 8px; font-size: 13px;">Website</a>
          <a href="https://app.${website}" class="footer-link" target="_blank" style="color: ${primaryColor}; text-decoration: none; font-weight: 500; margin: 0 8px; font-size: 13px;">Client Portal</a>
        </div>
        <p class="footer-text" style="margin-top: 24px; font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 4px 0;">
          This is an automated transactional message. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

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
