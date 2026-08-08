// Rendering primitives shared by the report's section templates.
//
// The section modules are near-verbatim transcriptions of the designed template:
// same inline styles, same colours, same markup. Only the values are dynamic.
// Anything here that isn't a value-formatter exists because Puppeteer renders
// from a string with no base URL, so assets have to be inlined.

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ASSET_DIR = path.resolve(__dirname, '../../../../templates/social-report/assets');

// ── palette (copied from the design, do not re-pick) ─────────────────────────
export const C = {
  purple: '#4E3D8F',
  amber: '#F2B01F',
  amberSoft: '#F6C95C',
  ink: '#1C1A22',
  muted: '#6E6A7A',
  hairline: '#E4E2E8',
  white: '#FFFFFF',
  offWhite: '#FBFAFC',
  page: '#F4F3F6',
  lilac: '#C9C2E4',
  positive: '#1E7A4C',
  negative: '#B3261E',
} as const;

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

// ── escaping ─────────────────────────────────────────────────────────────────

/** Escape text for HTML body/attribute interpolation. */
export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── number / date formatting ─────────────────────────────────────────────────

/** 734800 → "734.8K", 1_240_000 → "1.24M". Matches the template's style. */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    return `${trimZero(v.toFixed(abs >= 10_000_000 ? 1 : 2))}M`;
  }
  if (abs >= 1_000) {
    const v = n / 1_000;
    return `${trimZero(v.toFixed(abs >= 10_000 ? 1 : 1))}K`;
  }
  return String(Math.round(n));
}

function trimZero(s: string): string {
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** 412600 → "412,600" */
export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

/** 6.3 → "6.3%" */
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Number(n.toFixed(digits))}%`;
}

/** 0.714 → "71.4%" */
export function fractionPct(f: number | null | undefined, digits = 1): string {
  if (f == null || !Number.isFinite(f)) return '—';
  return `${Number((f * 100).toFixed(digits))}%`;
}

/** +38 → "+38% vs. June"; null → "" (the template omits the line entirely). */
export function deltaLabel(changePct: number | null | undefined, prevMonthLabel: string): string {
  if (changePct == null || !Number.isFinite(changePct)) return '';
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${Number(changePct.toFixed(1))}% vs. ${prevMonthLabel}`;
}

export function deltaColor(changePct: number | null | undefined): string {
  if (changePct == null) return C.muted;
  return changePct >= 0 ? C.positive : C.negative;
}

/** ISO → "04 Jul 2026" */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${day} ${mon} ${d.getUTCFullYear()}`;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Display names exactly as the template writes them. */
export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  threads: 'Threads',
  pinterest: 'Pinterest',
};

// ── chart scale helpers ──────────────────────────────────────────────────────
// The template's charts are hand-plotted: someone computed pixel geometry for
// one month's numbers and pasted the results. These reproduce the same shapes
// from live values, which is the one place a verbatim copy is impossible.

/**
 * Map values onto a pixel band, where the largest value fills `maxPx`.
 * Returns 0 for every entry when nothing is positive, so an empty month draws
 * a flat baseline rather than dividing by zero.
 */
export function scaleBars(values: number[], maxPx: number, minPx = 0): number[] {
  const peak = Math.max(...values, 0);
  if (peak <= 0) return values.map(() => minPx);
  return values.map(v => Math.max(minPx, (Math.max(0, v) / peak) * maxPx));
}

/**
 * Y coordinates for a line series inside a plot box, given an explicit value
 * range. Higher values sit nearer the top, matching SVG's inverted axis.
 */
export function scaleLine(
  values: number[],
  opts: { top: number; bottom: number; min?: number; max?: number },
): number[] {
  const { top, bottom } = opts;
  const lo = opts.min ?? Math.min(...values, 0);
  const hi = opts.max ?? Math.max(...values, 0);
  const span = hi - lo;
  if (span <= 0) return values.map(() => bottom);
  return values.map(v => bottom - ((v - lo) / span) * (bottom - top));
}

/** Evenly spaced band centres across a width — one per item. */
export function bandCentres(count: number, width: number, startX = 0): number[] {
  if (count <= 0) return [];
  const step = width / count;
  return Array.from({ length: count }, (_, i) => startX + step * i + step / 2);
}

/**
 * Conic-gradient stops for a donut, in the template's colour order.
 * Segments are laid out cumulatively so they meet exactly at 360deg.
 */
export function conicStops(
  slices: { fraction: number }[],
  colors: string[],
): string {
  const parts: string[] = [];
  let acc = 0;
  slices.forEach((s, i) => {
    const from = acc * 360;
    acc += s.fraction;
    const to = acc * 360;
    parts.push(`${colors[i % colors.length]} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`);
  });
  return parts.join(', ');
}

/** The donut colour ramp used on the mix and locations slides. */
export const DONUT_COLORS = [C.purple, C.amber, C.lilac, '#8E7FC4', C.amberSoft, '#B7AEDC', '#D8D3EC'];

// ── assets ───────────────────────────────────────────────────────────────────

const assetCache = new Map<string, string>();

/**
 * Inline an asset as a data URI.
 *
 * Puppeteer's setContent has no file-relative base URL, so every `src` in the
 * template has to become a data URI or it silently renders as a broken image.
 * Results are cached because one report references the same icons repeatedly.
 */
export async function assetDataUri(relPath: string): Promise<string> {
  const cached = assetCache.get(relPath);
  if (cached) return cached;

  const full = path.resolve(ASSET_DIR, relPath);
  // Keep reads inside the asset directory — section templates build these paths.
  if (!full.startsWith(ASSET_DIR)) throw new Error(`Asset path escapes template dir: ${relPath}`);

  const buf = await readFile(full);
  const ext = path.extname(full).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml'
    : ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : 'application/octet-stream';
  const uri = `data:${mime};base64,${buf.toString('base64')}`;
  assetCache.set(relPath, uri);
  return uri;
}

/** Icon by template name, e.g. icon('chart') or icon('tiktok', true) for amber. */
export async function icon(name: string, amber = false): Promise<string> {
  const social = ['tiktok', 'instagram', 'facebook', 'youtube'];
  const ext = social.includes(name) ? 'png' : 'svg';
  const file = amber ? `${name}-amber.${ext}` : `${name}.${ext}`;
  try {
    return await assetDataUri(path.join('icons', file));
  } catch {
    return '';
  }
}

export async function logoWhite(): Promise<string> {
  try {
    return await assetDataUri('logo-white.png');
  } catch {
    return '';
  }
}

/** Title-slide hero artwork. Empty string keeps the cover's plain right panel. */
export async function coverHero(): Promise<string> {
  try {
    return await assetDataUri('cover-hero.jpg');
  } catch {
    return '';
  }
}

/**
 * Content types allowed into a generated data URI. The remote server chooses
 * its own Content-Type header, and that value ends up inside an HTML attribute
 * in the rendered slide, so it is treated as hostile input: anything not on
 * this list is rejected outright rather than echoed back.
 */
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * A remote image (post thumbnail) as a data URI.
 *
 * Returns null on any failure — a missing thumbnail must degrade to the
 * template's empty slot, never break the render or leave a dead <img>.
 */
export async function remoteImageDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    // Strip any parameters (charset, boundary…) and match the bare type against
    // the whitelist — the emitted URI carries the whitelisted string, never the
    // server's raw header.
    const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]!.trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Guard against a pathological asset blowing up the PDF payload.
    if (buf.length > 5 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── section frame ────────────────────────────────────────────────────────────

/**
 * Wrap a section's inner markup in the template's fixed-size slide frame.
 * `style` carries that section's own background/padding/layout declarations,
 * copied from the design.
 */
export function slide(style: string, inner: string): string {
  return `<section style="width:${SLIDE_W}px;height:${SLIDE_H}px;box-sizing:border-box;overflow:hidden;${style}">${inner}</section>`;
}
