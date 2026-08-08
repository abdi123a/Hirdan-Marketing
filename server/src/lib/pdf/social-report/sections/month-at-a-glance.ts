// Template section 03 — "Month at a Glance": the four headline KPI cards
// (total reach, engagements, new followers, engagement rate), each with a
// month-over-month delta and a six-bar sparkline, plus the narrative note and
// the source footnote.
//
// Markup is transcribed verbatim from the design; only values are dynamic. The
// card icons are inline SVG in the template, so they stay literal here rather
// than going through icon().

import type { ReportFacts, KpiFact } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import {
  esc,
  num,
  pct,
  compact,
  deltaLabel,
  deltaColor,
  scaleBars,
  titleCase,
  slide,
  PLATFORM_LABELS,
} from '../render-kit.js';

const SECTION_STYLE =
  'background:#FFFFFF;padding:90px 100px 80px;display:flex;flex-direction:column;gap:52px;';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The four card glyphs, copied character-for-character from the template.
const ICON_REACH =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"></path><circle cx="12" cy="12" r="2.8"></circle></svg>';
const ICON_ENGAGEMENTS =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3z"></path></svg>';
const ICON_FOLLOWERS =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><circle cx="9" cy="8" r="3.2"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16.5 5.5a3 3 0 0 1 0 5.6"></path><path d="M18 20a6.4 6.4 0 0 0-2.2-4.6"></path></svg>';
const ICON_RATE =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#4E3D8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><path d="M3 17.5 9.5 11l4 4L21 7.5"></path><path d="M15.5 7.5H21v5.5"></path></svg>';

/** Name of the month before the reported one, for the "vs. June" delta line. */
function previousMonthLabel(month: number): string {
  const prev = month === 1 ? 12 : month - 1;
  return MONTH_NAMES[prev - 1] ?? '';
}

/**
 * "1–31 July 2026" — the footnote's explicit day range, en dash as designed,
 * built from the real period bounds. Falls back to the plain month label if the
 * bounds are unparseable or somehow straddle two months.
 */
function periodRange(startIso: string, endIso: string, fallback: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return fallback;
  if (start.getUTCFullYear() !== end.getUTCFullYear() || start.getUTCMonth() !== end.getUTCMonth()) {
    return fallback;
  }
  const monthName = MONTH_NAMES[start.getUTCMonth()] ?? '';
  if (!monthName) return fallback;
  return `${start.getUTCDate()}–${end.getUTCDate()} ${monthName} ${start.getUTCFullYear()}`;
}

/** "TikTok, Instagram and YouTube" — the template's list style, no Oxford comma. */
function platformList(platforms: { platform: string }[]): string {
  const names = platforms.map(p => PLATFORM_LABELS[p.platform] ?? titleCase(p.platform));
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The six-bar mini sparkline. The template hard-codes height percentages, so
 * these are recomputed against the series peak (which the design also puts at
 * the last, amber bar).
 *
 * A month with no stored data comes back as a zero total, indistinguishable
 * from a month we measured as zero, so the leading run of zeros is dropped
 * rather than drawn as phantom "we reached nobody" bars. Returns '' unless at
 * least two real points survive — one bar is not a trend, and an empty strip
 * is an invisible, meaningless decoration.
 */
function sparkline(values: number[]): string {
  const series = values.slice(-6);
  const isReal = (v: number) => Number.isFinite(v) && v > 0;

  let start = 0;
  while (start < series.length && !isReal(series[start])) start++;
  const plotted = series.slice(start);
  if (plotted.filter(isReal).length < 2) return '';

  const heights = scaleBars(plotted.map(v => (Number.isFinite(v) ? v : 0)), 92);
  const bars = heights
    .map((h, i) => {
      const fill = i === heights.length - 1 ? '#F2B01F' : '#C9C2E4';
      return `<div style="width:14px;height:${Math.round(h)}%;background:${fill};"></div>`;
    })
    .join('');
  return `<div style="display:flex;align-items:flex-end;gap:5px;height:34px;flex:none;">${bars}</div>`;
}

/**
 * "+0.1 pts vs. June" — the engagement-rate card's delta. A rate moves in
 * percentage points, not percent: 6.2% → 6.3% is +0.1 pts, and calling that
 * "+1.6%" would overstate it. '' when there is no prior month to compare.
 */
function ptsLabel(kpi: KpiFact, prevMonthLabel: string): string {
  if (kpi.previous == null || !Number.isFinite(kpi.previous)) return '';
  const pts = kpi.current - kpi.previous;
  return `${pts >= 0 ? '+' : ''}${Number(pts.toFixed(1))} pts vs. ${prevMonthLabel}`;
}

/** One KPI card. `value` is already formatted; '' means "no figure to show". */
function card(
  iconSvg: string,
  label: string,
  value: string,
  kpi: KpiFact,
  prevMonth: string,
  spark: string,
  deltaUnit: 'pct' | 'pts' = 'pct',
): string {
  const hasValue = value !== '';
  const delta = hasValue
    ? (deltaUnit === 'pts' ? ptsLabel(kpi, prevMonth) : deltaLabel(kpi.changePct, prevMonth))
    : '';
  const deltaEl = delta
    ? `<div style="font-size:26px;font-weight:600;color:${deltaColor(kpi.changePct)};">${esc(delta)}</div>`
    : '';
  // With no headline figure the card is an em dash; a sparkline underneath it
  // would be charting a number we just said we don't have.
  const footRow = hasValue && (deltaEl || spark)
    ? `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;">${deltaEl}${spark}</div>`
    : '';

  return `<div style="background:#FFFFFF;padding:44px 36px;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;gap:14px;">${iconSvg}<div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(label)}</div></div>
      <div style="font-size:86px;font-weight:800;letter-spacing:-0.03em;line-height:1;color:#1C1A22;">${hasValue ? esc(value) : '—'}</div>
      ${footRow}
    </div>`;
}

export async function renderMonthAtAGlance(facts: ReportFacts, narrative: Narrative): Promise<string> {
  const { kpis, period, platforms, totals, trend, followerGrowth } = facts;

  // Header meta: "July 2026 · 48 posts across 4 platforms", dropping whichever
  // half we cannot state truthfully. "across N platforms" only reads as English
  // after the post count, so it hangs off that fragment rather than dangling on
  // its own.
  const countBits: string[] = [];
  if (totals.postCount > 0) {
    countBits.push(`${num(totals.postCount)} post${totals.postCount === 1 ? '' : 's'}`);
    if (platforms.length > 0) {
      countBits.push(`across ${platforms.length} platform${platforms.length === 1 ? '' : 's'}`);
    }
  }
  const headerMeta = [period.label, countBits.join(' ')].filter(Boolean).join(' · ');

  const header = `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Month at a Glance</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(headerMeta)}</div>
  </div>`;

  const hasAny =
    facts.hasAccounts &&
    (kpis.reach.current > 0 ||
      kpis.engagements.current > 0 ||
      kpis.newFollowers.current > 0 ||
      kpis.engagementRate.current > 0);

  if (!hasAny) {
    return slide(
      SECTION_STYLE,
      `
  ${header}
  <p style="margin:0;max-width:1400px;font-size:34px;line-height:1.45;font-weight:500;color:#3A3746;text-wrap:pretty;">No data for this period.</p>
`,
    );
  }

  const prevMonth = previousMonthLabel(period.month);

  // All four cards carry a sparkline in the design, each off its own real
  // series. New follows come from the follower-growth points (last 6 of 7) —
  // a card is only left bare when its series genuinely has no data.
  const reachSpark = sparkline(trend.map(t => t.reach));
  const rateSpark = sparkline(trend.map(t => t.engagementRate));
  const engSpark = sparkline(trend.map(t => t.engagement));
  const followsSeries = followerGrowth.points.slice(-6).map(p => p.gained ?? 0);
  const followsSpark = followsSeries.some(v => v > 0) ? sparkline(followsSeries) : '';

  const cards = [
    card(
      ICON_REACH,
      'Total reach',
      kpis.reach.current > 0 ? compact(kpis.reach.current) : '',
      kpis.reach,
      prevMonth,
      reachSpark,
    ),
    card(
      ICON_ENGAGEMENTS,
      'Engagements',
      kpis.engagements.current > 0 ? compact(kpis.engagements.current) : '',
      kpis.engagements,
      prevMonth,
      engSpark,
    ),
    card(
      ICON_FOLLOWERS,
      'New followers',
      // The design writes this one in full ("3,378"), not abbreviated.
      kpis.newFollowers.current > 0 ? num(kpis.newFollowers.current) : '',
      kpis.newFollowers,
      prevMonth,
      followsSpark,
    ),
    card(
      ICON_RATE,
      'Engagement rate',
      kpis.engagementRate.current > 0 ? pct(kpis.engagementRate.current) : '',
      kpis.engagementRate,
      prevMonth,
      rateSpark,
      // A rate's month-over-month move is stated in percentage points.
      'pts',
    ),
  ].join('\n    ');

  const note = (narrative.monthAtAGlanceNote || '').trim();
  const noteEl = note
    ? `<p style="margin:0;max-width:1400px;font-size:34px;line-height:1.45;font-weight:500;color:#3A3746;text-wrap:pretty;">${esc(note)}</p>`
    : '';

  const sources = platformList(platforms);
  const range = periodRange(period.start, period.end, period.label);
  const footnote = sources
    ? `<div style="margin-top:auto;font-size:24px;font-weight:500;color:#9A96A6;">Source: ${esc(sources)} native analytics, ${esc(range)}.</div>`
    : '';

  return slide(
    SECTION_STYLE,
    `
  ${header}
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:#E4E2E8;">
    ${cards}
  </div>
  ${noteEl}
  ${footnote}
`,
  );
}
