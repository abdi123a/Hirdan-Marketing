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
    ? `<p class="footer-text" style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 4px 0;">${address.replace(/\n/g, '<br>')}</p>` 
    : '';

  // Contact details formatting
  const contactInfo = [phone, adminEmail].filter(Boolean).join(' &bull; ');
  const contactHtml = contactInfo
    ? `<p class="footer-text" style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 4px 0;">${contactInfo}</p>`
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
          return `<a href="${socials[p]}" class="footer-link" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 500; margin: 0 8px; font-size: 13px;">${label}</a>`;
        });
      if (links.length > 0) {
        socialHtml = `<div class="social-icons" style="margin-bottom: 16px; color: #cbd5e1;">${links.join(' &bull; ')}</div>`;
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
      <!-- Top Branding Color Bar -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; height: 6px; border-collapse: collapse; overflow: hidden;">
        <tr>
          <td width="70%" bgcolor="${primaryColor}" style="background-color: ${primaryColor}; height: 6px; padding: 0; line-height: 1px; font-size: 1px;">&nbsp;</td>
          <td width="30%" bgcolor="#f6b317" style="background-color: #f6b317; height: 6px; padding: 0; line-height: 1px; font-size: 1px;">&nbsp;</td>
        </tr>
      </table>

      <div class="header" style="background-color: #ffffff; border-bottom: 1px solid #f0f2f5; padding: 32px 40px; text-align: center;">
        ${logoHtml}
      </div>
      <div class="content" style="padding: 40px; color: #334155; font-size: 16px; line-height: 1.6;">
        ${options.contentHtml}
        ${actionButtonHtml}
      </div>
      
      <!-- Premium Dark True Footer -->
      <div class="footer" style="background-color: ${primaryColor}; color: #ffffff; padding: 40px 40px 32px 40px; text-align: center; position: relative;">
        <!-- Floating Accent Line -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px auto; width: 70%; height: 4px; border-collapse: collapse;">
          <tr>
            <td bgcolor="#f6b317" style="background-color: #f6b317; height: 4px; border-radius: 4px; line-height: 1px; font-size: 1px;">&nbsp;</td>
          </tr>
        </table>

        ${socialHtml}
        <p class="footer-text" style="color: #ffffff; font-size: 14px; font-weight: 800; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;"><strong>${agencyName}</strong></p>
        ${addressHtml}
        ${contactHtml}
        
        <p class="footer-text" style="font-size: 11px; color: #cbd5e1; margin: 12px 0; font-style: italic; font-weight: 500;">
          Empowering your brand's future through strategic digital growth
        </p>

        <div class="footer-links" style="margin-top: 16px; color: #ffffff;">
          <a href="https://${website}" class="footer-link" target="_blank" style="color: #f6b317; text-decoration: none; font-weight: 600; margin: 0 8px; font-size: 13px;">Website</a>
          &bull;
          <a href="https://app.${website}" class="footer-link" target="_blank" style="color: #f6b317; text-decoration: none; font-weight: 600; margin: 0 8px; font-size: 13px;">Client Portal</a>
        </div>
        <p class="footer-text" style="margin-top: 24px; font-size: 10px; color: #cbd5e1; opacity: 0.6; line-height: 1.5; margin: 4px 0;">
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

// ─── Welcome Email ─────────────────────────────────────────────────

export interface WelcomeEmailOptions {
  clientName: string;
  clientEmail: string;
  tempPassword: string;
  portalUrl: string;
}

/**
 * Generates a stunning, richly-designed welcome / onboarding HTML email
 * for a newly registered client. Wraps content using the shared agency template.
 */
export async function generateWelcomeEmailHtml(options: WelcomeEmailOptions): Promise<string> {
  const settings = await prisma.agencySettings.findFirst();

  const agencyName  = settings?.agencyName  || 'Hirdan Marketing';
  const primaryColor = settings?.primaryColor || '#504289';
  const website     = settings?.website     || 'hirdanmarketing.com';

  const portalUrl = options.portalUrl || `https://app.${website}`;

  // Feature cards data
  const features = [
    {
      emoji: '💰',
      title: 'Financials',
      desc: 'View all your invoices, payment history, and outstanding balances in one place.',
    },
    {
      emoji: '🚀',
      title: 'Projects',
      desc: 'Track the real-time progress of all your active and completed projects.',
    },
    {
      emoji: '🔄',
      title: 'Subscriptions',
      desc: 'Manage your service packages and subscription plans with full transparency.',
    },
    {
      emoji: '📱',
      title: 'Social Media',
      desc: 'Monitor your connected social accounts and campaign performance metrics.',
    },
    {
      emoji: '📅',
      title: 'Content Planner',
      desc: 'View and approve your scheduled content calendar across all platforms.',
    },
    {
      emoji: '📂',
      title: 'Documents',
      desc: 'Securely access and download all shared contracts, reports, and files.',
    },
  ];

  const featureCardsHtml = features.map(f => `
    <td width="50%" style="padding: 8px; vertical-align: top;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; background-color: #f8f7ff; border: 1px solid #e8e4f5; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 16px;">
            <div style="font-size: 28px; margin-bottom: 8px; line-height: 1;">${f.emoji}</div>
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e1b3a; letter-spacing: -0.2px;">${f.title}</p>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">${f.desc}</p>
          </td>
        </tr>
      </table>
    </td>
  `).join('');

  // Build 3x2 grid of feature cards (2 per row)
  const featureRows: string[] = [];
  for (let i = 0; i < features.length; i += 2) {
    const cells = features.slice(i, i + 2).map(f => `
      <td width="50%" style="padding: 8px; vertical-align: top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; background-color: #f8f7ff; border: 1px solid #e8e4f5; border-radius: 12px;">
          <tr>
            <td style="padding: 16px;">
              <div style="font-size: 26px; margin-bottom: 8px; line-height: 1;">${f.emoji}</div>
              <p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 700; color: #1e1b3a;">${f.title}</p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">${f.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    `).join('');
    featureRows.push(`<tr>${cells}</tr>`);
  }

  // Steps
  const steps = [
    { num: '1', title: 'Open your welcome email', desc: `Use the credentials below and go to <strong>${portalUrl}</strong>` },
    { num: '2', title: 'Log in with your credentials', desc: 'Enter your email address and the temporary password provided below.' },
    { num: '3', title: 'Change your password', desc: 'You\'ll be prompted to set a secure personal password on your first login.' },
    { num: '4', title: 'Explore your dashboard', desc: 'Browse your projects, invoices, content plan, and documents — all in one place.' },
  ];

  const stepsHtml = steps.map(s => `
    <tr>
      <td style="padding: 10px 0; vertical-align: top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          <tr>
            <td width="40" style="vertical-align: top; padding-right: 14px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${primaryColor}; color: #ffffff; font-size: 13px; font-weight: 800; text-align: center; line-height: 32px;">${s.num}</div>
            </td>
            <td style="vertical-align: top; padding-top: 5px;">
              <p style="margin: 0 0 3px 0; font-size: 14px; font-weight: 700; color: #1e1b3a;">${s.title}</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">${s.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height: 1px; background-color: #f0eeff;"></td></tr>
  `).join('');

  const contentHtml = `
    <!-- Hero Banner -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; background: linear-gradient(135deg, ${primaryColor}15 0%, #f6b31715 100%); border-radius: 14px; margin-bottom: 28px; overflow: hidden;">
      <tr>
        <td style="padding: 32px 28px; text-align: center;">
          <div style="font-size: 44px; margin-bottom: 12px;">🎉</div>
          <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; color: #1e1b3a; letter-spacing: -0.5px; line-height: 1.2;">
            Welcome aboard, ${options.clientName}!
          </h1>
          <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6; max-width: 380px; margin: 0 auto;">
            Your client portal is ready. We're thrilled to partner with you and can't wait to deliver exceptional results together.
          </p>
        </td>
      </tr>
    </table>

    <!-- Intro -->
    <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 24px 0;">
      Thank you for choosing <strong>${agencyName}</strong>. We've set up your personal client portal where you can track everything — from project progress and invoices to your content schedule and shared documents.
    </p>

    <!-- Credentials Box -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; background: linear-gradient(135deg, #1e1b3a 0%, ${primaryColor} 100%); border-radius: 14px; margin-bottom: 28px; overflow: hidden;">
      <tr>
        <td style="padding: 24px 28px;">
          <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1.5px;">🔐 Your Login Credentials</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <p style="margin: 0 0 3px 0; font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Email Address</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff; font-family: monospace;">${options.clientEmail}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <p style="margin: 0 0 3px 0; font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                <p style="margin: 0; font-size: 18px; font-weight: 800; color: #f6b317; font-family: monospace; letter-spacing: 2px;">${options.tempPassword}</p>
              </td>
            </tr>
          </table>
          <p style="margin: 14px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.5); line-height: 1.5;">
            🔒 This is a temporary password. You will be asked to change it when you first log in.
          </p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${portalUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px; letter-spacing: 0.3px;">
        Login to Your Portal →
      </a>
    </div>

    <!-- Divider -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 28px;">
      <tr>
        <td style="height: 1px; background-color: #f0eeff;"></td>
      </tr>
    </table>

    <!-- Features Heading -->
    <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #1e1b3a; letter-spacing: -0.3px;">What's inside your portal</h2>
    <p style="margin: 0 0 18px 0; font-size: 13px; color: #6b7280; line-height: 1.5;">Everything you need to stay informed and in control, all in one secure place.</p>

    <!-- Feature Cards Grid -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 32px;">
      ${featureRows.join('')}
    </table>

    <!-- Divider -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 28px;">
      <tr>
        <td style="height: 1px; background-color: #f0eeff;"></td>
      </tr>
    </table>

    <!-- Getting Started Steps -->
    <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #1e1b3a; letter-spacing: -0.3px;">How to get started</h2>
    <p style="margin: 0 0 18px 0; font-size: 13px; color: #6b7280;">Follow these quick steps to access your portal:</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 32px;">
      ${stepsHtml}
    </table>

    <!-- Security Notice -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 8px;">
      <tr>
        <td style="padding: 16px 18px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Security Notice</p>
          <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">
            Please change your temporary password immediately after your first login. Never share your login credentials with anyone. If you have trouble accessing your portal, contact us at <a href="mailto:${settings?.adminEmail || ''}" style="color: #92400e; font-weight: 700;">${settings?.adminEmail || agencyName}</a>.
          </p>
        </td>
      </tr>
    </table>

    <!-- Sign-off -->
    <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 24px 0 0 0;">
      We're here every step of the way. Don't hesitate to reach out if you have any questions. We're excited to grow with you! 🚀
    </p>
    <p style="font-size: 15px; color: #374151; margin: 8px 0 0 0;">
      Warm regards,<br/>
      <strong style="color: #1e1b3a;">${agencyName} Team</strong>
    </p>
  `;

  return generateEmailHtml({
    title: `Welcome to ${agencyName} — Your Portal is Ready`,
    preheader: `Hello ${options.clientName}! Your ${agencyName} client portal is ready. Here are your login credentials and everything you need to get started.`,
    contentHtml,
  });
}

