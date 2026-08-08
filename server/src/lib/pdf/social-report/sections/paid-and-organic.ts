// Renders template section 09 "Paid and Organic": spend header, organic/paid
// share-of-reach split bar, four paid efficiency stat cards, closing note.
//
// Paid figures are hand-entered by the agency, so most clients will have none,
// and a row often exists before every field on it is filled in. Whenever there
// is nothing measured to show — no row at all, or a row with no results — the
// slide shows the heading and an honest empty line, never the designed sample
// numbers and never a 0 standing in for a figure that was simply not entered.

import type { ReportFacts } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import { slide, esc, num, pct } from '../render-kit.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "July" — the header writes the month name alone, not "July 2026". */
function monthName(facts: ReportFacts): string {
  return MONTHS[facts.period.month - 1] ?? (facts.period.label || '').split(' ')[0] ?? '';
}

/**
 * Money in the template's style: grouped integer for the large figures the
 * design was drawn with (DJF), but small currencies (a $4.35 CPM, a $0.42 CPC)
 * keep their decimals rather than rounding to a misleading "0".
 */
function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100) return num(n);
  const rounded = Number(n.toFixed(2));
  // A real sub-cent figure must not collapse to a flat "0" — keep enough
  // precision to show it is small rather than absent.
  if (rounded === 0 && n !== 0) return String(Number(n.toPrecision(2)));
  return String(rounded);
}

/** Percentage as a bare number for a CSS width, e.g. 63.5 → "63.5". */
function widthPct(n: number): string {
  return String(Number(n.toFixed(1)));
}

/**
 * Below this share a segment is too narrow to hold its label legibly.
 * Measured against the real 1720px bar: the label needs ~18% to stay on the
 * single line the design draws, and wraps to a cramped two-line block below it.
 */
const SHARE_LABEL_MIN_PCT = 18;

const SECTION_STYLE =
  'background:#FBFAFC;padding:90px 100px 80px;display:flex;flex-direction:column;gap:44px;';

const CARD_STYLE =
  'background:#FFFFFF;padding:40px 34px;display:flex;flex-direction:column;gap:14px;';
const CARD_HEAD_STYLE = 'display:flex;align-items:center;gap:14px;';
const CARD_LABEL_STYLE = 'font-size:26px;font-weight:600;color:#6E6A7A;';
const CARD_VALUE_STYLE =
  'font-size:66px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:#1C1A22;';
const CARD_SUB_STYLE = 'font-size:26px;font-weight:600;color:#6E6A7A;';
// The design writes the sub-lines of cards 1 and 4 in green, 2 and 3 in grey.
const CARD_SUB_STYLE_POSITIVE = 'font-size:26px;font-weight:600;color:#1E7A4C;';

const ICON_ATTRS =
  'viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#4E3D8F" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"';

const ICON_CARD =
  `<svg ${ICON_ATTRS}><rect x="2.5" y="6" width="19" height="13" rx="2.5"></rect><path d="M2.5 10.5h19"></path><circle cx="17" cy="15" r="1.3"></circle></svg>`;
const ICON_CURSOR =
  `<svg ${ICON_ATTRS}><path d="M5 3.5 19.5 11l-6.6 1.6L11 19.5z"></path></svg>`;
const ICON_HEART =
  `<svg ${ICON_ATTRS}><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3z"></path></svg>`;
const ICON_CHAT =
  `<svg ${ICON_ATTRS}><path d="M21 12.5a7.5 7.5 0 0 1-10.6 6.8L4 21l1.7-5.4A7.5 7.5 0 1 1 21 12.5z"></path></svg>`;

/** One stat card. `sub` is omitted entirely when the supporting figure is null. */
function statCard(
  iconSvg: string,
  label: string,
  value: string,
  sub: string | null,
  subStyle: string = CARD_SUB_STYLE,
): string {
  const subLine = sub
    ? `\n      <div style="${subStyle}">${sub}</div>`
    : '';
  return `<div style="${CARD_STYLE}">
      <div style="${CARD_HEAD_STYLE}">${iconSvg}<div style="${CARD_LABEL_STYLE}">${label}</div></div>
      <div style="${CARD_VALUE_STYLE}">${value}</div>${subLine}
    </div>`;
}

export async function renderPaidAndOrganic(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  const paid = facts.paid;

  const heading = `<h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Paid and Organic</h2>`;

  const currency = esc(paid.currency);
  // A spend row is often created to record reach and clicks before the invoice
  // is known, leaving spendCents at 0. That is "not entered yet", not "free" —
  // so every money figure on this slide is gated on a positive spend.
  const hasSpend = paid.spend > 0;
  // money(), not num(): num() rounds, so a sub-unit spend would print the very
  // "0 … spent" string the hasSpend gate exists to prevent.
  const spendLine = `${money(paid.spend)} ${currency} spent in ${esc(monthName(facts))}`;
  const headerSpend = hasSpend
    ? `\n    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${spendLine}</div>`
    : '';

  // A row carrying spend alone has nothing to plot or count: the share bar is
  // dropped and all four cards would read "—", leaving a titled empty grid.
  const hasResults =
    paid.paidReach != null ||
    paid.linkClicks != null ||
    paid.paidEngagement != null ||
    paid.messagesStarted != null;

  // ── Nothing measurable to show for this period ─────────────────────────────
  if (!paid.hasData || !hasResults) {
    // Keyed on hasSpend, not hasData: a row saved with spend still blank must
    // not claim spend "was recorded" while the header line above it — correctly
    // suppressed for the same reason — shows no figure at all.
    const emptyLine = !paid.hasData
      ? 'No paid activity recorded for this period.'
      : hasSpend
        ? 'Paid spend was recorded for this period, but no paid results were reported.'
        : 'No paid results were recorded for this period.';
    return slide(
      SECTION_STYLE,
      `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    ${heading}${headerSpend}
  </div>
  <p style="margin:0;max-width:1400px;font-size:34px;line-height:1.45;font-weight:500;color:#3A3746;text-wrap:pretty;">${emptyLine}</p>`,
    );
  }

  // ── Share of total reach ───────────────────────────────────────────────────
  // Both halves are needed for the split bar to be truthful; organic reach is
  // null whenever paid reach outruns measured total reach, and a one-sided bar
  // would read as "100% paid". In that case the block is dropped.
  const organicShare = paid.organicSharePct;
  const paidShare = paid.paidSharePct;
  // Flex items default to min-width:auto, so a segment would refuse to shrink
  // below its own label and a small share would draw far wider than it is.
  // The widths only hold if the labels can be clipped — and a segment too
  // narrow to hold one drops it rather than spilling into its neighbour.
  const organicLabel =
    organicShare != null && organicShare >= SHARE_LABEL_MIN_PCT
      ? `<div style="font-size:32px;font-weight:700;color:#FFFFFF;">Organic ${pct(organicShare)} · ${num(paid.organicReach)}</div>`
      : '';
  const paidLabel =
    paidShare != null && paidShare >= SHARE_LABEL_MIN_PCT
      ? `<div style="font-size:32px;font-weight:700;color:#1C1A22;">Paid ${pct(paidShare)} · ${num(paid.paidReach)}</div>`
      : '';
  const shareBlock =
    organicShare != null && paidShare != null
      ? `<div style="display:flex;flex-direction:column;gap:20px;">
    <div style="font-size:26px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9A96A6;">Share of total reach</div>
    <div style="display:flex;height:80px;">
      <div style="width:${widthPct(organicShare)}%;background:#4E3D8F;display:flex;align-items:center;padding-left:32px;min-width:0;overflow:hidden;">${organicLabel}</div>
      <div style="width:${widthPct(paidShare)}%;background:#F2B01F;display:flex;align-items:center;padding-left:32px;min-width:0;overflow:hidden;">${paidLabel}</div>
    </div>
  </div>
  `
      : '';

  // ── Efficiency cards (each figure is independently optional) ───────────────
  const cards = [
    statCard(
      ICON_CARD,
      'Cost per 1,000 reached',
      hasSpend ? money(paid.costPerThousand) : '—',
      hasSpend && paid.costPerThousand != null ? currency : null,
      CARD_SUB_STYLE_POSITIVE,
    ),
    statCard(
      ICON_CURSOR,
      'Link clicks',
      num(paid.linkClicks),
      paid.costPerClick == null
        ? null
        : hasSpend
          ? `${money(paid.costPerClick)} ${currency} per click`
          : '—',
    ),
    statCard(
      ICON_HEART,
      'Paid eng.',
      num(paid.paidEngagement),
      paid.paidEngagementRate != null ? `${pct(paid.paidEngagementRate)} paid ER` : null,
    ),
    statCard(ICON_CHAT, 'Messages received', num(paid.messagesStarted), null, CARD_SUB_STYLE_POSITIVE),
  ].join('\n    ');

  const note = narrative.paidNote?.trim()
    ? `\n  <p style="margin:0;max-width:1400px;font-size:34px;line-height:1.45;font-weight:500;color:#3A3746;text-wrap:pretty;">${esc(narrative.paidNote.trim())}</p>`
    : '';

  return slide(
    SECTION_STYLE,
    `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;">
    ${heading}${headerSpend}
  </div>
  ${shareBlock}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:#E4E2E8;">
    ${cards}
  </div>${note}`,
  );
}
