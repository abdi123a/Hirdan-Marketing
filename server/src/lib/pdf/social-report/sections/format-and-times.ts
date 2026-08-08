// Template sections 15 ("Format Performance") and 16 ("Best Times to Post").
//
// Both are transcribed from the designed HTML: every inline style, colour and
// px value is copied verbatim. Only the values move — format names, average
// reach, engagement rate and bar widths on 15; the heatmap cell intensities,
// band emphasis and the closing window caption on 16.

import type { ReportFacts } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import { slide, esc, num, pct, scaleBars } from '../render-kit.js';

// ── section 15 ───────────────────────────────────────────────────────────────

const FORMAT_STYLE =
  'background:#FFFFFF;padding:90px 100px 80px;display:flex;flex-direction:column;gap:48px;';

/** The design draws five format rows; the slide is a fixed 1080px tall. */
const FORMAT_SLOTS = 5;

/** Bar fill ramp, strongest first — copied from the five sample rows. */
const BAR_COLORS = ['#4E3D8F', '#6B5AB0', '#8B7BC8', '#ADA3D6', '#C9C2E4'];

/**
 * The per-format glyphs, copied verbatim from the template. These are inline
 * SVG in the source, not assets. A format the design never drew (formatOf()
 * can emit "Other" or a platform's own media type) gets a same-size spacer so
 * the label stays on the grid — inventing a glyph would mislabel the row.
 */
const FORMAT_ICONS: Record<string, string> = {
  'Short video':
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><rect x="2.5" y="6" width="13" height="12" rx="2.5"></rect><path d="M15.5 11 21.5 7.5v9L15.5 13z"></path></svg>',
  'Long-form video':
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"></rect><path d="M8 4.5v15M16 4.5v15M2.5 12h19"></path></svg>',
  'Photo carousel':
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><rect x="7" y="3.5" width="14" height="14" rx="2.5"></rect><path d="M17 17.5v1a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 18.5V9"></path></svg>',
  'Single photo':
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><rect x="3" y="4.5" width="18" height="15" rx="2.5"></rect><circle cx="8.5" cy="10" r="1.8"></circle><path d="M3.5 17.5 9 12.5l4 3.5 3-2.5 4.5 4"></path></svg>',
  Story:
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><circle cx="12" cy="12" r="8.75" stroke-dasharray="3.2 2.4"></circle><path d="M10.3 9.2 15 12l-4.7 2.8z"></path></svg>',
};

const ICON_SPACER = '<div style="width:32px;height:32px;flex:none;"></div>';

/** "100%", "55.2%", "21%" — the template's own bar-width notation. */
function barWidth(px: number): string {
  return `${Number(px.toFixed(1))}%`;
}

function formatHeader(periodLabel: string): string {
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Format Performance</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">Average per post, ${esc(periodLabel)}</div>
  </div>`;
}

/** Section 15 — average reach and engagement rate by content format. */
export async function renderFormatPerformance(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  const rows = (facts.formats || []).slice(0, FORMAT_SLOTS);

  // A format row only says something when it carries a measured reach or a
  // measured engagement rate. Reach arrives as a plain 0 both for "reached
  // nobody" and for "the platform never reported reach" (imported posts are
  // merged in with reach: 0), so a non-positive avgReach is treated as unknown.
  const hasUsableData = rows.some(
    r => r.avgReach > 0 || (r.engagementRate != null && Number.isFinite(r.engagementRate)),
  );

  if (rows.length === 0 || !hasUsableData) {
    // Two different truths: nothing was published, versus things were published
    // but the platform never reported reach or engagement for them. Saying "no
    // posts were recorded" in the second case tells the client something false.
    const emptyLine = rows.length === 0
      ? `No posts with format data were recorded in ${esc(facts.period.label)}.`
      : `Reach and engagement were not reported for posts published in ${esc(facts.period.label)}.`;
    return slide(
      FORMAT_STYLE,
      `
  ${formatHeader(facts.period.label)}
  <p style="margin:0;max-width:1400px;font-size:34px;line-height:1.45;font-weight:500;color:#3A3746;text-wrap:pretty;">${emptyLine}</p>
`,
    );
  }

  const widths = scaleBars(rows.map(r => Math.max(0, r.avgReach || 0)), 100);

  const body = rows
    .map((r, i) => {
      const lead = i === 0;
      const nameStyle = lead
        ? 'font-size:34px;font-weight:700;color:#1C1A22;'
        : 'font-size:34px;font-weight:600;color:#3A3746;';
      const valueStyle = lead
        ? 'font-size:30px;font-weight:700;color:#1C1A22;white-space:nowrap;'
        : 'font-size:30px;font-weight:600;color:#3A3746;white-space:nowrap;';
      const erStyle = lead
        ? 'font-size:34px;font-weight:700;color:#4E3D8F;text-align:right;'
        : 'font-size:34px;font-weight:600;color:#4E3D8F;text-align:right;';
      const glyph = FORMAT_ICONS[r.format] || ICON_SPACER;
      const fill = BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)];
      // Unknown reach reads as an em dash, the way the ER column already does,
      // and draws no bar — a zero-width bar would still imply a measurement.
      const known = r.avgReach > 0;
      const bar = known
        ? `<div style="height:44px;width:${barWidth(widths[i])};background:${fill};"></div>`
        : '';

      return `
    <div style="display:flex;align-items:center;gap:18px;">${glyph}<div style="${nameStyle}">${esc(r.format)}</div></div>
    <div style="display:flex;align-items:center;gap:22px;">${bar}<div style="${valueStyle}">${known ? num(r.avgReach) : '—'}</div></div>
    <div style="${erStyle}">${pct(r.engagementRate)}</div>
`;
    })
    .join('');

  // The template's closing sentence is written prose, not a computed figure —
  // with no narrative to carry it the paragraph is omitted rather than faked.
  const note = (narrative.formatNote || '').trim();
  const closing = note
    ? `<p style="margin:0;max-width:1400px;font-size:34px;line-height:1.45;font-weight:500;color:#3A3746;text-wrap:pretty;">${esc(note)}</p>`
    : '';

  return slide(
    FORMAT_STYLE,
    `
  ${formatHeader(facts.period.label)}
  <div style="display:grid;grid-template-columns:380px 1fr 200px;gap:30px 40px;align-items:center;">
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;">Format</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;">Average reach per post</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;text-align:right;">ER</div>
${body}  </div>
  ${closing}
`,
  );
}

// ── section 16 ───────────────────────────────────────────────────────────────

const TIMES_STYLE =
  'background:#FBFAFC;padding:90px 100px 80px;display:flex;flex-direction:column;gap:44px;';

/**
 * The six time bands the design draws, in its own notation (en dash, spaced).
 * The template has no band before 06:00, so overnight activity has nowhere to
 * land — those hours are excluded rather than folded into a band they are not.
 */
const BANDS = [
  { label: '06:00 – 09:00', start: 6, end: 9 },
  { label: '09:00 – 12:00', start: 9, end: 12 },
  { label: '12:00 – 15:00', start: 12, end: 15 },
  { label: '15:00 – 18:00', start: 15, end: 18 },
  { label: '18:00 – 21:00', start: 18, end: 21 },
  { label: '21:00 – 24:00', start: 21, end: 24 },
];

/** Column order is the design's: Sat first, Fri last. weekday is 0=Sunday. */
const COLUMNS = [
  { label: 'Sat', full: 'Saturday', weekday: 6 },
  { label: 'Sun', full: 'Sunday', weekday: 0 },
  { label: 'Mon', full: 'Monday', weekday: 1 },
  { label: 'Tue', full: 'Tuesday', weekday: 2 },
  { label: 'Wed', full: 'Wednesday', weekday: 3 },
  { label: 'Thu', full: 'Thursday', weekday: 4 },
  { label: 'Fri', full: 'Friday', weekday: 5 },
];

/** The legend's five swatches, low to high. */
const HEAT_COLORS = ['#EAE7F2', '#C9C2E4', '#8B7BC8', '#4E3D8F', '#F2B01F'];

/** Cell fill, normalised against the strongest cell so the peak reads amber. */
function heatColor(value: number, peak: number): string {
  if (peak <= 0 || value <= 0) return HEAT_COLORS[0];
  const step = Math.ceil((value / peak) * HEAT_COLORS.length) - 1;
  return HEAT_COLORS[Math.min(HEAT_COLORS.length - 1, Math.max(0, step))];
}

function timesHeader(withLegend: boolean): string {
  const legend = withLegend
    ? `<div style="display:flex;gap:12px;align-items:center;">
      <div style="font-size:24px;font-weight:600;color:#9A96A6;">Low</div>
      <div style="width:40px;height:24px;background:#EAE7F2;"></div>
      <div style="width:40px;height:24px;background:#C9C2E4;"></div>
      <div style="width:40px;height:24px;background:#8B7BC8;"></div>
      <div style="width:40px;height:24px;background:#4E3D8F;"></div>
      <div style="width:40px;height:24px;background:#F2B01F;"></div>
      <div style="font-size:24px;font-weight:600;color:#9A96A6;">High</div>
    </div>`
    : '';

  return `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    <div style="display:flex;align-items:center;gap:24px;"><svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#4E3D8F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><circle cx="12" cy="12" r="8.75"></circle><path d="M12 7v5.3l3.5 2"></path></svg><h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Best Times to Post</h2></div>
    ${legend}
  </div>`;
}

/** "Monday", "Monday & Tuesday", "Saturday, Monday & Tuesday". */
function joinDays(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * Name the days carrying a band, grouping the way the design's caption does
 * ("weekdays") when the strong cells actually line up that way. A day counts
 * as carrying the band when it is within 20% of that band's best cell; the
 * phrasing never claims more days than the data does.
 */
function daysPhrase(row: number[]): string {
  const rowPeak = Math.max(...row, 0);
  if (rowPeak <= 0) return '';

  const strong = row
    .map((value, i) => ({ value, i }))
    .filter(c => c.value >= rowPeak * 0.8 && c.value > 0);

  const key = strong.map(c => COLUMNS[c.i].weekday).sort((a, b) => a - b).join(',');
  if (key === '0,1,2,3,4,5,6') return 'every day';
  if (key === '1,2,3,4,5') return 'weekdays';
  if (key === '0,6') return 'weekends';

  // Five or six strong days is shorter to state by exception than by list.
  if (strong.length >= 5) {
    const hit = new Set(strong.map(c => c.i));
    const missing = COLUMNS.filter((_, i) => !hit.has(i)).map(c => c.full);
    return `every day except ${joinDays(missing)}`;
  }

  return joinDays(strong.sort((a, b) => a.i - b.i).map(c => COLUMNS[c.i].full));
}

/** Section 16 — day × time-block heatmap of when the audience is active. */
export async function renderBestTimes(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  const entries = facts.bestTimes || [];

  const emptyState = (message: string) =>
    slide(
      TIMES_STYLE,
      `
  ${timesHeader(false)}
  <div style="font-size:30px;font-weight:600;color:#3A3746;">${esc(message)}</div>
`,
    );

  if (entries.length === 0 || facts.bestTimesSource === null) {
    return emptyState(`No audience activity or posting-time data for ${facts.period.label}.`);
  }

  // Bucket (weekday, hour) into the design's grid. Anything outside the drawn
  // bands or an unrecognised weekday is dropped, never reassigned.
  const grid: number[][] = BANDS.map(() => COLUMNS.map(() => 0));
  for (const e of entries) {
    const col = COLUMNS.findIndex(c => c.weekday === e.weekday);
    const band = BANDS.findIndex(b => e.hour >= b.start && e.hour < b.end);
    if (col < 0 || band < 0) continue;
    const value = Number.isFinite(e.value) ? Math.max(0, e.value) : 0;
    grid[band][col] += value;
  }

  const peak = Math.max(...grid.map(row => Math.max(...row, 0)), 0);
  if (peak <= 0) {
    return emptyState(`No audience activity or posting-time data for ${facts.period.label}.`);
  }

  const bandTotals = grid.map(row => row.reduce((s, v) => s + v, 0));
  const ranked = bandTotals
    .map((total, i) => ({ total, i }))
    .filter(b => b.total > 0)
    .sort((a, b) => b.total - a.total);
  const peakBand = ranked.length > 0 ? ranked[0].i : -1;

  const rows = BANDS.map((band, bi) => {
    // The template bolds the label of its strongest band; here that emphasis
    // follows the real peak.
    const labelStyle = bi === peakBand
      ? 'font-size:28px;font-weight:700;color:#1C1A22;'
      : 'font-size:28px;font-weight:600;color:#6E6A7A;';
    const cells = COLUMNS.map(
      (_, ci) => `
    <div style="height:86px;background:${heatColor(grid[bi][ci], peak)};"></div>`,
    ).join('');
    return `
    <div style="${labelStyle}">${band.label}</div>${cells}
`;
  }).join('');

  // Caption, computed from the real peak cells — the narrative only adds prose.
  const parts: string[] = [];
  if (ranked.length > 0) {
    const first = daysPhrase(grid[ranked[0].i]);
    parts.push(`Strongest window: ${first ? `${first} ` : ''}${BANDS[ranked[0].i].label}.`);
  }
  if (ranked.length > 1) {
    const second = daysPhrase(grid[ranked[1].i]);
    parts.push(`Second: ${second ? `${second} ` : ''}${BANDS[ranked[1].i].label}.`);
  }
  if (facts.bestTimesSource === 'posts') {
    parts.push('Inferred from engagement on posts we published, not audience activity data.');
  }
  const note = (narrative.bestTimeNote || '').trim();
  // The caption sits in a fixed-height slide; extra prose only goes in when
  // there is room for it on the line.
  if (note && parts.join(' ').length + note.length <= 190) parts.push(note);

  return slide(
    TIMES_STYLE,
    `
  ${timesHeader(true)}
  <div style="display:grid;grid-template-columns:200px repeat(7,1fr);gap:10px;align-items:center;">
    <div></div>
${COLUMNS.map(c => `    <div style="font-size:28px;font-weight:700;color:#1C1A22;text-align:center;">${c.label}</div>`).join('\n')}
${rows}  </div>
  <div style="font-size:30px;font-weight:600;color:#3A3746;">${esc(parts.join(' '))}</div>
`,
  );
}
