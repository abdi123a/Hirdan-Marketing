// Template sections 05 "Reach and Engagement Trend" and 06 "Follower Growth".
//
// Both are near-verbatim transcriptions of the designed slides: every inline
// style, colour and static caption is copied from the source markup. The only
// things recomputed are the hand-plotted SVG coordinates, which have to be
// derived from live values, and the figures themselves.

import type { ReportFacts, TrendPoint, FollowerPoint } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import {
  bandCentres,
  deltaColor,
  esc,
  compact,
  num,
  pct,
  scaleBars,
  scaleLine,
  slide,
} from '../render-kit.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** One-decimal coordinate, matching the precision the template's SVGs use. */
function n1(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** "+131%" / "-12%" / "—" — the template writes whole percentages here. */
function changeLabel(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const rounded = Math.round(v);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

function monthName(m: number): string {
  return MONTH_NAMES[m - 1] || '';
}

/**
 * In-bar reach labels on slide 05, which the design writes as whole thousands
 * (318K, 402K, 735K) rather than compact()'s one-decimal form.
 */
function barValue(v: number): string {
  if (!Number.isFinite(v)) return compact(v);
  // Bounded below a million so a big month reads "1.24M" like everywhere else,
  // instead of "1240K" — the same number typeset two ways in one deck.
  if (Math.abs(v) >= 1_000_000) return compact(v);
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}K`;
  return compact(v);
}

// ── 05 · Reach and Engagement Trend ──────────────────────────────────────────

const TREND_STYLE =
  'background:#FFFFFF;padding:76px 100px 52px;display:flex;flex-direction:column;gap:26px;';

// Plot geometry lifted from the six-month source chart: bar centres run
// 133 → 1067 inside a 1200-wide viewBox, bars are 144 wide with a 42.8 gap,
// the tallest bar is 275.6px above the y=400 baseline, and the engagement-rate
// line occupies the band 68.1 (highest) → 152.5 (lowest).
const TREND_PLOT_X = 39.6;
const TREND_PLOT_W = 1120.8;
const TREND_BAR_GAP = 42.8;
const TREND_BAR_W = 144;
const TREND_BASELINE = 400;
const TREND_BAR_MAX = 275.6;
const TREND_LINE_TOP = 68.1;
const TREND_LINE_BOTTOM = 152.5;

// The amber legend chip is only drawn when the engagement-rate line is actually
// plotted; a legend for an absent series reads as missing ink, not missing data.
function trendHeader(hasEngagementRate: boolean): string {
  const erChip = hasEngagementRate
    ? `\n      <div style="display:flex;gap:12px;align-items:center;"><div style="width:34px;height:6px;background:#F2B01F;border-radius:3px;"></div><div style="font-size:26px;font-weight:600;color:#3A3746;">Engagement rate</div></div>`
    : '';
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:24px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Reach and Engagement Trend</h2>
    <div style="display:flex;gap:36px;align-items:center;">
      <div style="display:flex;gap:12px;align-items:center;"><div style="width:24px;height:24px;background:#4E3D8F;"></div><div style="font-size:26px;font-weight:600;color:#3A3746;">Reach and views</div></div>${erChip}
    </div>
  </div>`;
}

export async function renderReachEngagementTrend(
  facts: ReportFacts,
  _narrative: Narrative,
): Promise<string> {
  // Months with no reach carry no measurement, so they are left out entirely
  // rather than drawn as a zero bar that reads as "we reached nobody".
  const points: TrendPoint[] = (facts.trend || [])
    .filter(p => p && Number.isFinite(p.reach) && p.reach > 0)
    .slice(-6);

  if (points.length === 0) {
    return slide(
      TREND_STYLE,
      `${trendHeader(false)}
  <div style="flex:1;display:flex;align-items:center;font-size:26px;font-weight:600;color:#6E6A7A;">No reach data for this period</div>`,
    );
  }

  const centres = bandCentres(points.length, TREND_PLOT_W, TREND_PLOT_X).map(c => Math.round(c));
  const step = TREND_PLOT_W / points.length;
  // 144 is the designed bar width; a short trend spreads the same bars out
  // rather than fattening them across the slide.
  const barW = Math.max(1, Math.min(TREND_BAR_W, step - TREND_BAR_GAP));
  const heights = scaleBars(points.map(p => p.reach), TREND_BAR_MAX);
  const lastIdx = points.length - 1;

  const bars = points.map((p, i) => {
    const h = heights[i];
    const top = TREND_BASELINE - h;
    const isLast = i === lastIdx;
    return `      <rect x="${n1(centres[i] - barW / 2)}" y="${n1(top)}" width="${n1(barW)}" height="${n1(h)}" fill="${isLast ? '#F2B01F' : '#4E3D8F'}"></rect>`;
  }).join('\n');

  const barLabels = points.map((p, i) => {
    const h = heights[i];
    const top = TREND_BASELINE - h;
    const isLast = i === lastIdx;
    // The template always sets the value inside the bar, 46px below its top.
    const y = Math.round(top) + 46;
    const fill = isLast ? '#1C1A22' : '#FFFFFF';
    return `      <text x="${centres[i]}" y="${y}" text-anchor="middle" style="font-family:Archivo,Helvetica,sans-serif;font-variant-numeric:tabular-nums;" font-size="34" font-weight="800" fill="${fill}">${esc(barValue(p.reach))}</text>`;
  }).join('\n');

  // Engagement-rate series: only months that actually have a rate, so a month
  // without engagement data doesn't pull the line down to zero.
  const erIdx = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => Number.isFinite(p.engagementRate) && p.engagementRate > 0);
  const erValues = erIdx.map(({ p }) => p.engagementRate);
  const erY = erValues.length
    ? scaleLine(erValues, {
        top: TREND_LINE_TOP,
        bottom: TREND_LINE_BOTTOM,
        min: Math.min(...erValues),
        max: Math.max(...erValues),
      })
    : [];

  const polyline = erIdx.length >= 2
    ? `      <polyline points="${erIdx.map(({ i }, k) => `${centres[i]},${n1(erY[k])}`).join(' ')}" fill="none" stroke="#F2B01F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>\n`
    : '';

  const erDots = erIdx.map(({ i }, k) =>
    `      <circle cx="${centres[i]}" cy="${n1(erY[k])}" r="${i === lastIdx ? 11 : 8}" fill="#FFFFFF" stroke="#F2B01F" stroke-width="5"></circle>`,
  ).join('\n');

  const erLabels = erIdx.map(({ p, i }, k) =>
    `      <text x="${centres[i]}" y="${Math.round(erY[k] - 28.2)}" text-anchor="middle" style="font-family:Archivo,Helvetica,sans-serif;font-variant-numeric:tabular-nums;" font-size="30" font-weight="${i === lastIdx ? '800' : '700'}" fill="#1C1A22">${esc(pct(p.engagementRate))}</text>`,
  ).join('\n');

  const xLabels = points.map((p, i) =>
    `      <text x="${centres[i]}" y="448" text-anchor="middle" style="font-family:Archivo,Helvetica,sans-serif;" font-size="32" font-weight="${i === lastIdx ? '800' : '700'}" fill="#1C1A22">${esc(p.label)}</text>`,
  ).join('\n');

  // Footer comparisons: first plotted month vs. the current one.
  const first = points[0];
  const last = points[lastIdx];
  const comparable = points.length >= 2;

  const reachChange = comparable && first.reach > 0
    ? ((last.reach - first.reach) / first.reach) * 100
    : null;

  // Engagement counts are stored per trend month, so use them directly.
  // Reconstructing them as reach × rate looked equivalent but wasn't: the rate
  // is rounded to two decimals before storage, and that rounding propagated
  // into this figure — enough to print +170% where the measured counts say
  // +169%. A month with nothing measured has a zero count and is withheld,
  // rather than being reported as a month of zero engagement.
  const engComparable = comparable && first.engagement > 0 && last.engagement > 0;
  const engChange = engComparable
    ? ((last.engagement - first.engagement) / first.engagement) * 100
    : null;

  const erSpan = comparable && first.engagementRate > 0 && last.engagementRate > 0
    ? `${pct(first.engagementRate)} → ${pct(last.engagementRate)}`
    : '—';
  const erSpanColor = comparable && first.engagementRate > 0 && last.engagementRate > 0
    ? deltaColor(last.engagementRate - first.engagementRate)
    : '#6E6A7A';

  const sinceLabel = `since ${monthName(first.month)}`;

  return slide(
    TREND_STYLE,
    `${trendHeader(erIdx.length > 0)}
  <div style="flex:1;display:flex;align-items:stretch;">
    <svg viewBox="0 0 1200 470" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%;">
      <line x1="0" y1="400" x2="1200" y2="400" stroke="#1C1A22" stroke-width="3"></line>
${bars}
${barLabels}
${polyline}${erDots}
${erLabels}
${xLabels}
    </svg>
  </div>
  <div style="display:flex;gap:80px;border-top:1px solid #E4E2E8;padding-top:24px;">
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">Reach ${esc(sinceLabel)}</div><div style="font-size:44px;font-weight:800;color:${reachChange == null ? '#6E6A7A' : deltaColor(reachChange)};">${esc(changeLabel(reachChange))}</div></div>
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">Engagements ${esc(sinceLabel)}</div><div style="font-size:44px;font-weight:800;color:${engChange == null ? '#6E6A7A' : deltaColor(engChange)};">${esc(changeLabel(engChange))}</div></div>
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">Engagement rate</div><div style="font-size:44px;font-weight:800;color:${erSpanColor};">${esc(erSpan)}</div></div>
  </div>`,
  );
}

// ── 06 · Follower Growth ─────────────────────────────────────────────────────

const GROWTH_STYLE =
  'background:#FFFFFF;padding:90px 100px 70px;display:flex;flex-direction:column;gap:36px;';

// Seven-point area chart from the source: x runs 70 → 1126 inside a 1250-wide
// viewBox (baseline y=250), and the series occupies the band 58.7 (highest
// total) → 221.6 (lowest).
const GROWTH_X0 = 70;
const GROWTH_SPAN = 1056;
const GROWTH_BASELINE = 250;
const GROWTH_TOP = 58.7;
const GROWTH_BOTTOM = 221.6;

function growthHeader(): string {
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:24px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Follower Growth</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">Total followers by month</div>
  </div>`;
}

export async function renderFollowerGrowth(
  facts: ReportFacts,
  _narrative: Narrative,
): Promise<string> {
  const growth = facts.followerGrowth;
  // A month with no follower snapshot has a total of 0; plotting it would
  // assert an audience of zero, so those months are dropped instead.
  const points: FollowerPoint[] = (growth?.points || [])
    .filter(p => p && Number.isFinite(p.total) && p.total > 0)
    .slice(-7);

  if (points.length === 0) {
    return slide(
      GROWTH_STYLE,
      `${growthHeader()}
  <div style="flex:1;display:flex;align-items:center;font-size:26px;font-weight:600;color:#6E6A7A;">No follower data for this period</div>`,
    );
  }

  const step = points.length > 1 ? GROWTH_SPAN / (points.length - 1) : 0;
  const xs = points.length > 1
    ? points.map((_, i) => GROWTH_X0 + step * i)
    : [GROWTH_X0 + GROWTH_SPAN / 2]; // a lone month sits centred, not pinned left
  const totals = points.map(p => p.total);
  const ys = scaleLine(totals, {
    top: GROWTH_TOP,
    bottom: GROWTH_BOTTOM,
    min: Math.min(...totals),
    max: Math.max(...totals),
  });
  const lastIdx = points.length - 1;

  const seriesPoints = xs.map((x, i) => `${n1(x)},${n1(ys[i])}`).join(' ');
  const polygonPoints = `${n1(xs[0])},${GROWTH_BASELINE} ${seriesPoints} ${n1(xs[lastIdx])},${GROWTH_BASELINE}`;

  const dots = xs.map((x, i) =>
    `      <circle cx="${n1(x)}" cy="${n1(ys[i])}" r="${i === lastIdx ? 12 : 8}" fill="${i === lastIdx ? '#F2B01F' : '#4E3D8F'}"></circle>`,
  ).join('\n');

  const valueLabels = points.map((p, i) => {
    const isLast = i === lastIdx;
    return `      <text x="${n1(xs[i])}" y="${n1(ys[i] - 28)}" text-anchor="middle" style="font-family:Archivo,Helvetica,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-0.01em;" font-size="${isLast ? 34 : 30}" font-weight="${isLast ? '800' : '700'}" fill="${isLast ? '#1C1A22' : '#3A3746'}">${esc(num(p.total))}</text>`;
  }).join('\n');

  const captions = points.map((p, i) => {
    const isLast = i === lastIdx;
    const gained = p.gained != null && Number.isFinite(p.gained) ? `+${num(p.gained)}` : '—';
    return `      <div style="display:flex;flex-direction:column;gap:6px;align-items:center;"><div style="font-size:${isLast ? 32 : 30}px;font-weight:${isLast ? '800' : '700'};color:#1C1A22;">${esc(p.label)}</div><div style="font-size:24px;font-weight:600;color:#6E6A7A;">${esc(gained)}</div></div>`;
  }).join('\n');

  const netGrowth = growth.netGrowth;
  const netLabel = netGrowth == null || !Number.isFinite(netGrowth)
    ? '—'
    : netGrowth >= 0 ? `+${num(netGrowth)}` : num(netGrowth);
  const netColor = netGrowth == null || !Number.isFinite(netGrowth) ? '#6E6A7A' : deltaColor(netGrowth);
  const totalLabel = growth.total > 0 ? num(growth.total) : '—';

  return slide(
    GROWTH_STYLE,
    `${growthHeader()}
  <div style="flex:1;display:flex;flex-direction:column;gap:16px;">
    <svg viewBox="0 0 1250 290" preserveAspectRatio="none" style="display:block;width:100%;height:100%;overflow:visible;">
      <defs>
        <linearGradient id="followerFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4E3D8F" stop-opacity="0.34"></stop>
          <stop offset="55%" stop-color="#6B5AB0" stop-opacity="0.14"></stop>
          <stop offset="100%" stop-color="#6B5AB0" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <line x1="70" y1="250" x2="1190" y2="250" stroke="#E4E2E8" stroke-width="2"></line>
      <line x1="70" y1="180" x2="1190" y2="180" stroke="#F4F3F6" stroke-width="2"></line>
      <line x1="70" y1="110" x2="1190" y2="110" stroke="#F4F3F6" stroke-width="2"></line>
      <line x1="70" y1="40" x2="1190" y2="40" stroke="#F4F3F6" stroke-width="2"></line>
      <polygon points="${polygonPoints}" fill="url(#followerFade)"></polygon>
      <polyline points="${seriesPoints}" fill="none" stroke="#4E3D8F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
${dots}
${valueLabels}
    </svg>
    <div style="display:grid;grid-template-columns:repeat(${points.length},1fr);border-top:2px solid #1C1A22;padding-top:16px;">
${captions}
    </div>
  </div>
  <div style="display:flex;gap:72px;border-top:1px solid #E4E2E8;padding-top:24px;">
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">New follows in ${esc(monthName(facts.period.month))}</div><div style="font-size:44px;font-weight:800;color:#1C1A22;">${esc(num(growth.newFollows))}</div></div>
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">Unfollows</div><div style="font-size:44px;font-weight:800;color:#1C1A22;">${esc(num(growth.unfollows))}</div></div>
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">Net growth</div><div style="font-size:44px;font-weight:800;color:${netColor};">${esc(netLabel)}</div></div>
    <div style="display:flex;flex-direction:column;gap:6px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">Total followers</div><div style="font-size:44px;font-weight:800;color:#1C1A22;">${esc(totalLabel)}</div></div>
  </div>`,
  );
}
