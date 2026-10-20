import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http2 from 'http2';
import sharp from 'sharp';
import { PKPass } from 'passkit-generator';
import type { BusinessCard } from '@prisma/client';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { PATHS } from './paths.js';
import { getShortDomainBase } from './short-url.js';

// Apple Wallet business-card pass (generic style). Serial number = BusinessCard.id.
// Design: Hirdan purple, white text, gold labels; name big with the photo (blue verified
// seal on its corner) beside it, title small under the name, phone + email, QR to the web card.

const CERT_DIR = path.resolve(env.WALLET_CERT_DIR || path.join(process.cwd(), 'certs', 'wallet'));
const PURPLE = 'rgb(80, 66, 137)';
const GOLD = 'rgb(244, 176, 25)';

let certCache: { signerCert: Buffer; signerKey: Buffer; wwdr: Buffer } | null = null;
function certificates() {
  if (!certCache) {
    certCache = {
      signerCert: fs.readFileSync(path.join(CERT_DIR, 'signerCert.pem')),
      signerKey: fs.readFileSync(path.join(CERT_DIR, 'signerKey.pem')),
      wwdr: fs.readFileSync(path.join(CERT_DIR, 'wwdr.pem')),
    };
  }
  return certCache;
}

export function isWalletConfigured(): boolean {
  return Boolean(env.WALLET_PASS_TYPE_ID && env.WALLET_TEAM_ID && fs.existsSync(path.join(CERT_DIR, 'signerCert.pem')));
}

const hmac = (purpose: string, value: string) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(`${purpose}:${value}`).digest('base64url');

/** Token in the employee's "Add to Apple Wallet" link, so only that link offers the pass. */
export const walletLinkToken = (cardId: string) => hmac('wallet-link', cardId).slice(0, 22);

/** Token Wallet sends back to our web service (Authorization: ApplePass <token>). Must be ≥ 16 chars. */
export const walletAuthToken = (cardId: string) => hmac('wallet-auth', cardId);

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Loads an image stored the way the app stores them: data: URL, /uploads/… path, or absolute URL. */
async function loadImage(ref: string | null | undefined): Promise<Buffer | null> {
  if (!ref) return null;
  try {
    if (ref.startsWith('data:')) return Buffer.from(ref.split(',')[1] || '', 'base64');
    if (ref.startsWith('/uploads/')) {
      const file = path.resolve(PATHS.UPLOADS_ROOT, ref.replace(/^\/uploads\//, ''));
      if (!file.startsWith(PATHS.UPLOADS_ROOT + path.sep)) return null;
      return fs.readFileSync(file);
    }
    if (/^https?:\/\//.test(ref)) {
      const res = await fetch(ref, { signal: AbortSignal.timeout(8000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
  } catch {
    // missing/broken image: the pass is still valid without it
  }
  return null;
}

const VERIFIED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11.5" fill="${PURPLE}"/><circle cx="12" cy="12" r="6.5" fill="#fff"/><path fill="#1D9BF0" d="m8.6 22.5l-1.9-3.2l-3.6-.8l.35-3.7L1 12l2.45-2.8l-.35-3.7l3.6-.8l1.9-3.2L12 2.95l3.4-1.45l1.9 3.2l3.6.8l-.35 3.7L23 12l-2.45 2.8l.35 3.7l-3.6.8l-1.9 3.2l-3.4-1.45zm2.35-6.95L16.6 9.9l-1.4-1.45l-4.25 4.25l-2.15-2.1L7.4 12z"/></svg>`;

/** Round photo with a white ring and the blue verified seal on its lower-right corner. */
async function thumbnail(photo: Buffer | null, name: string, size: number): Promise<Buffer> {
  const ring = Math.round(size * 0.035);
  const inner = size - ring * 2;
  const circleMask = Buffer.from(`<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}"/></svg>`);
  const face = photo
    ? await sharp(photo).rotate().resize(inner, inner, { fit: 'cover' }).composite([{ input: circleMask, blend: 'dest-in' }]).png().toBuffer()
    : await sharp(Buffer.from(
        `<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#F4B019"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Helvetica, Arial" font-weight="700" font-size="${inner * 0.36}" fill="#504289">${name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase().replace(/[<&>]/g, '')}</text></svg>`,
      )).png().toBuffer();
  const badge = Math.round(size * 0.32);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`) },
      { input: face, top: ring, left: ring },
      { input: await sharp(Buffer.from(VERIFIED_SVG)).resize(badge, badge).png().toBuffer(), top: size - badge, left: size - badge },
    ])
    .png()
    .toBuffer();
}

/** White version of a logo (keeps its shape via the alpha channel) so it reads on purple. */
async function whiteLogo(src: Buffer, height: number): Promise<Buffer> {
  const resized = await sharp(src).resize({ height, withoutEnlargement: false }).ensureAlpha().png().toBuffer();
  const { width = height } = await sharp(resized).metadata();
  const alpha = await sharp(resized).extractChannel('alpha').toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).joinChannel(alpha).png().toBuffer();
}

const FALLBACK_LOGO = path.join(process.cwd(), 'assets', 'wallet', 'logo.png');

export async function buildPass(card: BusinessCard): Promise<Buffer> {
  const agency = await prisma.agencySettings.findFirst({ select: { agencyName: true, logo: true, whiteLogo: true, website: true, address: true, socialLinks: true } });
  const company = agency?.agencyName || 'Hirdan Marketing';
  const cardUrl = `${getShortDomainBase()}/c/${card.slug}`;

  const logoSrc = (await loadImage(agency?.whiteLogo)) || (await loadImage(agency?.logo)) || (fs.existsSync(FALLBACK_LOGO) ? fs.readFileSync(FALLBACK_LOGO) : null);
  const photo = await loadImage(card.photoUrl);

  const files: Record<string, Buffer> = {
    'thumbnail.png': await thumbnail(photo, card.name, 90),
    'thumbnail@2x.png': await thumbnail(photo, card.name, 180),
    'thumbnail@3x.png': await thumbnail(photo, card.name, 270),
  };
  if (logoSrc) {
    files['logo.png'] = await whiteLogo(logoSrc, 50);
    files['logo@2x.png'] = await whiteLogo(logoSrc, 100);
    files['logo@3x.png'] = await whiteLogo(logoSrc, 150);
    const square = (s: number) => sharp(logoSrc).resize(s, s, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer();
    files['icon.png'] = await square(29);
    files['icon@2x.png'] = await square(58);
    files['icon@3x.png'] = await square(87);
  }

  const apiBase = (env.APP_URL || '').replace(/\/$/, '');
  const pass = new PKPass(
    files,
    certificates(),
    {
      formatVersion: 1,
      passTypeIdentifier: env.WALLET_PASS_TYPE_ID!,
      teamIdentifier: env.WALLET_TEAM_ID!,
      serialNumber: card.id,
      organizationName: company,
      description: `${card.name} · ${company} business card`,
      // no logoText: the Hirdan logo already carries the wordmark
      backgroundColor: PURPLE,
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: GOLD,
      sharingProhibited: false,
      // Wallet only calls a public HTTPS server; local dev builds skip live updates.
      ...(apiBase.startsWith('https://') ? { webServiceURL: `${apiBase}/api/wallet`, authenticationToken: walletAuthToken(card.id) } : {}),
    },
  );

  pass.type = 'generic';
  pass.primaryFields.push({ key: 'name', label: '', value: card.name });
  pass.secondaryFields.push({ key: 'title', label: '', value: card.title });
  if (card.phone) pass.auxiliaryFields.push({ key: 'phone', label: 'PHONE', value: card.phone });
  if (card.email) pass.auxiliaryFields.push({ key: 'email', label: 'EMAIL', value: card.email });

  const back: Array<{ key: string; label: string; value: string }> = [];
  if (card.whatsapp) back.push({ key: 'whatsapp', label: 'WhatsApp', value: card.whatsapp });
  if (card.email) back.push({ key: 'email-back', label: 'Email', value: card.email });
  if (agency?.website) back.push({ key: 'website', label: 'Website', value: agency.website });
  if (agency?.address) back.push({ key: 'address', label: 'Address', value: agency.address });
  try {
    const socials = agency?.socialLinks ? JSON.parse(agency.socialLinks) : [];
    if (Array.isArray(socials)) {
      socials.filter((l) => typeof l?.url === 'string' && l.url.includes('.')).forEach((l, i) => back.push({ key: `social-${i}`, label: String(l.platform || 'Social'), value: String(l.url) }));
    }
  } catch {
    // ignore malformed social links
  }
  back.push({ key: 'card', label: 'Card link', value: cardUrl });
  if (card.bio) back.push({ key: 'bio', label: 'About', value: card.bio });
  pass.backFields.push(...back);

  pass.setBarcodes({ format: 'PKBarcodeFormatQR', message: cardUrl, messageEncoding: 'iso-8859-1', altText: 'Scan to save my contact' });

  return pass.getAsBuffer();
}

/** Tells every iPhone holding this card's pass to fetch the new version (APNs, empty payload). */
export async function pushWalletUpdate(cardId: string): Promise<void> {
  if (!isWalletConfigured()) return;
  const regs = await prisma.walletRegistration.findMany({ where: { cardId }, select: { pushToken: true } });
  if (regs.length === 0) return;
  const { signerCert, signerKey } = certificates();
  const client = http2.connect('https://api.push.apple.com', { cert: signerCert, key: signerKey });
  client.on('error', (err) => console.error('[wallet] APNs connection error:', err.message));
  await Promise.all(
    [...new Set(regs.map((r) => r.pushToken))].map(
      (token) =>
        new Promise<void>((resolve) => {
          const req = client.request({ ':method': 'POST', ':path': `/3/device/${token}`, 'apns-topic': env.WALLET_PASS_TYPE_ID! });
          req.on('response', (h) => {
            if (h[':status'] !== 200) console.warn(`[wallet] APNs push ${h[':status']} for a device of card ${cardId}`);
          });
          req.on('close', () => resolve());
          req.on('error', () => resolve());
          req.end('{}');
        }),
    ),
  );
  client.close();
}
