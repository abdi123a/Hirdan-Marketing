import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { createNotification } from '../lib/notifications.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { env } from '../config/env.js';
import { buildPass, isWalletConfigured, safeEqual, walletLinkToken } from '../lib/wallet-pass.js';

// Public digital business card: hirdan.cc/c/<slug> → web app /c/<slug> → these routes.
// No auth: only enabled cards are visible. Admin side lives in business-cards.routes.ts.

const router = Router();

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function findCard(slug: string) {
  const card = await prisma.businessCard.findFirst({ where: { slug, enabled: true } });
  if (!card) throw AppError.notFound('Card not found');
  return card;
}

/** Company details shared by every card (Settings → website, address, social links). */
async function getCompany() {
  const s = await prisma.agencySettings.findFirst({
    select: { agencyName: true, logo: true, whiteLogo: true, website: true, address: true, primaryColor: true, socialLinks: true },
  });
  let socialLinks: Array<{ platform: string; url: string }> = [];
  try {
    const parsed = s?.socialLinks ? JSON.parse(s.socialLinks) : [];
    if (Array.isArray(parsed)) {
      socialLinks = parsed.filter((l) => l?.url).map((l) => ({ platform: String(l.platform || ''), url: String(l.url) }));
    }
  } catch {
    // bad JSON in settings: show no social icons rather than break the card
  }
  return { ...s, agencyName: s?.agencyName || 'Hirdan Marketing', socialLinks };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** vCard 3.0 text escaping (RFC 2426 §4). */
function vcardEscape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

// ─── GET /api/card/:slug ──────────────────────────────────────────

router.get('/:slug', async (req: Request, res: Response, next) => {
  try {
    const card = await findCard(req.params.slug as string);
    const company = await getCompany();
    // ponytail: counts every load (bots included); add per-visitor dedupe if numbers get noisy
    await prisma.businessCard.update({ where: { id: card.id }, data: { views: { increment: 1 } } });

    res.json({
      card: {
        name: card.name,
        title: card.title,
        photoUrl: card.photoUrl,
        phone: card.phone,
        whatsapp: card.whatsapp,
        email: card.email,
        bio: card.bio,
      },
      company,
      walletEnabled: isWalletConfigured(),
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/card/:slug/wallet?k=<token> ─────────────────────────
// Apple Wallet pass. Only the employee's own link (with its token) can download it.

router.get('/:slug/wallet', async (req: Request, res: Response, next) => {
  try {
    if (!isWalletConfigured()) throw AppError.notFound('Apple Wallet is not set up');
    const card = await findCard(req.params.slug as string);
    if (!safeEqual(String(req.query.k || ''), walletLinkToken(card.id))) throw AppError.forbidden('Invalid Wallet link');
    const pkpass = await buildPass(card);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${card.slug}.pkpass"`);
    res.setHeader('Last-Modified', card.updatedAt.toUTCString());
    res.send(pkpass);
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/card/:slug/vcard ────────────────────────────────────

router.get('/:slug/vcard', async (req: Request, res: Response, next) => {
  try {
    const card = await findCard(req.params.slug as string);
    const company = await getCompany();
    const [first, ...rest] = card.name.trim().split(/\s+/);

    // ponytail: no PHOTO line (phones ignore URL photos; embedding needs file reads), add base64 if asked
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${vcardEscape(rest.join(' '))};${vcardEscape(first)};;;`,
      `FN:${vcardEscape(card.name)}`,
      `ORG:${vcardEscape(company.agencyName)}`,
      `TITLE:${vcardEscape(card.title)}`,
      card.phone && `TEL;TYPE=CELL:${vcardEscape(card.phone)}`,
      card.whatsapp && card.whatsapp !== card.phone && `TEL;TYPE=WHATSAPP:${vcardEscape(card.whatsapp)}`,
      card.email && `EMAIL;TYPE=WORK:${vcardEscape(card.email)}`,
      company.website && `URL:${vcardEscape(company.website)}`,
      company.address && `ADR;TYPE=WORK:;;${vcardEscape(company.address)};;;;`,
      'END:VCARD',
    ].filter(Boolean);

    await prisma.businessCard.update({ where: { id: card.id }, data: { saves: { increment: 1 } } });

    const filename = card.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'contact';
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.vcf"`);
    res.send(lines.join('\r\n') + '\r\n');
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/card/:slug/leads ───────────────────────────────────

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(190).optional().or(z.literal('')),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  website: z.string().optional(), // honeypot: hidden field only bots fill in
});

router.post('/:slug/leads', leadLimiter, validate({ body: leadSchema }), async (req: Request, res: Response, next) => {
  try {
    const card = await findCard(req.params.slug as string);
    const { name, phone, email, company, message, website } = req.body as z.infer<typeof leadSchema>;

    // Pretend success to bots so they don't retry
    if (website) return res.status(201).json({ message: 'Thanks! We will be in touch.' });

    const lead = await prisma.cardLead.create({
      data: { cardId: card.id, name, phone, email: email || null, company: company || null, message: message || null },
    });

    const frontend = (env.FRONTEND_URL || 'https://app.hirdanmarketing.com').replace(/\/$/, '');
    const leadUrl = `/dashboard/business-cards/${card.id}`;

    createNotification({
      title: 'New business card lead',
      message: `${name} left their details on ${card.name}'s card`,
      type: 'LEAD_CAPTURED',
      category: 'INFORMATION',
      entityType: 'CARD_LEAD',
      entityId: lead.id,
      actionUrl: leadUrl,
    });

    const settings = await prisma.agencySettings.findFirst({ select: { adminEmail: true } });
    if (settings?.adminEmail) {
      const rows = [
        ['Name', name],
        ['Phone', phone],
        ['Email', email],
        ['Company', company],
        ['Message', message],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${escapeHtml(v!)}</td></tr>`)
        .join('');
      const html = await generateEmailHtml({
        title: 'New business card lead',
        preheader: `${name} wants to hear from ${card.name}`,
        contentHtml: `<p>${escapeHtml(name)} left their details on <strong>${escapeHtml(card.name)}</strong>'s digital business card.</p><table>${rows}</table>`,
        actionButton: { label: 'View lead', url: `${frontend}${leadUrl}` },
      });
      sendEmail({
        to: settings.adminEmail,
        subject: `New lead from ${card.name}'s business card: ${name}`,
        html,
        replyTo: email || undefined,
      }).catch((err) => console.error('[card] lead email failed:', err));
    }

    return res.status(201).json({ message: 'Thanks! We will be in touch.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
