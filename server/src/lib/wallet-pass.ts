import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http2 from 'http2';
import sharp, { type OverlayOptions } from 'sharp';
import { PKPass } from 'passkit-generator';
import type { BusinessCard } from '@prisma/client';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { PATHS } from './paths.js';
import { getShortDomainBase } from './short-url.js';

// Apple Wallet business-card pass (generic style). Serial number = BusinessCard.id.
// Design (store-card style): drawn top strip with a camera photo in Hirdan purple, bold name +
// real verified badge, title in caps, rectangular photo; email + phone below; QR to the web card.

const CERT_DIR = path.resolve(env.WALLET_CERT_DIR || path.join(process.cwd(), 'certs', 'wallet'));
const PURPLE = 'rgb(80, 66, 137)';

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


const ASSETS = path.join(process.cwd(), 'assets', 'wallet');
const FONT_REGULAR = path.join(ASSETS, 'fonts', 'Inter-400.ttf');
const FONT_SEMIBOLD = path.join(ASSETS, 'fonts', 'Inter-600.ttf');
const FONT_BOLD = path.join(ASSETS, 'fonts', 'Inter-700.ttf');

/** Rectangular photo with rounded corners (initials on gold when there is no photo). */
async function rectPhoto(photo: Buffer | null, name: string, w: number, h: number, border = false): Promise<Buffer> {
  const r = Math.round(w * 0.08);
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
  const base = photo
    ? await sharp(photo).rotate().resize(w, h, { fit: 'cover', position: 'attention' }).png().toBuffer()
    : await sharp({ create: { width: w, height: h, channels: 4, background: '#F4B019' } })
        .composite([{ input: await textImage(initials(name), FONT_SEMIBOLD, '#504289', Math.round(h * 0.34), w), gravity: 'centre' }])
        .png().toBuffer();
  const clipped = await sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  if (!border) return clipped;
  const b = Math.max(2, Math.round(w * 0.025));
  const frame = Buffer.from(`<svg width="${w}" height="${h}"><rect x="${b / 2}" y="${b / 2}" width="${w - b}" height="${h - b}" rx="${r}" ry="${r}" fill="none" stroke="#fff" stroke-width="${b}"/></svg>`);
  return sharp(clipped).composite([{ input: frame }]).png().toBuffer();
}

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const escapeMarkup = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FAMILY: Record<string, string> = { [FONT_REGULAR]: 'Inter', [FONT_SEMIBOLD]: 'Inter SemiBold', [FONT_BOLD]: 'Inter Bold' };

/** Renders text with the bundled Inter font (crisp and identical on any server). No width = one line. */
function textImage(text: string, fontfile: string, color: string, px: number, width?: number, letterSpacing = 0): Promise<Buffer> {
  return sharp({
    text: {
      text: `<span foreground="${color}" letter_spacing="${Math.round(letterSpacing * 1024)}">${escapeMarkup(text)}</span>`,
      font: `${FAMILY[fontfile] || 'Inter'} ${px}`,
      fontfile,
      ...(width ? { width, wrap: 'word' as const } : {}),
      dpi: 72, // font size above is in pixels at 72 dpi
      rgba: true,
      spacing: Math.round(px * 0.12),
    },
  }).png().toBuffer();
}

const VERIFIED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="#fff"/><path fill="#1D9BF0" d="m8.6 22.5l-1.9-3.2l-3.6-.8l.35-3.7L1 12l2.45-2.8l-.35-3.7l3.6-.8l1.9-3.2L12 2.95l3.4-1.45l1.9 3.2l3.6.8l-.35 3.7L23 12l-2.45 2.8l.35 3.7l-3.6.8l-1.9 3.2l-3.4-1.45zm2.35-6.95L16.6 9.9l-1.4-1.45l-4.25 4.25l-2.15-2.1L7.4 12z"/></svg>`;

const width = async (img: Buffer) => (await sharp(img).metadata()).width || 0;
const height = async (img: Buffer) => (await sharp(img).metadata()).height || 0;

/**
 * Store-card strip (375×144 pt): camera photo toned into Hirdan purple with a centred light glow,
 * BOLD name with the real blue verified badge right after it, title in caps, rectangular photo on the right.
 */
export async function strip(card: BusinessCard, photo: Buffer | null, scale: number): Promise<Buffer> {
  const W = 375 * scale;
  const H = 144 * scale;
  const pad = 16 * scale;
  const cover = await sharp(path.join(ASSETS, 'cover.jpg')).resize(W, H, { fit: 'cover', position: 'centre' }).grayscale().png().toBuffer();
  const tone = Buffer.from(`<svg width="${W}" height="${H}"><defs>
      <radialGradient id="glow" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#504289" stop-opacity=".55"/><stop offset=".6" stop-color="#504289" stop-opacity=".2"/><stop offset="1" stop-color="#504289" stop-opacity="0"/></linearGradient>
    </defs><rect width="100%" height="100%" fill="url(#fade)"/><rect width="100%" height="100%" fill="url(#glow)"/></svg>`);
  const purple = Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="#504289"/></svg>`);

  const photoW = Math.round(H * 0.62);
  const photoH = Math.round(H * 0.72);
  const textW = W - photoW - pad * 3;
  const badge = Math.round(20 * scale);
  const gap = Math.round(5 * scale);

  // Name: one line if it fits next to the badge, else two balanced lines, shrinking if still too wide.
  const words = card.name.trim().split(/\s+/);
  let size = 24 * scale;
  let lines: Buffer[] = [];
  for (; size >= 15 * scale; size -= scale) {
    const one = await textImage(card.name, FONT_BOLD, '#FFFFFF', size);
    if ((await width(one)) + gap + badge <= textW) { lines = [one]; break; }
    const cut = Math.max(1, Math.ceil(words.length / 2));
    const two = [await textImage(words.slice(0, cut).join(' '), FONT_BOLD, '#FFFFFF', size), await textImage(words.slice(cut).join(' ') || ' ', FONT_BOLD, '#FFFFFF', size)];
    if ((await width(two[0])) <= textW && (await width(two[1])) + gap + badge <= textW) { lines = two; break; }
  }
  if (lines.length === 0) lines = [await textImage(card.name, FONT_BOLD, '#FFFFFF', size, textW)];

  const title = await textImage(card.title.toUpperCase(), FONT_SEMIBOLD, '#F4B019', Math.round(11 * scale), textW, 1.2 * scale);
  const lineH = await Promise.all(lines.map(height));
  const lineGap = 2 * scale;
  const blockH = lineH.reduce((a, b) => a + b, 0) + lineGap * (lines.length - 1) + 6 * scale + (await height(title));
  let y = Math.round((H - blockH) / 2);
  const layers: OverlayOptions[] = [];
  for (let i = 0; i < lines.length; i++) {
    layers.push({ input: lines[i], top: y, left: pad });
    if (i === lines.length - 1) {
      const badgeImg = await sharp(Buffer.from(VERIFIED_SVG)).resize(badge, badge).png().toBuffer();
      layers.push({ input: badgeImg, top: y + Math.round((lineH[i] - badge) / 2), left: pad + (await width(lines[i])) + gap });
    }
    y += lineH[i] + (i < lines.length - 1 ? lineGap : 0);
  }
  layers.push({ input: title, top: y + 6 * scale, left: pad });
  layers.push({ input: await rectPhoto(photo, card.name, photoW, photoH, true), top: Math.round((H - photoH) / 2), left: W - photoW - pad });

  return sharp(purple)
    .composite([{ input: await sharp(cover).png().toBuffer(), blend: 'soft-light' }, { input: tone }, ...layers])
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

const FALLBACK_LOGO = path.join(ASSETS, 'logo.png');

export async function buildPass(card: BusinessCard): Promise<Buffer> {
  const agency = await prisma.agencySettings.findFirst({ select: { agencyName: true, logo: true, whiteLogo: true, website: true, address: true, socialLinks: true } });
  const company = agency?.agencyName || 'Hirdan Marketing';
  const cardUrl = `${getShortDomainBase()}/c/${card.slug}`;

  const logoSrc = (await loadImage(agency?.whiteLogo)) || (await loadImage(agency?.logo)) || (fs.existsSync(FALLBACK_LOGO) ? fs.readFileSync(FALLBACK_LOGO) : null);
  const photo = await loadImage(card.photoUrl);

  const files: Record<string, Buffer> = {
    'strip.png': await strip(card, photo, 1),
    'strip@2x.png': await strip(card, photo, 2),
    'strip@3x.png': await strip(card, photo, 3),
  };
  if (logoSrc) {
    files['logo.png'] = await whiteLogo(logoSrc, 30);
    files['logo@2x.png'] = await whiteLogo(logoSrc, 60);
    files['logo@3x.png'] = await whiteLogo(logoSrc, 90);
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
      labelColor: 'rgb(244, 176, 25)',
      sharingProhibited: false,
      // Wallet only calls a public HTTPS server; local dev builds skip live updates.
      ...(apiBase.startsWith('https://') ? { webServiceURL: `${apiBase}/api/wallet`, authenticationToken: walletAuthToken(card.id) } : {}),
    },
  );

  // Store-card style: the strip image carries the bold name + real badge, title and photo.
  pass.type = 'storeCard';
  if (card.email) pass.secondaryFields.push({ key: 'email', label: 'EMAIL', value: card.email });
  if (card.phone) pass.secondaryFields.push({ key: 'phone', label: 'PHONE', value: card.phone, textAlignment: 'PKTextAlignmentRight' });

  const back: Array<{ key: string; label: string; value: string }> = [{ key: 'fullname', label: 'Name', value: card.name }];
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
