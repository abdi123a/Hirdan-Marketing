// Template sections 18 "Age and Gender" and 19 "Top Locations".
//
// Markup is a verbatim transcription of the designed slides — same inline
// styles, same colours, same order. Only the values are interpolated.
//
// Both slides are fed by AccountDemographic rows, which only exist after someone
// uploads an analytics export. An empty block here is therefore routine, and has
// to look deliberate rather than broken: the heading stays, the body says there
// is nothing, and no figure is ever guessed. The country and city blocks render
// independently for the same reason — city rows lag country rows in practice.

import type { ReportFacts, ShareRow } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import {
  slide,
  esc,
  num,
  fractionPct,
  scaleBars,
  conicStops,
  DONUT_COLORS,
  titleCase,
} from '../render-kit.js';

// ── shared ───────────────────────────────────────────────────────────────────

function emptyLine(text: string): string {
  return `<div style="font-size:30px;font-weight:600;color:#6E6A7A;">${esc(text)}</div>`;
}

/**
 * Collapse duplicate labels and, where several accounts each contributed a whole
 * distribution, rescale so the set reads as one blended share.
 *
 * Labels are canonicalised through the same normaliser the slide will print
 * with *before* they are keyed. The importers store different raw wording for
 * the same real-world bucket — TikTok Studio's own gender wording next to the
 * Meta importer's "Women"/"Men" — so keying on the raw label would give one
 * client with both a TikTok and an Instagram account two slices for the same
 * gender, each with its own fraction, and a donut that double-counts.
 *
 * AccountDemographic is unique per (account, kind, label), so two connected
 * accounts each produce their own "Female" row and report-facts passes both
 * through untouched. Summing them and dividing by the total is the unweighted
 * blend of those distributions. A single account's rows already sum to about 1,
 * so this is a no-op there — and a partial export that sums to less than 1 is
 * deliberately left alone rather than inflated to fill the circle.
 */
function mergeShares(
  rows: ShareRow[] | null | undefined,
  normalise: (label: string) => string = label => label,
): ShareRow[] {
  if (!rows || rows.length === 0) return [];

  const by = new Map<string, number>();
  for (const row of rows) {
    if (!row || typeof row.label !== 'string') continue;
    const raw = row.label.trim();
    if (!raw) continue;
    const label = normalise(raw);
    if (!label) continue;
    const fraction = row.fraction;
    if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction <= 0) continue;
    by.set(label, (by.get(label) ?? 0) + fraction);
  }

  const merged = Array.from(by, ([label, fraction]) => ({ label, fraction }));
  const total = merged.reduce((sum, r) => sum + r.fraction, 0);
  const scaled = total > 1.001
    ? merged.map(r => ({ label: r.label, fraction: r.fraction / total }))
    : merged;

  return scaled.sort((a, b) => b.fraction - a.fraction);
}

const OTHER_LABEL = /^others?$/i;

/**
 * Fit a share list to the design's fixed number of legend slots by folding the
 * tail into the template's own "Other" row — which the exports already use, so
 * an imported "Others" merges into it instead of appearing twice. Nothing is
 * invented: the row is exactly the sum of the shares it stands in for.
 *
 * The result is re-sorted by share because the design ranks "Other" like any
 * other row (it sits fourth of six on the locations slide, not last), which also
 * keeps the colour ramp running darkest-to-lightest down the legend.
 */
function topShares(rows: ShareRow[], slots: number): ShareRow[] {
  const named = rows.filter(r => !OTHER_LABEL.test(r.label));
  let other = rows
    .filter(r => OTHER_LABEL.test(r.label))
    .reduce((sum, r) => sum + r.fraction, 0);

  // "Other" is an ADDITIONAL row, not a competitor for a named slot. Letting it
  // claim one meant a 3% "Other" bucket pushed Men out of a 2-slot gender chart
  // and swallowed his ~47% share, so the donut headlined the audience as
  // "50.3% Other" — a group that doesn't exist. A slot is only surrendered when
  // the named entries genuinely overflow and a real tail needs collecting.
  const room = named.length > slots ? Math.max(0, slots - 1) : slots;
  const head = named.slice(0, room);
  other += named.slice(room).reduce((sum, r) => sum + r.fraction, 0);

  const all = other > 0 ? [...head, { label: 'Other', fraction: other }] : head;
  return all.sort((a, b) => b.fraction - a.fraction);
}

/**
 * Conic stops for a donut whose slices are meant to be a complete partition.
 * Normalising the arcs keeps the ring closed when an export doesn't quite sum to
 * 100%; the printed percentages stay the real, un-normalised ones.
 */
function donutStops(slices: ShareRow[], colors: string[]): string {
  const total = slices.reduce((sum, r) => sum + r.fraction, 0);
  const arcs = total > 0 ? slices.map(r => ({ fraction: r.fraction / total })) : slices;
  return conicStops(arcs, colors);
}

// ── 18 Age and Gender ────────────────────────────────────────────────────────

const AGE_STYLE =
  'background:#FFFFFF;padding:90px 100px 70px;display:flex;flex-direction:column;gap:40px;';

/** The design writes the gender split as "Women" / "Men"; exports store codes. */
const GENDER_LABELS: Record<string, string> = {
  f: 'Women', female: 'Women', females: 'Women', women: 'Women', woman: 'Women',
  m: 'Men', male: 'Men', males: 'Men', men: 'Men', man: 'Men',
  u: 'Unknown', unknown: 'Unknown',
};

function genderLabel(label: string): string {
  const key = label.trim().toLowerCase();
  const mapped = GENDER_LABELS[key];
  return mapped ? mapped : titleCase(label.trim());
}

/** "18-24" → { lo: 18, hi: 24 }; "65+" → { lo: 65, hi: Infinity }; else null. */
function ageRange(label: string): { lo: number; hi: number } | null {
  const s = label.trim();
  const span = /^(\d{1,3})\s*[-–—]\s*(\d{1,3})$/.exec(s);
  if (span) return { lo: Number(span[1]), hi: Number(span[2]) };
  const open = /^(\d{1,3})\s*\+$/.exec(s);
  if (open) return { lo: Number(open[1]), hi: Number.POSITIVE_INFINITY };
  return null;
}

/** The design sets age ranges with an en dash; the exports use a hyphen. */
function ageLabel(label: string): string {
  return label.trim().replace(/\s*[-–—]\s*/, '–');
}

function genderBlock(rows: ShareRow[]): string {
  if (rows.length === 0) {
    return `<div style="display:flex;flex-direction:column;gap:32px;align-items:center;">
      ${emptyLine('No gender split available')}
    </div>`;
  }

  // Two slices, and only two: the design's legend is a bare
  // 'display:flex;gap:40px;' with no wrap inside a fixed 520px grid track, so a
  // third item overflows the track and collides with the donut, so the legend
  // above is allowed to wrap — the design never anticipated a third gender
  // bucket, and wrapping one onto a second line is a smaller lie than dropping
  // a real share or folding a named gender into "Other".
  const slices = topShares(rows, 2);
  const stops = donutStops(slices, DONUT_COLORS);
  const top = slices[0];

  const legend = slices
    .map((row, i) => {
      const swatch = DONUT_COLORS[i % DONUT_COLORS.length];
      const text = `${genderLabel(row.label)} ${fractionPct(row.fraction)}`;
      if (i === 0) {
        return `<div style="display:flex;align-items:center;gap:14px;"><div style="width:24px;height:24px;background:${swatch};"></div><div style="font-size:28px;font-weight:700;color:#1C1A22;">${esc(text)}</div></div>`;
      }
      return `<div style="display:flex;align-items:center;gap:14px;"><div style="width:24px;height:24px;background:${swatch};"></div><div style="font-size:28px;font-weight:600;color:#3A3746;">${esc(text)}</div></div>`;
    })
    .join('\n        ');

  return `<div style="display:flex;flex-direction:column;gap:32px;align-items:center;">
      <div style="width:340px;height:340px;border-radius:50%;background:conic-gradient(${stops});display:flex;align-items:center;justify-content:center;">
        <div style="width:190px;height:190px;border-radius:50%;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <div style="font-size:56px;font-weight:800;letter-spacing:-0.02em;color:#1C1A22;">${fractionPct(top.fraction)}</div>
          <div style="font-size:24px;font-weight:600;color:#6E6A7A;">${esc(genderLabel(top.label))}</div>
        </div>
      </div>
      <div style="display:flex;gap:40px;flex-wrap:wrap;row-gap:14px;justify-content:center;">
        ${legend}
      </div>
    </div>`;
}

interface AgeEntry {
  row: ShareRow;
  range: { lo: number; hi: number } | null;
}

function ageBlock(rows: ShareRow[]): string {
  const heading = '<div style="font-size:30px;font-weight:700;color:#1C1A22;">Age distribution</div>';

  if (rows.length === 0) {
    return `<div style="display:flex;flex-direction:column;gap:22px;height:100%;">
      ${heading}
      ${emptyLine('No age breakdown available')}
    </div>`;
  }

  // The widest real bucket set is seven (Meta's); the cap only guards against a
  // malformed import shredding the column grid.
  const kept = rows.slice(0, 8);
  const ranges = kept.map(r => ageRange(r.label));
  const parsed = ranges.every(r => r !== null);

  const entries: AgeEntry[] = kept.map((row, i) => ({ row, range: ranges[i] }));

  // Brackets read low-to-high in the design, but the facts arrive ranked by
  // share. Re-order when the labels parse; otherwise leave the ranking alone.
  const ordered: AgeEntry[] = parsed
    ? entries.slice().sort((a, b) => (a.range?.lo ?? 0) - (b.range?.lo ?? 0))
    : entries;

  // The design's tallest bar is 99.4% of its column — a value ceiling with a
  // little headroom. Keeping that ceiling puts a full-height bar exactly where
  // the original one sat.
  const heights = scaleBars(ordered.map(o => o.row.fraction), 99.4);

  // The design paints the two leading brackets in the strong purple with the
  // heavier type, and the rest in the pale purple.
  const leaders = new Set(
    kept
      .slice()
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, 2)
      .map(r => r.label),
  );

  const columns = ordered
    .map((entry, i) => {
      const lead = leaders.has(entry.row.label);
      const valueStyle = lead
        ? 'font-size:36px;font-weight:800;color:#1C1A22;text-align:center;'
        : 'font-size:32px;font-weight:700;color:#1C1A22;text-align:center;';
      const barColor = lead ? '#4E3D8F' : '#8B7BC8';
      const labelStyle = lead
        ? 'font-size:30px;font-weight:700;color:#1C1A22;text-align:center;border-top:2px solid #E4E2E8;padding-top:14px;'
        : 'font-size:28px;font-weight:600;color:#3A3746;text-align:center;border-top:2px solid #E4E2E8;padding-top:14px;';
      return `<div style="display:flex;flex-direction:column;gap:12px;height:100%;justify-content:flex-end;">
        <div style="${valueStyle}">${fractionPct(entry.row.fraction)}</div>
        <div style="height:${heights[i].toFixed(1)}%;background:${barColor};"></div>
        <div style="${labelStyle}">${esc(ageLabel(entry.row.label))}</div>
      </div>`;
    })
    .join('\n      ');

  // "68% of the audience is under 35" is the sum of every bracket that ends
  // below 35. If a single label doesn't parse into a range the sentence would be
  // a guess, so it is dropped instead.
  let caption = '';
  if (parsed) {
    const under35 = ordered.reduce(
      (sum, entry) => (entry.range && entry.range.hi < 35 ? sum + entry.row.fraction : sum),
      0,
    );
    caption = `\n      <div style="font-size:30px;font-weight:600;color:#3A3746;">${fractionPct(under35, 0)} of the audience is under 35.</div>`;
  }

  return `<div style="display:flex;flex-direction:column;gap:22px;height:100%;">
      ${heading}
      <div style="flex:1;display:grid;grid-template-columns:repeat(${ordered.length},1fr);gap:40px;align-items:end;">
      ${columns}
      </div>${caption}
    </div>`;
}

export async function renderAgeAndGender(
  facts: ReportFacts,
  _narrative: Narrative,
): Promise<string> {
  const gender = mergeShares(facts.audience.gender, genderLabel);
  const age = mergeShares(facts.audience.age, ageLabel);

  // facts.totals.followers is followersAsOf() over every active account, while
  // the split below comes only from accounts that have AccountDemographic rows —
  // which exist only after someone uploads an export. Naming the absolute total
  // when there is no distribution under it presents a number the slide never
  // accounts for, so the count is printed only when demographics exist at all.
  //
  // Even then it is a scope note rather than a denominator: a fully correct
  // blend would weight each account's distribution by that account's own
  // follower total, which report-facts does not carry alongside the demographic
  // rows, so mergeShares() blends them unweighted.
  const followers = facts.totals.followers;
  const hasDemographics = gender.length > 0 || age.length > 0;
  const scope = hasDemographics && Number.isFinite(followers) && followers > 0
    ? `Share of ${num(followers)} followers`
    : 'Share of followers';

  const head = `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:24px;">
    <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Age and Gender</h2>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(scope)}</div>
  </div>`;

  if (gender.length === 0 && age.length === 0) {
    return slide(
      AGE_STYLE,
      `${head}${emptyLine('No audience demographics for this period')}`,
    );
  }

  return slide(
    AGE_STYLE,
    `${head}
  <div style="flex:1;display:grid;grid-template-columns:520px 1fr;gap:90px;align-items:center;">
    ${genderBlock(gender)}
    ${ageBlock(age)}
  </div>`,
  );
}

// ── 19 Top Locations ─────────────────────────────────────────────────────────

const LOCATIONS_STYLE =
  'background:#FFFFFF;padding:90px 100px 70px;display:flex;flex-direction:column;gap:40px;';

// This slide is drawn with its own ramp — a four-step purple fade into the two
// ambers — which is not the shared DONUT_COLORS order. Copied verbatim from the
// source so the slide keeps the palette it was designed with.
const LOCATION_COLORS = ['#4E3D8F', '#6B5AB0', '#8B7BC8', '#D8D4E2', '#F2B01F', '#F6C95C'];
const COUNTRY_SLOTS = LOCATION_COLORS.length;
const CITY_SLOTS = 7;

/**
 * Exports store countries either as names ("Djibouti") or as ISO alpha-2 codes
 * ("DJ"). The design shows names, so a bare two-letter code is expanded through
 * the runtime's own region table — same fact, the design's wording.
 */
const regionNames: { of(code: string): string | undefined } | null = (() => {
  try {
    const DisplayNames = (Intl as unknown as { DisplayNames?: unknown }).DisplayNames;
    if (typeof DisplayNames !== 'function') return null;
    const Ctor = DisplayNames as unknown as new (
      locales: string[],
      options: { type: string },
    ) => { of(code: string): string | undefined };
    return new Ctor(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

function countryLabel(label: string): string {
  const s = label.trim();
  if (!regionNames || !/^[A-Za-z]{2}$/.test(s)) return s;
  try {
    return regionNames.of(s.toUpperCase()) || s;
  } catch {
    return s;
  }
}

function countryBlock(rows: ShareRow[]): string {
  const heading = '<div style="font-size:30px;font-weight:700;color:#1C1A22;">Country</div>';

  if (rows.length === 0) {
    return `<div style="display:flex;flex-direction:column;gap:24px;height:100%;">
      ${heading}
      ${emptyLine('No country breakdown available')}
    </div>`;
  }

  const slices = topShares(rows, COUNTRY_SLOTS);
  const stops = donutStops(slices, LOCATION_COLORS);
  const top = slices[0];

  const legend = slices
    .map((row, i) => {
      const swatch = LOCATION_COLORS[i % LOCATION_COLORS.length];
      const label = esc(countryLabel(row.label));
      const share = fractionPct(row.fraction);
      if (i === 0) {
        return `<div style="display:flex;align-items:center;gap:16px;"><div style="width:22px;height:22px;background:${swatch};"></div><div style="flex:1;font-size:28px;font-weight:700;color:#1C1A22;">${label}</div><div style="font-size:28px;font-weight:800;color:#1C1A22;">${share}</div></div>`;
      }
      return `<div style="display:flex;align-items:center;gap:16px;"><div style="width:22px;height:22px;background:${swatch};"></div><div style="flex:1;font-size:28px;font-weight:600;color:#3A3746;">${label}</div><div style="font-size:28px;font-weight:700;color:#3A3746;">${share}</div></div>`;
    })
    .join('\n          ');

  return `<div style="display:flex;flex-direction:column;gap:24px;height:100%;">
      ${heading}
      <div style="flex:1;display:flex;align-items:center;gap:50px;">
        <div style="width:400px;height:400px;border-radius:50%;background:conic-gradient(${stops});display:flex;align-items:center;justify-content:center;flex:none;">
          <div style="width:230px;height:230px;border-radius:50%;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
            <div style="font-size:62px;font-weight:800;letter-spacing:-0.02em;color:#1C1A22;">${fractionPct(top.fraction)}</div>
            <div style="font-size:24px;font-weight:600;color:#6E6A7A;">${esc(countryLabel(top.label))}</div>
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:20px;">
          ${legend}
        </div>
      </div>
    </div>`;
}

function cityBlock(rows: ShareRow[]): string {
  const heading = '<div style="font-size:30px;font-weight:700;color:#1C1A22;">City</div>';

  // space-between exists to spread seven bar rows down the column; with a
  // heading and one line it would pin them to opposite ends of the slide, so the
  // empty branch drops it — same as countryBlock's.
  if (rows.length === 0) {
    return `<div style="display:flex;flex-direction:column;height:100%;">
      ${heading}
      ${emptyLine('No city breakdown available')}
    </div>`;
  }

  // Unlike the country donut this is a ranked list, not a partition: bars are
  // measured against the leader, exactly as the design plots them.
  const kept = rows.slice(0, CITY_SLOTS);
  const widths = scaleBars(kept.map(r => r.fraction), 100);

  const bars = kept
    .map((row, i) => {
      const lead = i === 0;
      const labelStyle = lead
        ? 'font-size:32px;font-weight:700;color:#1C1A22;'
        : 'font-size:30px;font-weight:600;color:#3A3746;';
      const barColor = lead ? '#4E3D8F' : '#8B7BC8';
      const valueStyle = lead
        ? 'font-size:32px;font-weight:800;color:#1C1A22;text-align:right;'
        : 'font-size:30px;font-weight:700;color:#3A3746;text-align:right;';
      return `<div style="display:grid;grid-template-columns:230px 1fr 120px;gap:26px;align-items:center;">
        <div style="${labelStyle}">${esc(row.label)}</div>
        <div style="height:44px;background:#F4F3F6;"><div style="height:44px;width:${widths[i].toFixed(1)}%;background:${barColor};"></div></div>
        <div style="${valueStyle}">${fractionPct(row.fraction)}</div>
      </div>`;
    })
    .join('\n      ');

  return `<div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
      ${heading}
      ${bars}
    </div>`;
}

export async function renderTopLocations(
  facts: ReportFacts,
  _narrative: Narrative,
): Promise<string> {
  const head = `<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:24px;">
    <div style="display:flex;align-items:center;gap:24px;"><svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#4E3D8F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;"><circle cx="12" cy="12" r="8.75"></circle><path d="M3.4 9.5h17.2M3.4 14.5h17.2"></path><path d="M12 3.3c-2.4 2.4-3.6 5.4-3.6 8.7s1.2 6.3 3.6 8.7c2.4-2.4 3.6-5.4 3.6-8.7S14.4 5.7 12 3.3z"></path></svg><h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Top Locations</h2></div>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">Share of total followers</div>
  </div>`;

  const country = mergeShares(facts.audience.country, countryLabel);
  const city = mergeShares(facts.audience.city);

  if (country.length === 0 && city.length === 0) {
    return slide(LOCATIONS_STYLE, `${head}${emptyLine('No location data for this period')}`);
  }

  return slide(
    LOCATIONS_STYLE,
    `${head}
  <div style="flex:1;display:grid;grid-template-columns:760px 1fr;gap:110px;align-items:stretch;">
    ${countryBlock(country)}
    ${cityBlock(city)}
  </div>`,
  );
}
