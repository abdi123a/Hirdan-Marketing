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
  const whiteLogo = settings?.whiteLogo || null;
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

  // White Logo for Footer
  let footerLogoHtml = '';
  if (whiteLogo) {
    const whiteLogoUrl = whiteLogo.startsWith('http') ? whiteLogo : `${apiBaseUrl}${whiteLogo}`;
    footerLogoHtml = `<img src="${whiteLogoUrl}" alt="${agencyName}" class="footer-logo-img" style="max-height: 38px; width: auto; display: inline-block;" />`;
  } else {
    footerLogoHtml = `<p class="footer-text" style="color: #ffffff; font-size: 15px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1.5px;"><strong>${agencyName}</strong></p>`;
  }

  // Address block formatting
  const addressHtml = address 
    ? `<p class="footer-text" style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 4px 0;">${address.replace(/\n/g, '<br>')}</p>` 
    : '';

  // Contact details formatting with explicit link styling for high contrast
  const phoneFormatted = phone
    ? `<a href="tel:${phone}" style="color: #e2e8f0 !important; text-decoration: none; font-weight: 500;">${phone}</a>`
    : '';
  const emailFormatted = adminEmail
    ? `<a href="mailto:${adminEmail}" target="_blank" style="color: #f6b317 !important; text-decoration: underline; text-decoration-color: #f6b317; font-weight: 700;">${adminEmail}</a>`
    : '';

  const contactInfo = [phoneFormatted, emailFormatted].filter(Boolean).join(' <span style="color: #94a3b8; margin: 0 4px;">&bull;</span> ');
  const contactHtml = contactInfo
    ? `<p class="footer-text" style="color: #e2e8f0; font-size: 13px; line-height: 1.6; margin: 6px 0;">${contactInfo}</p>`
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
          return `<a href="${socials[p]}" class="footer-link" target="_blank" style="color: #ffffff !important; text-decoration: none; font-weight: 500; margin: 0 8px; font-size: 13px;">${label}</a>`;
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
        <a href="${options.actionButton.url}" class="btn" style="background-color: ${primaryColor}; border-radius: 12px; color: #ffffff !important; display: inline-block; font-size: 16px; font-weight: 600; line-height: 50px; text-align: center; text-decoration: none; width: 220px; -webkit-text-size-adjust: none;">${options.actionButton.label}</a>
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
    @keyframes gentle-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes gentle-swing {
      0%, 100% { transform: rotate(0deg); }
      20% { transform: rotate(8deg); }
      40% { transform: rotate(-8deg); }
      60% { transform: rotate(4deg); }
      80% { transform: rotate(-4deg); }
    }
    .animated-icon {
      animation: gentle-bounce 2.5s infinite ease-in-out;
      display: inline-block;
    }
    .animated-swing {
      animation: gentle-swing 2.5s infinite ease-in-out;
      display: inline-block;
      transform-origin: top center;
    }
    .footer a {
      color: #ffffff !important;
    }
    .footer a[href^="mailto:"] {
      color: #f6b317 !important;
      text-decoration: underline !important;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 24px !important;
      }
      .header {
        padding: 24px !important;
      }
      .footer {
        padding: 28px 20px 24px 20px !important;
        border-radius: 20px !important;
        margin: 16px 12px 12px 12px !important;
      }
    }
  </style>
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  ${preheaderHtml}
  <div class="wrapper" style="background-color: #f6f9fc; padding: 40px 20px;">
    <div class="container" style="background-color: #ffffff; border-radius: 20px; border: 1px solid #e8ebf0; box-shadow: 0 8px 24px rgba(80, 66, 137, 0.06); max-width: 580px; margin: 0 auto; overflow: hidden;">
      <!-- Top Branding Color Bar -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width: 100%; height: 6px; border-collapse: separate; border-spacing: 0; overflow: hidden; border-radius: 20px 20px 0 0;">
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
      
      <!-- Premium Rounded Dark Footer -->
      <div class="footer" style="background-color: ${primaryColor}; color: #ffffff; padding: 40px 40px 32px 40px; text-align: center; position: relative; border-radius: 20px; -webkit-border-radius: 20px; margin: 0 20px 20px 20px;">
        <!-- Floating Gold Accent Divider -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px auto; width: 60px; height: 4px; border-collapse: collapse;">
          <tr>
            <td bgcolor="#f6b317" style="background-color: #f6b317; height: 4px; border-radius: 4px; line-height: 1px; font-size: 1px;">&nbsp;</td>
          </tr>
        </table>

        ${socialHtml}
        <div style="margin-bottom: 14px;">
          ${footerLogoHtml}
        </div>
        ${addressHtml}
        ${contactHtml}
        
        <p class="footer-text" style="font-size: 12px; color: #cbd5e1; margin: 14px 0 18px 0; font-style: italic; font-weight: 500;">
          Empowering your brand's future through strategic digital growth
        </p>

        <div class="footer-links" style="margin-top: 18px; color: #ffffff;">
          <a href="https://${website}" class="footer-link" target="_blank" style="color: #ffffff !important; background-color: rgba(255, 255, 255, 0.12); text-decoration: none; font-weight: 600; padding: 6px 14px; border-radius: 20px; margin: 0 4px; font-size: 12px; display: inline-block;">Website <span style="font-size: 9px; font-weight: bold; margin-left: 2px;">↗</span></a>
          <a href="https://app.${website}/client/login" class="footer-link" target="_blank" style="color: #f6b317 !important; background-color: rgba(246, 179, 23, 0.15); text-decoration: none; font-weight: 700; padding: 6px 14px; border-radius: 20px; margin: 0 4px; font-size: 12px; display: inline-block;">Client Portal <span style="font-size: 9px; font-weight: bold; margin-left: 2px;">↗</span></a>
        </div>
        <p class="footer-text" style="margin-top: 28px; font-size: 10.5px; color: #cbd5e1; opacity: 0.7; line-height: 1.5;">
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

  let portalUrl = options.portalUrl || `https://app.${website}/client/login`;
  if (portalUrl && !portalUrl.includes('/client/login')) {
    portalUrl = portalUrl.replace(/\/$/, '') + '/client/login';
  }
  const colorHex = primaryColor.replace('#', '');

  // Feature cards data with Icons8 names
  const features = [
    {
      icon: 'receipt',
      title: 'Financials',
      desc: 'View all your invoices, payment history, and outstanding balances in one place.',
    },
    {
      icon: 'briefcase',
      title: 'Projects',
      desc: 'Track the real-time progress of all your active and completed projects.',
    },
    {
      icon: 'repeat',
      title: 'Subscriptions',
      desc: 'Manage your service packages and subscription plans with full transparency.',
    },
    {
      icon: 'share--v1',
      title: 'Social Media',
      desc: 'Monitor your connected social accounts and campaign performance metrics.',
    },
    {
      icon: 'calendar--v1',
      title: 'Content Planner',
      desc: 'View and approve your scheduled content calendar across all platforms.',
    },
    {
      icon: 'opened-folder',
      title: 'Documents',
      desc: 'Securely access and download all shared contracts, reports, and files.',
    },
  ];

  // Build 3x2 grid of feature cards (2 per row)
  const featureRows: string[] = [];
  for (let i = 0; i < features.length; i += 2) {
    const cells = features.slice(i, i + 2).map(f => `
      <td width="50%" style="padding: 8px; vertical-align: top;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 20px;">
                <img src="https://img.icons8.com/ios-filled/60/${colorHex}/${f.icon}.png" width="30" height="30" style="display: block; margin-bottom: 12px;" alt="${f.title}" />
                <p style="margin: 0 0 5px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${f.title}</p>
                <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; font-weight: 500;">${f.desc}</p>
              </td>
            </tr>
          </table>
        </div>
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
      <td style="padding: 12px 0; vertical-align: top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          <tr>
            <td width="40" style="vertical-align: top; padding-right: 14px;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background-color: ${primaryColor}; color: #ffffff; font-size: 13px; font-weight: 800; text-align: center; line-height: 30px;">${s.num}</div>
            </td>
            <td style="vertical-align: top; padding-top: 3px;">
              <p style="margin: 0 0 3px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${s.title}</p>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">${s.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height: 1px; background-color: #f1f5f9;"></td></tr>
  `).join('');

  const contentHtml = `
    <!-- Hero Banner -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 28px; overflow: hidden;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 36px 28px; text-align: center;">
            <img src="https://img.icons8.com/fluency/96/handshake.png" width="48" height="48" style="margin-bottom: 12px;" alt="Welcome" />
            <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2;">
              Welcome aboard, ${options.clientName}!
            </h1>
            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6; max-width: 420px; margin: 0 auto;">
              We've set up your client portal. We're thrilled to partner with you and look forward to building something great together.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Intro -->
    <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 24px 0;">
      Thank you for choosing <strong>${agencyName}</strong>. We've set up your personal client portal where you can track everything — from project progress and invoices to your content schedule and shared documents.
    </p>

    <!-- Credentials Box -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid ${primaryColor}; border-radius: 16px; margin-bottom: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 24px 28px;">
            <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1.5px; display: flex; align-items: center;">
              <img src="https://img.icons8.com/ios-filled/30/${colorHex}/lock.png" width="12" height="12" style="margin-right: 6px; vertical-align: middle;" />
              <span style="vertical-align: middle;">Your Login Credentials</span>
            </p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                  <p style="margin: 0 0 4px 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Email Address</p>
                  <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; font-family: monospace;">
                    <a href="mailto:${options.clientEmail}" style="color: ${primaryColor}; text-decoration: none;">${options.clientEmail}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0 0 0;">
                  <p style="margin: 0 0 4px 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                  <span style="display: inline-block; background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 18px; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 1.5px;">
                    ${options.tempPassword}
                  </span>
                </td>
              </tr>
            </table>
            <p style="margin: 14px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.5;">
              🔒 This is a temporary password. You will be prompted to change it when you first log in.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${portalUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; letter-spacing: 0.3px;">
        Login to Your Portal →
      </a>
    </div>

    <!-- Divider -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 28px;">
      <tr>
        <td style="height: 1px; background-color: #f1f5f9;"></td>
      </tr>
    </table>

    <!-- Features Heading -->
    <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">What's inside your portal</h2>
    <p style="margin: 0 0 18px 0; font-size: 13px; color: #64748b; line-height: 1.5;">Everything you need to stay informed and in control, all in one secure place.</p>

    <!-- Feature Cards Grid -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 32px;">
      ${featureRows.join('')}
    </table>

    <!-- Divider -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 28px;">
      <tr>
        <td style="height: 1px; background-color: #f1f5f9;"></td>
      </tr>
    </table>

    <!-- Getting Started Steps -->
    <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">How to get started</h2>
    <p style="margin: 0 0 18px 0; font-size: 13px; color: #64748b;">Follow these quick steps to access your portal:</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 32px;">
      ${stepsHtml}
    </table>

    <!-- Security Notice -->
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 16px; margin-bottom: 8px; overflow: hidden;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 16px 18px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Security Notice</p>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">
              Please change your temporary password immediately after your first login. Never share your login credentials with anyone. If you have trouble accessing your portal, contact us at <a href="mailto:${settings?.adminEmail || ''}" style="color: #92400e; font-weight: 700;">${settings?.adminEmail || agencyName}</a>.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Sign-off -->
    <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 24px 0 0 0;">
      We're here every step of the way. Don't hesitate to reach out if you have any questions. We're excited to grow with you! 🚀
    </p>
    <p style="font-size: 15px; color: #334155; margin: 8px 0 0 0;">
      Warm regards,<br/>
      <strong style="color: #0f172a;">${agencyName} Team</strong>
    </p>
  `;

  return generateEmailHtml({
    title: `Welcome to ${agencyName} — Your Portal is Ready`,
    preheader: `Hello ${options.clientName}! Your ${agencyName} client portal is ready. Here are your login credentials and everything you need to get started.`,
    contentHtml,
  });
}

// ─── Proforma Follow-Up Email ──────────────────────────────────────

export interface ProformaFollowUpItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ProformaFollowUpEmailOptions {
  clientName: string;
  clientEmail: string;
  proformaNumber: string;
  amount: string | number;
  formattedAmount?: string;
  date?: string;
  dueDate?: string;
  customNote?: string;
  verificationUrl?: string;
  followUpType?: 'GENTLE_REMINDER' | 'EXPIRING_SOON' | 'DEPOSIT_REQUIRED' | 'FINAL_NOTICE';
  items?: ProformaFollowUpItem[];
  deposit?: number;
}

/**
 * Generates a high-converting, beautifully styled HTML follow-up email
 * specifically tailored for Proforma Invoices / Estimates.
 */
export async function generateProformaFollowUpEmailHtml(options: ProformaFollowUpEmailOptions): Promise<string> {
  const settings = await prisma.agencySettings.findFirst();

  const agencyName = settings?.agencyName || 'Hirdan Marketing';
  const primaryColor = settings?.primaryColor || '#504289';
  const colorHex = primaryColor.replace('#', '');
  const currencySymbol = (settings as any)?.currencySymbol || settings?.currency || '$';
  const website = settings?.website || 'hirdanmarketing.com';

  // Check if client has login access (has a User account)
  const clientRecord = await prisma.client.findFirst({
    where: {
      OR: [
        { email: options.clientEmail },
        { name: options.clientName }
      ]
    },
    select: { userId: true }
  });
  const hasLoginAccess = !!clientRecord?.userId;

  const followUpType = options.followUpType || 'GENTLE_REMINDER';

  let badgeLabel = 'PROFORMA FOLLOW-UP';
  let badgeBg = '#faf5ff';
  let badgeTextColor = primaryColor;
  let badgeBorderColor = primaryColor;
  let heroTitle = `Follow-Up: Proforma Estimate <strong style="font-weight: 700; color: #0f172a;">${options.proformaNumber}</strong>`;
  let heroSubtitle = `We hope this message finds you well. We are following up regarding your proforma estimate.`;
  let iconUrl = 'https://img.icons8.com/fluency/96/bell.png';
  let animationClass = 'animated-swing';

  if (followUpType === 'GENTLE_REMINDER') {
    badgeLabel = 'Gentle Reminder';
    badgeBg = '#faf5ff';
    badgeTextColor = primaryColor;
    badgeBorderColor = primaryColor;
    heroTitle = `Follow-up regarding Proforma Estimate <strong style="font-weight: 700; color: #0f172a;">${options.proformaNumber}</strong>`;
    heroSubtitle = `Just checking in to see if you have questions or need adjustments.`;
    iconUrl = 'https://img.icons8.com/fluency/96/bell.png';
    animationClass = 'animated-swing';
  } else if (followUpType === 'EXPIRING_SOON') {
    badgeLabel = 'Validity Notice';
    badgeBg = '#fffbeb';
    badgeTextColor = '#b45309';
    badgeBorderColor = '#f59e0b';
    heroTitle = `Proforma Estimate <strong style="font-weight: 700; color: #0f172a;">${options.proformaNumber}</strong> is expiring soon`;
    heroSubtitle = `This estimate is approaching its validity date. Please review and approve it to confirm your project terms.`;
    iconUrl = 'https://img.icons8.com/fluency/96/hourglass.png';
    animationClass = 'animated-icon';
  } else if (followUpType === 'DEPOSIT_REQUIRED') {
    badgeLabel = 'Action Required';
    badgeBg = '#faf5ff';
    badgeTextColor = '#6b21a8';
    badgeBorderColor = '#8b5cf6';
    heroTitle = `Deposit required for Proforma Estimate <strong style="font-weight: 700; color: #0f172a;">${options.proformaNumber}</strong>`;
    heroSubtitle = `To commence work on your project, please review the estimate and approve it to initiate the next steps.`;
    iconUrl = 'https://img.icons8.com/fluency/96/card-in-use.png';
    animationClass = 'animated-icon';
  } else if (followUpType === 'FINAL_NOTICE') {
    badgeLabel = 'Final Notice';
    badgeBg = '#fef2f2';
    badgeTextColor = '#b91c1c';
    badgeBorderColor = '#ef4444';
    heroTitle = `Final follow-up for Proforma Estimate <strong style="font-weight: 700; color: #0f172a;">${options.proformaNumber}</strong>`;
    heroSubtitle = `This is our final follow-up regarding your pending estimate. Please let us know if you would like to proceed with the proposed scope.`;
    iconUrl = 'https://img.icons8.com/fluency/96/alert.png';
    animationClass = 'animated-icon';
  }

  // Format currency value helper (stored in cents, divide by 100)
  const numAmount = (typeof options.amount === 'number' ? options.amount : parseFloat(options.amount || '0')) / 100;
  const displayAmount = options.formattedAmount || `${currencySymbol}${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Custom Message block formatted directly as actual body text paragraphs
  let bodyTextHtml = '';
  if (options.customNote && options.customNote.trim()) {
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(options.customNote);
    if (isHtml) {
      bodyTextHtml = `
        <div style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          ${options.customNote.trim()}
        </div>
      `;
    } else {
      bodyTextHtml = options.customNote
        .trim()
        .split('\n\n')
        .map(para => `<p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${para.replace(/\n/g, '<br>')}</p>`)
        .join('');
    }
  } else {
    bodyTextHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        Dear ${options.clientName},
      </p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        This is a quick follow-up regarding Proforma Estimate <strong style="font-weight: 700; color: #0f172a;">${options.proformaNumber}</strong> issued by ${agencyName}.
      </p>
    `;
  }

  // Items table
  let itemsHtml = '';
  if (options.items && options.items.length > 0) {
    const itemRows = options.items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a;">${item.description}</td>
        <td style="padding: 12px 16px; font-size: 13px; color: #64748b; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 16px; font-size: 13px; color: #64748b; text-align: right;">${currencySymbol}${((item.unitPrice || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${currencySymbol}${(item.quantity * (item.unitPrice || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    itemsHtml = `
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px;">Item Summary</p>
        <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Description</th>
                <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">Qty</th>
                <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">Rate</th>
                <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // CTA button redirection flow
  let ctaHtml = '';
  const clientLoginUrl = `https://app.${website}/client/login`;
  
  if (hasLoginAccess) {
    ctaHtml = `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${clientLoginUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(80, 66, 137, 0.25);">
          Log In to Portal to Approve →
        </a>
        ${options.verificationUrl ? `
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
            Or verify document online: <a href="${options.verificationUrl}" style="color: ${primaryColor}; font-weight: 600; text-decoration: underline;">Verify Document ${options.proformaNumber} <span style="font-size: 9px; font-weight: bold; margin-left: 2px;">↗</span></a>
          </p>
        ` : ''}
      </div>
    `;
  } else if (options.verificationUrl) {
    ctaHtml = `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${options.verificationUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(80, 66, 137, 0.25);">
          Verify Proforma Online →
        </a>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
          Or copy link: <a href="${options.verificationUrl}" style="color: ${primaryColor}; word-break: break-all;">${options.verificationUrl}</a>
        </p>
      </div>
    `;
  }

  const contentHtml = `
    <!-- Hero Banner (Centered Onboarding Style Card) -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 28px; overflow: hidden;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 36px 28px; text-align: center;">
            <!-- Animated Icon -->
            <div style="margin-bottom: 16px; display: inline-block;">
              <img src="${iconUrl}" width="54" height="54" class="${animationClass}" style="display: block; margin: 0 auto;" alt="${badgeLabel}" />
            </div>
            
            <!-- Pill Badge -->
            <br/>
            <div style="display: inline-block; background-color: ${badgeBg}; color: ${badgeTextColor}; font-size: 11px; font-weight: 700; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              ${badgeLabel}
            </div>
            
            <!-- Hero Title -->
            <h2 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 500; color: #1e293b; letter-spacing: -0.3px; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              ${heroTitle}
            </h2>
            
            <!-- Hero Subtitle -->
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6; max-width: 440px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              ${heroSubtitle}
            </p>
          </td>
        </tr>
      </table>
    </div>

    ${bodyTextHtml}

    <!-- Summary Details Box -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03); overflow: hidden;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 20px 24px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
              <tr>
                <td style="padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Proforma Number</span>
                  <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">${options.proformaNumber}</p>
                </td>
                <td style="padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; text-align: right;">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Total Estimate</span>
                  <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 900; color: ${primaryColor};">${displayAmount}</p>
                </td>
              </tr>
              <tr>
                <td style="padding-top: 12px;">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Issued Date</span>
                  <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 600; color: #334155;">${options.date || 'As per record'}</p>
                </td>
                <td style="padding-top: 12px; text-align: right;">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Valid Until</span>
                  <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 700; color: #0f172a;">${options.dueDate || 'Upon receipt'}</p>
                </td>
              </tr>
              ${options.deposit && options.deposit > 0 ? `
                <tr>
                  <td colspan="2" style="padding-top: 12px; border-top: 1px dashed #e2e8f0; margin-top: 12px;">
                    <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Initial Deposit Required</span>
                    <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 800; color: #059669;">${currencySymbol}${((options.deposit || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </td>
                </tr>
              ` : ''}
            </table>
          </td>
        </tr>
      </table>
    </div>

    ${itemsHtml}

    ${ctaHtml}

    <!-- Simple Steps Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; overflow: hidden;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px;">⚡ Next Steps</p>
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569; line-height: 1.5;">
              <strong>1. Review & Approve:</strong> ${hasLoginAccess ? 'Log in to your client portal' : 'Click the button above'} to view and accept the proposal online.
            </p>
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569; line-height: 1.5;">
              <strong>2. Automatic Invoicing:</strong> Once accepted, an official invoice will be issued for payment.
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
              <strong>3. PDF Attached:</strong> A complete PDF copy of the proforma estimate is also attached to this email.
            </p>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 20px 0 0 0;">
      If you need any adjustments to the scope or have questions, simply reply to this email or contact us at <a href="mailto:${settings?.adminEmail || ''}" style="color: ${primaryColor}; font-weight: 600;">${settings?.adminEmail || 'our team'}</a>.
    </p>
    <p style="font-size: 14px; color: #334155; margin: 12px 0 0 0;">
      Best regards,<br/>
      <strong style="color: #0f172a;">${agencyName} Team</strong>
    </p>
  `;

  return generateEmailHtml({
    title: `${heroTitle} — ${agencyName}`,
    preheader: `${heroSubtitle} View Proforma ${options.proformaNumber} total ${displayAmount}.`,
    contentHtml,
  });
}



