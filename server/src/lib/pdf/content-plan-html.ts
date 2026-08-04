import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PATHS } from '../paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Templates live at server/templates/content-plan */
export const CONTENT_PLAN_TEMPLATE_DIR = path.resolve(
  __dirname,
  '../../../templates/content-plan'
);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = [
  'SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
];

const CONTENT_TYPE_COLORS: Record<string, string> = {
  video: '#4338ca',
  photo: '#e11d48',
  story: '#ea580c',
  graphic: '#ca8a04',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  photo: 'Photo',
  story: 'Story',
  graphic: 'Graphic',
};

/** Card status colors (all statuses still render on cards). */
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#57534e',
  SCHEDULED: '#0f766e',
  FILMED: '#5DCAA5',
  PUBLISHED: '#EF9F27',
  DELAYED: '#E24B4A',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  FILMED: 'Filmed',
  PUBLISHED: 'Published',
  DELAYED: 'Delayed',
};

const STATUS_SHORT: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Sched',
  FILMED: 'Filmed',
  PUBLISHED: 'Live',
  DELAYED: 'Delay',
};

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: 'instagram.png',
  FACEBOOK: 'Facebook.png',
  LINKEDIN: 'linkedin.png',
  YOUTUBE: 'youtube.png',
  X: 'twitter.png',
  TIKTOK: 'tiktok.png',
  PINTEREST: 'pinterest.png',
};

/** Legend only: event types + Scheduled (PDF doesn't need every workflow status). */
const LEGEND_STATUS_KEYS = ['SCHEDULED'] as const;

const SHOOT_EVENT_COLOR = '#1d4ed8';
const GOES_LIVE_COLOR = '#c026d3';

export type ContentPlanPostInput = {
  id: string;
  title: string;
  status: string;
  contentType?: string | null;
  shootingDate?: string | null;
  publishDate?: string | null;
  platforms: string[];
};

export type ContentPlanAgencyInput = {
  agencyName?: string | null;
  logo?: string | null;
  primaryColor?: string | null;
  phone?: string | null;
  adminEmail?: string | null;
  website?: string | null;
};

export type ContentPlanPdfInput = {
  clientName: string;
  month: number;
  year: number;
  agency: ContentPlanAgencyInput;
  posts: ContentPlanPostInput[];
};

type CalendarEvent = {
  id: string;
  post: ContentPlanPostInput;
  type: 'SHOOT' | 'PUBLISH';
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#') || hex.length < 7) {
    return `rgba(90, 66, 138, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Number.isNaN(r) ? 80 : r}, ${Number.isNaN(g) ? 65 : g}, ${Number.isNaN(b) ? 136 : b}, ${alpha})`;
}

function inferContentType(title: string, platforms: string[]): string {
  const t = title.toLowerCase();
  if (/\bvideo\b|\breel\b|\btiktok\b|\bshort\b|\bfilm\b|\bfilmed\b|\brecord/.test(t)) return 'video';
  if (/\bstory\b|\bstories\b/.test(t)) return 'story';
  if (/\bphoto\b|\bpicture\b|\bimage\b|\bpic\b|\bshot\b/.test(t)) return 'photo';
  if (platforms.some((p) => p === 'TIKTOK' || p === 'YOUTUBE')) return 'video';
  return 'graphic';
}

function buildCalendarGrid(month: number, year: number): (number | null)[][] {
  // Week starts Saturday: Sat=0 … Fri=6 (JS getDay is Sun=0 … Sat=6).
  const jsDay = new Date(year, month - 1, 1).getDay();
  const firstDay = (jsDay + 1) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function parseDay(dateStr: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
  };
}

function getEventsForDay(
  posts: ContentPlanPostInput[],
  day: number | null,
  month: number,
  year: number
): CalendarEvent[] {
  if (!day) return [];
  const events: CalendarEvent[] = [];
  for (const post of posts) {
    const shoot = parseDay(post.shootingDate);
    if (shoot && shoot.y === year && shoot.m === month && shoot.d === day) {
      events.push({ id: `${post.id}-shoot`, post, type: 'SHOOT' });
    }
    const publish = parseDay(post.publishDate);
    if (publish && publish.y === year && publish.m === month && publish.d === day) {
      events.push({ id: `${post.id}-publish`, post, type: 'PUBLISH' });
    }
  }
  return events;
}

/**
 * Resolve branding / icon assets for Puppeteer setContent.
 * Local files become data: URIs (file:// is blocked by Chrome in setContent).
 */
function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function fileToDataUri(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return `data:${mimeFromExt(filePath)};base64,${buf.toString('base64')}`;
}

/** Downscale large logos so the PDF stays small (header only needs ~400px). */
function logoToDataUri(filePath: string): string {
  const size = fs.statSync(filePath).size;
  if (size < 80_000 || process.platform !== 'darwin') {
    return fileToDataUri(filePath);
  }
  try {
    const tmp = path.join(os.tmpdir(), `content-plan-logo-${process.pid}-${Date.now()}.jpg`);
    execFileSync(
      '/usr/bin/sips',
      ['-Z', '480', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', filePath, '--out', tmp],
      { stdio: 'pipe' }
    );
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return fileToDataUri(filePath);
  }
}

function resolveLocalUploadPath(raw: string): string | null {
  let pathname = raw.trim();
  if (!pathname) return null;

  if (/^https?:\/\//i.test(pathname)) {
    try {
      const u = new URL(pathname);
      pathname = u.pathname;
    } catch {
      return null;
    }
  }

  // Skip placeholders — fall back to agency name text instead.
  if (/placehold\.co/i.test(raw)) return null;

  const uploadMatch = pathname.match(/^\/?(?:api\/)?(?:files\/)?uploads\/(.+)$/i);
  if (uploadMatch) {
    const filePath = path.join(PATHS.UPLOADS_ROOT, uploadMatch[1]);
    if (fs.existsSync(filePath)) return filePath;
  }

  // Also try branding files referenced without the uploads prefix.
  const brandingMatch = pathname.match(/^\/?(?:api\/)?(?:files\/)?branding\/(.+)$/i);
  if (brandingMatch) {
    const filePath = path.join(PATHS.BRANDING, brandingMatch[1]);
    if (fs.existsSync(filePath)) return filePath;
  }

  if (path.isAbsolute(pathname) && fs.existsSync(pathname)) return pathname;
  return null;
}

export function resolveAssetUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const url = raw.trim();
  if (!url) return '';
  if (/^data:/i.test(url)) return url;
  if (/placehold\.co/i.test(url)) return '';

  const local = resolveLocalUploadPath(url);
  if (local) return logoToDataUri(local);

  // External https URLs (CDN) — Puppeteer can fetch these.
  if (/^https?:\/\//i.test(url)) return url;

  return '';
}

function platformIconUrl(platform: string): string {
  const file = PLATFORM_ICONS[platform];
  if (!file) return '';
  const filePath = path.join(CONTENT_PLAN_TEMPLATE_DIR, 'assets', 'social', file);
  if (!fs.existsSync(filePath)) return '';
  return fileToDataUri(filePath);
}

/** Embed each social icon once as CSS — avoids repeating huge base64 in every card. */
function buildPlatformIconCss(): { css: string; available: Set<string> } {
  const available = new Set<string>();
  const rules: string[] = [];
  for (const platform of Object.keys(PLATFORM_ICONS)) {
    const src = platformIconUrl(platform);
    if (!src) continue;
    available.add(platform);
    rules.push(`.platform-icon--${platform.toLowerCase()}{background-image:url("${src}")}`);
  }
  return { css: rules.join('\n'), available };
}

function renderPlatformStack(platforms: string[], availableIcons: Set<string>): string {
  const shown = platforms.slice(0, 4);
  if (shown.length === 0) return '';
  return `<div class="platform-stack">${shown
    .map((pl, i) => {
      const z = shown.length - i;
      if (!availableIcons.has(pl)) {
        return `<span class="platform-stack__icon" style="z-index:${z}" title="${escapeHtml(pl)}"><span class="platform-stack__fallback">${escapeHtml((pl || '?').slice(0, 1))}</span></span>`;
      }
      return `<span class="platform-stack__icon platform-icon--${pl.toLowerCase()}" style="z-index:${z}" title="${escapeHtml(pl)}"></span>`;
    })
    .join('')}</div>`;
}

function renderEventCard(ev: CalendarEvent, availableIcons: Set<string>): string {
  const post = ev.post;
  const isShoot = ev.type === 'SHOOT';
  const contentType =
    post.contentType && CONTENT_TYPE_COLORS[post.contentType]
      ? post.contentType
      : inferContentType(post.title, post.platforms);
  const accent = CONTENT_TYPE_COLORS[contentType] || '#9b8fd4';
  const statusColor = STATUS_COLORS[post.status] || STATUS_COLORS.DRAFT;
  const statusLabel = STATUS_SHORT[post.status] || STATUS_LABELS[post.status] || post.status;
  const eventLabel = isShoot ? 'Shooting date' : 'Goes live';
  const eventColor = isShoot ? SHOOT_EVENT_COLOR : GOES_LIVE_COLOR;
  const typeLabel = CONTENT_TYPE_LABELS[contentType] || 'Post';
  const kindClass = isShoot ? 'event-card--shoot' : 'event-card--live';

  const statusChip =
    !isShoot && post.status !== 'DRAFT'
      ? `<span class="chip chip--status" style="--chip-bg:${hexToRgba(statusColor, 0.16)};--chip-color:${statusColor}">${escapeHtml(statusLabel)}</span>`
      : '';

  return `
    <div class="event-card ${kindClass}" style="--accent:${accent};--event-color:${eventColor}">
      <div class="event-card__title">${escapeHtml(post.title)}</div>
      <div class="event-card__chips">
        <span class="chip chip--event" style="--chip-bg:${hexToRgba(eventColor, 0.16)};--chip-color:${eventColor}">${escapeHtml(eventLabel)}</span>
        ${statusChip}
      </div>
      <div class="event-card__footer">
        <span class="event-card__type">${escapeHtml(typeLabel)}</span>
        ${renderPlatformStack(post.platforms, availableIcons)}
      </div>
    </div>
  `;
}

function renderLegendPill(opts: {
  label: string;
  color: string;
  bg: string;
  border: string;
  swatch?: string;
}): string {
  const swatch = opts.swatch
    ? `<span class="legend-pill__swatch" style="background:${hexToRgba(opts.color, 0.14)};color:${opts.color}">${escapeHtml(opts.swatch)}</span>`
    : `<span class="legend-pill__dot"></span>`;
  return `
    <span class="legend-pill" style="--pill-color:${opts.color};--pill-bg:${opts.bg};--pill-border:${opts.border}">
      ${swatch}
      <span class="legend-pill__label">${escapeHtml(opts.label)}</span>
    </span>
  `;
}

function iconPhone(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
}

function iconEmail(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
}

function iconWeb(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
}

export function buildContentPlanHtml(input: ContentPlanPdfInput): string {
  const cssPath = path.join(CONTENT_PLAN_TEMPLATE_DIR, 'pdf.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const primary = input.agency.primaryColor || '#5A428A';
  const agencyName = input.agency.agencyName || 'Hirdan Marketing';
  const logoUrl = resolveAssetUrl(input.agency.logo);
  const monthLabel = MONTHS[input.month - 1] || String(input.month);
  const weeks = buildCalendarGrid(input.month, input.year);
  const generated = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const website = (input.agency.website || '').replace(/^https?:\/\//i, '');
  const { css: platformIconCss, available: availableIcons } = buildPlatformIconCss();

  // Text-only watermark keeps PDF small (logo PNGs can be hundreds of KB).
  const watermark = `<div class="watermark-text">${escapeHtml(agencyName.split(' ')[0] || 'Hirdan')}</div>`;

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(agencyName)}" />`
    : `<div class="header__agency-name">${escapeHtml(agencyName)}</div>`;

  const weekHtml = weeks
    .map((week) => {
      const weekMaxEvents = Math.max(
        1,
        ...week.map((day) => getEventsForDay(input.posts, day, input.month, input.year).length)
      );
      const cellMinHeight = Math.max(108, 36 + weekMaxEvents * 78);

      const cells = week
        .map((day, di) => {
          // Sat-start week: Sat=0, Fri=6
          const isWeekend = di === 0 || di === 6;
          if (!day) {
            const emptyWeekend = isWeekend ? ' day-cell--weekend' : '';
            return `<div class="day-cell day-cell--empty${emptyWeekend}" style="min-height:${cellMinHeight}px"></div>`;
          }
          const events = getEventsForDay(input.posts, day, input.month, input.year);
          const weekendClass = isWeekend ? ' day-cell--weekend' : '';
          const hasEventsClass = events.length > 0 ? ' day-cell--active' : '';
          return `
            <div class="day-cell${weekendClass}${hasEventsClass}" style="min-height:${cellMinHeight}px">
              <div class="day-cell__head">
                <span class="day-cell__num">${day}</span>
              </div>
              <div class="day-cell__events">${events.map((ev) => renderEventCard(ev, availableIcons)).join('')}</div>
            </div>
          `;
        })
        .join('');
      return `<div class="calendar__week">${cells}</div>`;
    })
    .join('');

  const statusPills = LEGEND_STATUS_KEYS.map((key) => {
    const label = STATUS_LABELS[key];
    const color = STATUS_COLORS[key];
    return renderLegendPill({
      label,
      color,
      bg: hexToRgba(color, 0.12),
      border: hexToRgba(color, 0.45),
    });
  }).join('');

  const typePills = Object.entries(CONTENT_TYPE_LABELS)
    .map(([key, label]) => {
      const color = CONTENT_TYPE_COLORS[key];
      return renderLegendPill({
        label,
        color,
        bg: hexToRgba(color, 0.12),
        border: hexToRgba(color, 0.45),
        swatch: label.slice(0, 1),
      });
    })
    .join('');

  const contacts: string[] = [];
  if (input.agency.phone) {
    contacts.push(
      `<span class="footer__item">${iconPhone()}<span>${escapeHtml(input.agency.phone)}</span></span>`
    );
  }
  if (input.agency.adminEmail) {
    contacts.push(
      `<span class="footer__item">${iconEmail()}<span>${escapeHtml(input.agency.adminEmail)}</span></span>`
    );
  }
  if (website) {
    contacts.push(
      `<span class="footer__item footer__item--accent">${iconWeb()}<span>${escapeHtml(website)}</span></span>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.clientName)} — ${escapeHtml(monthLabel)} ${input.year} Content Plan</title>
  <style>${css}
${platformIconCss}</style>
</head>
<body style="--primary:${primary};--primary-border:${hexToRgba(primary, 0.35)};--primary-tint:${hexToRgba(primary, 0.08)}">
  <div class="plan">
    <div class="watermark">${watermark}</div>
    <div class="top-bar">
      <div class="top-bar__primary"></div>
      <div class="top-bar__accent"></div>
    </div>
    <div class="plan-body">
      <header class="header">
        <div class="header__logo">${logoBlock}</div>
        <div class="header__right">
          <div class="header__title">CONTENT PLAN</div>
          <div class="meta-grid">
            <div class="meta-card meta-card--client">
              <div class="meta-card__label">Client</div>
              <div class="meta-card__value">${escapeHtml(input.clientName)}</div>
            </div>
            <div class="meta-card meta-card--schedule">
              <div class="meta-card__label">Schedule</div>
              <div class="meta-card__value">${escapeHtml(monthLabel)} ${input.year}</div>
            </div>
          </div>
        </div>
      </header>

      <section class="calendar">
        <div class="calendar__head">
          ${DAYS_OF_WEEK.map((d) => `<div class="calendar__dow">${d}</div>`).join('')}
        </div>
        ${weekHtml}
      </section>

      <section class="legend">
        <div class="legend__title">How to read this plan</div>
        <div class="legend__row">
          ${renderLegendPill({
            label: 'Shooting date',
            color: SHOOT_EVENT_COLOR,
            bg: hexToRgba(SHOOT_EVENT_COLOR, 0.12),
            border: hexToRgba(SHOOT_EVENT_COLOR, 0.45),
          })}
          ${renderLegendPill({
            label: 'Goes live',
            color: GOES_LIVE_COLOR,
            bg: hexToRgba(GOES_LIVE_COLOR, 0.12),
            border: hexToRgba(GOES_LIVE_COLOR, 0.45),
          })}
          ${statusPills}
        </div>
        <div class="legend__row">${typePills}</div>
      </section>
    </div>

    <footer class="footer">
      <div class="footer__accent"></div>
      <div class="footer__row">
        <div>
          <div class="footer__prepared">Prepared by ${escapeHtml(agencyName.toUpperCase())}</div>
          <div class="footer__date">Plan generated ${escapeHtml(generated)}</div>
        </div>
        <div class="footer__contacts">${contacts.join('')}</div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}
