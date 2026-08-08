// Template sections 01 "Title" and 02 "Executive Summary".
//
// Transcribed verbatim from templates/social-report sections 01-title.html and
// 02-executive-summary.html. Every inline style is copied byte for byte; only
// the literal sample values (client name, month label, win figures, prose) are
// replaced with values from `facts` / `narrative`. Blocks whose data is missing
// are omitted rather than filled with the designer's sample numbers.

import type { ReportFacts } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import { esc, slide, logoWhite, coverHero } from '../render-kit.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The calendar month after the report period, e.g. July (7) → "August". */
function nextMonthName(month: number): string {
  if (!Number.isFinite(month) || month < 1 || month > 12) return '';
  // `month` is 1-based, so it is already the 0-based index of the NEXT month.
  const idx = month === 12 ? 0 : month;
  return MONTH_NAMES[idx] ?? '';
}

// ── 01 · Title ───────────────────────────────────────────────────────────────

export async function renderTitle(facts: ReportFacts, narrative: Narrative): Promise<string> {
  void narrative;

  const logo = await logoWhite();
  const logoMarkup = logo
    ? `<img src="${logo}" alt="Hirdan Marketing" style="width:300px;height:auto;display:block;">`
    : `<div style="width:300px;height:auto;display:block;"></div>`;

  // Cover hero: 3D social/analytics scene filling the panel right of the amber
  // rule. Missing asset falls back to the plain purple panel the template had.
  const hero = await coverHero();
  const heroMarkup = hero
    ? `<img src="${hero}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">`
    : '';

  return slide(
    'background:#4E3D8F;display:grid;grid-template-columns:1fr 760px;',
    `
  <div style="padding:96px 90px 84px 100px;display:flex;flex-direction:column;justify-content:space-between;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      ${logoMarkup}
    </div>
    <div style="display:flex;flex-direction:column;gap:30px;">
      <div style="font-size:26px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:#F2B01F;">Monthly Report · ${esc(facts.period.label)}</div>
      <h1 style="margin:0;font-size:122px;line-height:0.94;font-weight:800;letter-spacing:-0.035em;color:#FFFFFF;">Social Media<br>Performance</h1>
      <div style="width:160px;height:10px;background:#F2B01F;"></div>
      <div style="font-size:44px;font-weight:600;color:#FFFFFF;">${esc(facts.client.name)}</div>
    </div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid #6B5AB0;padding-top:34px;">
      <div style="font-size:26px;font-weight:500;color:#C9C2E4;">Prepared by Hirdan Marketing</div>
      <div style="font-size:26px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#9E93C9;">Djibouti</div>
    </div>
  </div>
  <div style="position:relative;border-left:12px solid #F2B01F;background:#FFFFFF;overflow:hidden;">
    ${heroMarkup}
  </div>`,
  );
}

// ── 02 · Executive Summary ───────────────────────────────────────────────────

export async function renderExecutiveSummary(facts: ReportFacts, narrative: Narrative): Promise<string> {
  // Nothing is connected, so there is nothing to summarise. The narrative layer
  // still produces confident prose in this case (built from zeros), so the
  // honest line has to be decided here, from the fact the builder provides.
  if (!facts.hasAccounts) {
    return slide(
      'background:#FFFFFF;padding:80px 100px 60px;display:flex;flex-direction:column;gap:30px;',
      `
  <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Executive Summary</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(facts.period.label)}</div>
  </div>
  <p style="margin:0;max-width:1560px;font-size:36px;line-height:1.3;font-weight:600;color:#1C1A22;text-wrap:pretty;">No connected accounts for this period.</p>`,
    );
  }

  const summary = (narrative.executiveSummary || '').trim();
  const miss = (narrative.miss || '').trim();
  const ask = (narrative.ask || '').trim();

  // Win fields are string-typed by declaration only: composeNarrative slices
  // them straight off raw model JSON, so a numeric "value" reaches us as a
  // number. Coerce before trimming rather than throwing away the slide.
  const s = (v: unknown) => (v == null ? '' : String(v)).trim();

  const wins = (Array.isArray(narrative.wins) ? narrative.wins : [])
    .filter(w => !!w && (!!s(w.value) || !!s(w.title) || !!s(w.body)))
    .slice(0, 3);

  // The source's first win card uses gap:12px and the other two gap:14px —
  // reproduced per index so a full three-win row matches the design exactly.
  const winsMarkup = wins.length
    ? `
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:48px;">
${wins.map((w, i) => {
      const label = s(w.label) || `Win ${i + 1}`;
      const value = s(w.value);
      const title = s(w.title);
      const body = s(w.body);
      return `      <div style="display:flex;flex-direction:column;gap:${i === 0 ? 12 : 14}px;">
        <div style="font-size:24px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#F2B01F;">${esc(label)}</div>${
        value
          ? `
        <div style="font-size:64px;font-weight:800;letter-spacing:-0.03em;line-height:1;color:#1C1A22;">${esc(value)}</div>`
          : ''}${
        title
          ? `
        <div style="font-size:30px;font-weight:700;color:#1C1A22;">${esc(title)}</div>`
          : ''}${
        body
          ? `
        <p style="margin:0;font-size:26px;line-height:1.4;font-weight:500;color:#6E6A7A;text-wrap:pretty;">${esc(body)}</p>`
          : ''}
      </div>`;
    }).join('\n')}
  </div>`
    : '';

  const askHeadingMonth = nextMonthName(facts.period.month);
  const askHeading = askHeadingMonth ? `The ask for ${askHeadingMonth}` : 'The ask';

  const footerCells: string[] = [];
  if (miss) {
    footerCells.push(`    <div style="background:#FBFAFC;padding:28px 36px;display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:24px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B3261E;">The miss</div>
      <p style="margin:0;font-size:30px;line-height:1.4;font-weight:600;color:#1C1A22;text-wrap:pretty;">${esc(miss)}</p>
    </div>`);
  }
  if (ask) {
    footerCells.push(`    <div style="background:#FBFAFC;padding:28px 36px;display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:24px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#4E3D8F;">${esc(askHeading)}</div>
      <p style="margin:0;font-size:30px;line-height:1.4;font-weight:600;color:#1C1A22;text-wrap:pretty;">${esc(ask)}</p>
    </div>`);
  }

  const footerMarkup = footerCells.length
    ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#E4E2E8;margin-top:auto;">
${footerCells.join('\n')}
  </div>`
    : '';

  // Nothing the model could say and no wins to show: an honest line rather than
  // an empty white slide or the template's sample copy.
  const bodyText = summary || (winsMarkup || footerMarkup ? '' : 'No data for this period.');

  return slide(
    'background:#FFFFFF;padding:80px 100px 60px;display:flex;flex-direction:column;gap:30px;',
    `
  <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Executive Summary</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(facts.period.label)}</div>
  </div>${bodyText ? `
  <p style="margin:0;max-width:1560px;font-size:36px;line-height:1.3;font-weight:600;color:#1C1A22;text-wrap:pretty;">${esc(bodyText)}</p>` : ''}${winsMarkup}${footerMarkup}`,
  );
}
