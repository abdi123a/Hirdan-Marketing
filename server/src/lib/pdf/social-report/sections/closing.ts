// Template sections 20 "Recommendations" and 21 "Thank You".
//
// Transcribed verbatim from templates/social-report sections 20-recommendations.html
// and 21-thank-you.html. Every inline style is copied byte for byte; only the
// literal sample values (the three recommendation cards, the month names) are
// replaced with values from `facts` / `narrative`. Fewer than three
// recommendations renders fewer rows — the designer's sample copy is never used
// as a filler.

import type { ReportFacts } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import { esc, slide, icon, logoWhite } from '../render-kit.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The report period's own month, e.g. 7 → "July". Empty when out of range. */
function monthName(month: number): string {
  if (!Number.isFinite(month) || month < 1 || month > 12) return '';
  return MONTH_NAMES[month - 1] ?? '';
}

/**
 * The calendar month after the report period, e.g. July 2026 → "August" / "August 2026".
 * December rolls into January of the following year.
 */
function nextPeriod(month: number, year: number): { monthName: string; label: string } {
  if (!Number.isFinite(month) || month < 1 || month > 12) return { monthName: '', label: '' };
  // `month` is 1-based, so it is already the 0-based index of the NEXT month.
  const idx = month === 12 ? 0 : month;
  const nextYear = month === 12 ? year + 1 : year;
  const name = MONTH_NAMES[idx] ?? '';
  if (!name) return { monthName: '', label: '' };
  return { monthName: name, label: Number.isFinite(year) ? `${name} ${nextYear}` : name };
}

// ── 20 · Recommendations ─────────────────────────────────────────────────────

export async function renderRecommendations(facts: ReportFacts, narrative: Narrative): Promise<string> {
  const next = nextPeriod(facts.period.month, facts.period.year);
  // The source heading names the month the recommendations apply to.
  const heading = next.monthName ? `Recommendations for ${next.monthName}` : 'Recommendations';

  // `narrative.recommendations` is unvalidated model JSON, so a title or body
  // may not be a string at runtime. Coerce before trimming — a bad entry must
  // drop out quietly, never throw and take the whole slide with it.
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  const recs = (Array.isArray(narrative.recommendations) ? narrative.recommendations : [])
    .filter(r => !!r && (!!str(r.title) || !!str(r.body)))
    .slice(0, 3);

  const rowsMarkup = recs.length
    ? recs.map((r, i) => {
        const numberLabel = String(i + 1).padStart(2, '0');
        const title = str(r.title);
        const body = str(r.body);
        return `    <div style="display:grid;grid-template-columns:110px 1fr;gap:44px;align-items:start;padding:40px 0;border-top:1px solid #E4E2E8;">
      <div style="font-size:56px;font-weight:800;color:#F2B01F;">${numberLabel}</div>
      <div style="display:flex;flex-direction:column;gap:16px;">${
        title
          ? `
        <div style="font-size:48px;font-weight:700;letter-spacing:-0.01em;color:#1C1A22;">${esc(title)}</div>`
          : ''}${
        body
          ? `
        <p style="margin:0;max-width:1350px;font-size:32px;line-height:1.4;font-weight:500;color:#6E6A7A;text-wrap:pretty;">${esc(body)}</p>`
          : ''}
      </div>
    </div>`;
      }).join('\n')
    // No recommendations: the heading plus an honest line, in the template's own
    // hairline row and body-copy treatment.
    : `    <div style="padding:40px 0;border-top:1px solid #E4E2E8;">
      <p style="margin:0;max-width:1350px;font-size:32px;line-height:1.4;font-weight:500;color:#6E6A7A;text-wrap:pretty;">No recommendations for this period.</p>
    </div>`;

  return slide(
    'background:#FBFAFC;padding:90px 100px 80px;display:flex;flex-direction:column;gap:44px;',
    `
  <div style="border-bottom:3px solid #1C1A22;padding-bottom:24px;">
    <div style="display:flex;align-items:center;gap:24px;"><svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#4E3D8F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><circle cx="12" cy="12" r="8.75"></circle><circle cx="12" cy="12" r="4.6"></circle></svg><h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">${esc(heading)}</h2></div>
  </div>
  <div style="display:flex;flex-direction:column;">
${rowsMarkup}
  </div>`,
  );
}

// ── 21 · Thank You ───────────────────────────────────────────────────────────

export async function renderThankYou(facts: ReportFacts, narrative: Narrative): Promise<string> {
  void narrative;

  const logo = await logoWhite();
  // If the logo asset is missing, keep the slot so the space-between row still
  // pushes the social icons to the right, rather than emitting an empty src
  // that renders as a broken-image box in the PDF.
  const logoMarkup = logo
    ? `<img src="${logo}" alt="Hirdan Marketing" style="width:300px;height:auto;display:block;">`
    : `<div style="width:300px;height:auto;display:block;"></div>`;

  const socials: { name: string; alt: string }[] = [
    { name: 'tiktok', alt: 'TikTok' },
    { name: 'instagram', alt: 'Instagram' },
    { name: 'youtube', alt: 'YouTube' },
    { name: 'facebook', alt: 'Facebook' },
  ];
  // Same guard as the logo: a missing icon file is dropped, never emitted as an
  // empty src.
  const socialIcons = await Promise.all(
    socials.map(async s => ({ alt: s.alt, uri: await icon(s.name, true) })),
  );
  const socialMarkup = socialIcons
    .filter(s => !!s.uri)
    .map(s => `      <img src="${s.uri}" alt="${esc(s.alt)}" style="width:48px;height:48px;display:block;">`)
    .join('\n');

  const periodMonth = monthName(facts.period.month) || 'this period';
  const next = nextPeriod(facts.period.month, facts.period.year);

  return slide(
    'background:#4E3D8F;padding:96px 100px 84px;display:flex;flex-direction:column;justify-content:space-between;',
    `
  <div style="display:flex;align-items:center;justify-content:space-between;">
    ${logoMarkup}
    <div style="display:flex;gap:18px;align-items:center;">
${socialMarkup}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:30px;">
    <h2 style="margin:0;font-size:112px;font-weight:800;letter-spacing:-0.035em;line-height:0.98;color:#FFFFFF;">Thank you</h2>
    <div style="width:160px;height:10px;background:#F2B01F;"></div>
    <p style="margin:0;max-width:1150px;font-size:36px;line-height:1.35;font-weight:500;color:#C9C2E4;text-wrap:pretty;">Thank you for another month of trust. We will keep building on what ${esc(periodMonth)} proved works, and we are here whenever you want to go deeper on any part of this report.</p>
  </div>
  <div style="display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid #6B5AB0;padding-top:34px;">
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="font-size:26px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#F2B01F;">Next review</div>
      <div style="font-size:36px;font-weight:600;color:#FFFFFF;">${next.label ? esc(next.label) : '—'}</div>
    </div>
    <div style="font-size:26px;font-weight:500;color:#9E93C9;">Hirdan Marketing · Djibouti</div>
  </div>`,
  );
}
