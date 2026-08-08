// Template sections 07 "Platform Scorecard" and 08 "Platform Mix".
//
// Markup is a verbatim transcription of the designed slides — same inline
// styles, same colours, same order. Only the values are interpolated, and a
// value that isn't known renders as an em-dash (or the row/card is omitted)
// rather than as a plausible-looking figure.

import type { ReportFacts, PlatformRow, ShareRow } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import {
  slide,
  esc,
  num,
  pct,
  fractionPct,
  icon,
  conicStops,
  PLATFORM_LABELS,
  titleCase,
} from '../render-kit.js';

const HAIRLINE = 'border-bottom:1px solid #E4E2E8;';

/** "tiktok" → "TikTok", falling back to title case for anything unmapped. */
function platformLabel(platform: string): string {
  const mapped = PLATFORM_LABELS[platform];
  return mapped ? mapped : titleCase(platform);
}

/** The template's slide header: title on the left, period on the right. */
function header(title: string, periodLabel: string, padBottom: number): string {
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:${padBottom}px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">${title}</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(periodLabel)}</div>
  </div>`;
}

function emptyLine(text: string): string {
  return `<div style="font-size:30px;font-weight:600;color:#6E6A7A;">${esc(text)}</div>`;
}

// ── 07 Platform Scorecard ────────────────────────────────────────────────────

const SCORECARD_STYLE =
  'background:#FFFFFF;padding:90px 100px 80px;display:flex;flex-direction:column;gap:44px;';

/** One summary stat under the table. Rendered only when the value is real. */
function summaryStat(label: string, value: string): string {
  return `<div style="display:flex;flex-direction:column;gap:8px;"><div style="font-size:24px;font-weight:600;color:#6E6A7A;">${esc(label)}</div><div style="font-size:44px;font-weight:800;color:#1C1A22;">${esc(value)}</div></div>`;
}

async function scorecardRow(row: PlatformRow, isLast: boolean): Promise<string> {
  const bb = isLast ? HAIRLINE : '';
  const label = platformLabel(row.platform);
  const src = await icon(row.platform);
  const img = src
    ? `<img src="${src}" alt="${esc(label)}" style="width:60px;height:60px;display:block;">`
    : '';

  return `<div style="display:flex;align-items:center;gap:22px;padding:28px 0;border-top:1px solid #E4E2E8;${bb}">
      ${img}
      <div style="font-size:36px;font-weight:700;color:#1C1A22;">${esc(label)}</div>
    </div>
    <div style="font-size:36px;font-weight:600;color:#1C1A22;padding:28px 0;border-top:1px solid #E4E2E8;${bb}text-align:right;">${num(row.posts)}</div>
    <div style="font-size:36px;font-weight:700;color:#1C1A22;padding:28px 0;border-top:1px solid #E4E2E8;${bb}text-align:right;">${num(row.reach)}</div>
    <div style="font-size:36px;font-weight:600;color:#1C1A22;padding:28px 0;border-top:1px solid #E4E2E8;${bb}text-align:right;">${num(row.engagements)}</div>
    <div style="font-size:36px;font-weight:700;color:#4E3D8F;padding:28px 0;border-top:1px solid #E4E2E8;${bb}text-align:right;">${pct(row.engagementRate)}</div>
    <div style="font-size:36px;font-weight:600;color:#1C1A22;padding:28px 0;border-top:1px solid #E4E2E8;${bb}text-align:right;">${num(row.follows)}</div>`;
}

export async function renderPlatformScorecard(
  facts: ReportFacts,
  _narrative: Narrative,
): Promise<string> {
  const head = header('Platform Scorecard', facts.period.label, 28);
  const platforms = facts.platforms;

  if (platforms.length === 0) {
    return slide(SCORECARD_STYLE, `${head}${emptyLine('No platform data for this period')}`);
  }

  const rows = (
    await Promise.all(platforms.map((p, i) => scorecardRow(p, i === platforms.length - 1)))
  ).join('\n');

  // Share of reach is derived from the platforms that actually reported reach —
  // a platform whose reach is unknown must not dilute or inflate the split.
  const withReach = platforms.filter(p => p.reach != null && p.reach > 0);
  const reachTotal = withReach.reduce((s, p) => s + (p.reach || 0), 0);
  const topReach = withReach
    .slice()
    .sort((a, b) => (b.reach || 0) - (a.reach || 0))[0];

  const stats: string[] = [];
  if (topReach && reachTotal > 0) {
    stats.push(
      summaryStat(
        `${platformLabel(topReach.platform)} share of reach`,
        fractionPct((topReach.reach || 0) / reachTotal, 0),
      ),
    );
  }
  stats.push(
    summaryStat(
      'Blended ER',
      facts.totals.engagementRate > 0 ? pct(facts.totals.engagementRate) : '—',
    ),
  );
  stats.push(
    summaryStat(
      'Reach / views per post',
      facts.totals.postCount > 0 && facts.totals.reach > 0
        ? num(facts.totals.reach / facts.totals.postCount)
        : '—',
    ),
  );

  return slide(
    SCORECARD_STYLE,
    `${head}
  <div style="display:grid;grid-template-columns:1.5fr 0.8fr 1fr 1.2fr 0.8fr 1fr;gap:0 32px;align-items:center;">
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;padding-bottom:18px;">Platform</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;padding-bottom:18px;text-align:right;">Posts</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;padding-bottom:18px;text-align:right;">Reach / Views</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;padding-bottom:18px;text-align:right;">Engagements</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;padding-bottom:18px;text-align:right;">ER</div>
    <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;padding-bottom:18px;text-align:right;">Follows</div>

    ${rows}
  </div>
  <div style="display:flex;gap:80px;">
    ${stats.join('\n    ')}
  </div>`,
  );
}

// ── 08 Platform Mix ──────────────────────────────────────────────────────────

const MIX_STYLE =
  'background:#FFFFFF;padding:90px 100px 70px;display:flex;flex-direction:column;gap:32px;';

// This slide's own ramp, copied from the design. It differs from the shared
// DONUT_COLORS (which the audience slide uses), and the same array has to feed
// both the conic-gradient and the legend swatches or the two disagree.
const MIX_DONUT = ['#4E3D8F', '#8B7BC8', '#F2B01F', '#D8D4E2'];

/** Legend line beside a donut; the leading share is set in the heavier weight. */
function legendRow(row: ShareRow, index: number): string {
  const swatch = MIX_DONUT[index % MIX_DONUT.length];
  const label = esc(platformLabel(row.label));
  const share = fractionPct(row.fraction);
  if (index === 0) {
    return `<div style="display:flex;align-items:center;gap:16px;"><div style="width:22px;height:22px;background:${swatch};"></div><div style="flex:1;font-size:28px;font-weight:700;color:#1C1A22;">${label}</div><div style="font-size:28px;font-weight:800;color:#1C1A22;">${share}</div></div>`;
  }
  return `<div style="display:flex;align-items:center;gap:16px;"><div style="width:22px;height:22px;background:${swatch};"></div><div style="flex:1;font-size:28px;font-weight:600;color:#3A3746;">${label}</div><div style="font-size:28px;font-weight:700;color:#3A3746;">${share}</div></div>`;
}

/** Donut + legend for one share breakdown. Empty data keeps the heading only. */
function donutBlock(title: string, rows: ShareRow[]): string {
  const heading = `<div style="font-size:30px;font-weight:700;color:#1C1A22;">${title}</div>`;
  if (rows.length === 0) {
    return `<div style="display:flex;flex-direction:column;gap:22px;">
      ${heading}
      ${emptyLine('No data for this period')}
    </div>`;
  }

  const sorted = rows.slice().sort((a, b) => b.fraction - a.fraction);
  const stops = conicStops(sorted, MIX_DONUT);
  const top = sorted[0];
  const legend = sorted.map((r, i) => legendRow(r, i)).join('\n        ');

  return `<div style="display:flex;flex-direction:column;gap:22px;">
      ${heading}
      <div style="display:flex;align-items:center;gap:40px;">
      <div style="width:300px;height:300px;border-radius:50%;background:conic-gradient(${stops});display:flex;align-items:center;justify-content:center;flex:none;">
        <div style="width:172px;height:172px;border-radius:50%;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <div style="font-size:48px;font-weight:800;letter-spacing:-0.02em;color:#1C1A22;">${fractionPct(top.fraction, 0)}</div>
          <div style="font-size:24px;font-weight:600;color:#6E6A7A;">${esc(platformLabel(top.label))}</div>
        </div>
      </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:16px;">
        ${legend}
        </div>
      </div>
    </div>`;
}

/**
 * Verdict colour follows the gap between engagement share and reach share:
 * giving back more attention than the reach it takes reads positive, a small
 * shortfall reads neutral, a wide one reads negative. Matches the design's
 * green / grey / red assignment.
 */
function verdictColor(reachShare: number | null, engShare: number | null): string {
  if (reachShare == null || engShare == null) return '#6E6A7A';
  const diff = engShare - reachShare;
  if (diff >= 0) return '#1E7A4C';
  if (diff > -0.03) return '#6E6A7A';
  return '#B3261E';
}

export async function renderPlatformMix(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  const head = header('Platform Mix', facts.period.label, 24);
  const reachRows = facts.platformMix.reach;
  const engRows = facts.platformMix.engagement;

  if (reachRows.length === 0 && engRows.length === 0) {
    return slide(MIX_STYLE, `${head}${emptyLine('No platform data for this period')}`);
  }

  const reachBy = new Map(reachRows.map(r => [r.label, r.fraction]));
  const engBy = new Map(engRows.map(r => [r.label, r.fraction]));

  // Table order follows the scorecard's platform order, as in the design.
  type MixRow = {
    platform: string;
    reachShare: number | null;
    engShare: number | null;
    verdict: string;
  };
  const mixRows: MixRow[] = [];
  for (const p of facts.platforms) {
    const reachShare = reachBy.has(p.platform) ? reachBy.get(p.platform)! : null;
    const engShare = engBy.has(p.platform) ? engBy.get(p.platform)! : null;
    if (reachShare == null && engShare == null) continue;
    const raw = narrative.platformVerdicts ? narrative.platformVerdicts[p.platform] : undefined;
    mixRows.push({
      platform: p.platform,
      reachShare,
      engShare,
      verdict: typeof raw === 'string' ? raw.trim() : '',
    });
  }

  // Verdicts only exist when a narrative was generated; the fallback narrative
  // leaves them all blank. A labelled column of empty cells reads as a broken
  // report, so the column is dropped rather than rendered empty.
  const hasVerdicts = mixRows.some(r => r.verdict !== '');
  const mixCols = hasVerdicts ? '1.4fr 1fr 1fr 1.6fr' : '1.4fr 1fr 1fr';
  const verdictHead = hasVerdicts
    ? `\n      <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;text-align:right;">Verdict</div>`
    : '';

  const tableRows = mixRows
    .map(r => {
      const verdictCell = hasVerdicts
        ? `\n        <div style="font-size:28px;font-weight:700;color:${verdictColor(r.reachShare, r.engShare)};text-align:right;">${esc(r.verdict)}</div>`
        : '';
      return `<div style="display:grid;grid-template-columns:${mixCols};gap:28px;align-items:center;padding:20px 0;border-top:1px solid #E4E2E8;">
        <div style="font-size:30px;font-weight:700;color:#1C1A22;">${esc(platformLabel(r.platform))}</div>
        <div style="font-size:30px;font-weight:600;color:#3A3746;text-align:right;">${fractionPct(r.reachShare)}</div>
        <div style="font-size:30px;font-weight:600;color:#3A3746;text-align:right;">${fractionPct(r.engShare)}</div>${verdictCell}
      </div>`;
    })
    .join('\n      ');

  return slide(
    MIX_STYLE,
    `${head}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:80px;">
    ${donutBlock('Share of reach and views', reachRows)}
    ${donutBlock('Share of engagement', engRows)}
  </div>
  <div style="display:flex;flex-direction:column;margin-top:auto;">
    <div style="display:grid;grid-template-columns:${mixCols};gap:28px;padding-bottom:14px;">
      <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;">Platform</div>
      <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;text-align:right;">Reach share</div>
      <div style="font-size:24px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A6;text-align:right;">Eng. share</div>${verdictHead}
    </div>
      ${tableRows}
  </div>`,
  );
}
