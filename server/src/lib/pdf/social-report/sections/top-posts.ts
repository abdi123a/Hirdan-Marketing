// Template sections 11 / 12 / 13 / 14 — "Top Posts · TikTok / Instagram /
// YouTube / Facebook". All four slides are the same layout: a rule-underlined
// header carrying the platform icon, title and period total, then a centred
// grid of up to four post cards (phone mockup, rank, date, headline figure,
// secondary stat, engagement rate, "View post" link).
//
// The four source files differ only in: the platform icon and title, the noun
// used for the header total ("views" vs "reach"), the noun used for the post
// count ("posts" vs "uploads"), the secondary stat's label, and TikTok's
// slightly tighter section/header gaps (it carried an all-time-record footnote
// in the design — see NOTE below).

import type { ReportFacts, TopPost } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import { slide, esc, num, pct, shortDate, icon, remoteImageDataUri } from '../render-kit.js';

interface PlatformConfig {
  /** Key into facts.topPosts and facts.platforms[].platform. */
  key: string;
  /** Display name, exactly as the source writes it in the <h2> and alt text. */
  label: string;
  /** Icon asset name — resolves to icons/<name>.png. */
  iconName: string;
  /** Section style string, copied verbatim from that platform's source file. */
  sectionStyle: string;
  /** Header row style string, copied verbatim (TikTok's padding-bottom differs). */
  headerStyle: string;
  /**
   * The noun printed after the header total.
   *
   * The source writes "views" on TikTok and YouTube and "reach" on Instagram
   * and Facebook, but the only figure we have is PlatformRow.reach — there is
   * no per-platform views field anywhere in ReportFacts (PeriodTotals tracks
   * `videoViews` separately from `reach`, so the two are emphatically not the
   * same metric). Printing reach under the word "views" would misreport it, so
   * all four platforms say "reach". Restoring the source wording needs a real
   * per-platform views figure added to PlatformRow first.
   */
  metricNoun: string;
  /** The noun the source uses for the post count: "posts" or "uploads". */
  unitPlural: string;
  unitSingular: string;
  /** Label after the secondary figure: "shares" or "eng.". */
  secondaryLabel: string;
}

const SECTION_STYLE_STANDARD =
  'background:#FFFFFF;padding:80px 100px 70px;display:flex;flex-direction:column;gap:38px;';
const HEADER_STYLE_STANDARD =
  'display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:28px;';

const CONFIGS: Record<string, PlatformConfig> = {
  tiktok: {
    key: 'tiktok',
    label: 'TikTok',
    iconName: 'tiktok',
    // TikTok's slide runs a tighter gap/padding than the other three because the
    // design placed an extra footnote line beneath the grid. Kept verbatim.
    sectionStyle: 'background:#FFFFFF;padding:80px 100px 70px;display:flex;flex-direction:column;gap:30px;',
    headerStyle:
      'display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1C1A22;padding-bottom:26px;',
    // Source reads "views" — see PlatformConfig.metricNoun for why it says reach.
    metricNoun: 'reach',
    unitPlural: 'posts',
    unitSingular: 'post',
    secondaryLabel: 'shares',
  },
  instagram: {
    key: 'instagram',
    label: 'Instagram',
    iconName: 'instagram',
    sectionStyle: SECTION_STYLE_STANDARD,
    headerStyle: HEADER_STYLE_STANDARD,
    metricNoun: 'reach',
    unitPlural: 'posts',
    unitSingular: 'post',
    secondaryLabel: 'eng.',
  },
  youtube: {
    key: 'youtube',
    label: 'YouTube',
    iconName: 'youtube',
    sectionStyle: SECTION_STYLE_STANDARD,
    headerStyle: HEADER_STYLE_STANDARD,
    // Source reads "views" — see PlatformConfig.metricNoun for why it says reach.
    metricNoun: 'reach',
    unitPlural: 'uploads',
    unitSingular: 'upload',
    // NOTE: the source reads "3:42 avg. watch" here. We have no average-view-
    // duration field anywhere in ReportFacts — TopPost.secondaryMetric is total
    // engagement for YouTube (see report-facts.ts). Rendering a fabricated
    // duration in a client-facing report is not acceptable, so YouTube shows the
    // engagement count with the same "eng." label the other platforms use.
    secondaryLabel: 'eng.',
  },
  facebook: {
    key: 'facebook',
    label: 'Facebook',
    iconName: 'facebook',
    sectionStyle: SECTION_STYLE_STANDARD,
    headerStyle: HEADER_STYLE_STANDARD,
    metricNoun: 'reach',
    unitPlural: 'posts',
    unitSingular: 'post',
    secondaryLabel: 'eng.',
  },
};

/** Only http(s) links become anchors — anything else is dropped, not rendered. */
function safeHref(link: string | null | undefined): string | null {
  if (!link) return null;
  return /^https?:\/\//i.test(link) ? link : null;
}

/**
 * The right-hand header line: "July 2026 · 412,600 reach across 14 posts".
 * Degrades honestly — the reach clause disappears when the platform's reach is
 * null, and the whole count clause disappears when the platform has no row.
 */
function headerMeta(cfg: PlatformConfig, facts: ReportFacts): string {
  const row = facts.platforms.find(p => p.platform === cfg.key);
  const parts: string[] = [esc(facts.period.label)];
  if (row) {
    const unit = row.posts === 1 ? cfg.unitSingular : cfg.unitPlural;
    parts.push(
      row.reach != null
        ? `${num(row.reach)} ${cfg.metricNoun} across ${num(row.posts)} ${unit}`
        : `${num(row.posts)} ${unit}`,
    );
  }
  return parts.join(' · ');
}

/**
 * One post card. `thumb` is a pre-resolved data URI (or null) because the fetch
 * has to happen outside the string-building.
 */
function card(cfg: PlatformConfig, post: TopPost, index: number, thumb: string | null): string {
  const rankColor = index === 0 ? '#F2B01F' : '#C6C2CE';
  const rankText = String(post.rank).padStart(2, '0');
  const date = shortDate(post.postedAt);
  const href = safeHref(post.link);

  // The design nested the thumbnail in an IOSDevice custom element. Custom
  // elements do not exist in the Puppeteer render, so the frame is a plain div
  // carrying IOSDevice's own root styles verbatim — 402x874 pre-scale size,
  // border-radius 48px, overflow hidden, #F2F2F7 body and the two-layer device
  // shadow — so the card still reads as the designed mockup.
  //
  // Deliberately NOT reproduced: IOSDevice's status bar, dynamic island and
  // home indicator. Those overlays sit on top of a phone screenshot; what we
  // have is a post thumbnail, and drawing iOS chrome over it would dress a
  // photo up as something it isn't.
  const image = thumb
    ? `<img src="${esc(thumb)}" alt="${esc(post.caption ?? '')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;">`
    : '';

  return `
      <div style="display:flex;flex-direction:column;gap:14px;width:216px;">
        <div style="width:216px;height:470px;position:relative;">
          <div style="width:402px;height:874px;transform:scale(0.537);transform-origin:top left;">
            <div style="width:402px;height:874px;border-radius:48px;overflow:hidden;position:relative;background:#F2F2F7;box-shadow:0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12);">
              <div style="position:relative;height:874px;background:#F2F2F7;">${image}</div>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding-top:6px;">
          <div style="font-size:30px;font-weight:800;color:${rankColor};">${rankText}</div>
          ${date ? `<div style="font-size:26px;font-weight:600;color:#6E6A7A;">${esc(date)}</div>` : ''}
        </div>
        <div style="font-size:48px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:#1C1A22;">${post.primaryMetric > 0 ? num(post.primaryMetric) : '—'}</div>
        ${post.secondaryMetric != null ? `<div style="font-size:26px;font-weight:600;color:#6E6A7A;">${num(post.secondaryMetric)} ${cfg.secondaryLabel}</div>` : ''}
        ${post.engagementRate != null ? `<div style="font-size:26px;font-weight:600;color:#4E3D8F;">${pct(post.engagementRate)} ER</div>` : ''}
        ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="font-size:26px;font-weight:700;color:#4E3D8F;border-bottom:2px solid #F2B01F;align-self:flex-start;padding-bottom:4px;margin-top:4px;" style-hover="color:#F2B01F;">View post ↗</a>` : ''}
      </div>`;
}

/** The layout shared by all four Top Posts slides. */
async function renderTopPosts(cfg: PlatformConfig, facts: ReportFacts): Promise<string> {
  const iconUri = await icon(cfg.iconName);
  const iconImg = iconUri
    ? `<img src="${iconUri}" alt="${esc(cfg.label)}" style="width:64px;height:64px;display:block;">`
    : '';

  const header = `
  <div style="${cfg.headerStyle}">
    <div style="display:flex;align-items:center;gap:26px;">
      ${iconImg}
      <h2 style="margin:0;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:#1C1A22;">Top Posts · ${esc(cfg.label)}</h2>
    </div>
    <div style="font-size:26px;font-weight:600;color:#6E6A7A;">${headerMeta(cfg, facts)}</div>
  </div>`;

  const posts = (facts.topPosts[cfg.key] ?? []).slice(0, 4);

  if (posts.length === 0) {
    // No skeleton cards and no placeholder dates — just the heading and a line
    // that says so, in the template's own quiet-note treatment.
    return slide(
      cfg.sectionStyle,
      `${header}
  <div style="font-size:24px;font-weight:500;color:#9A96A6;">No posts published on ${esc(cfg.label)} this period.</div>
`,
    );
  }

  const thumbs = await Promise.all(posts.map(p => remoteImageDataUri(p.thumbnailUrl)));
  const cards = posts.map((p, i) => card(cfg, p, i, thumbs[i] ?? null)).join('');

  // The source hard-codes repeat(4,216px), so a short row keeps the designed
  // left alignment and leaves the gap on the right rather than re-centring a
  // narrower grid. Kept verbatim.
  return slide(
    cfg.sectionStyle,
    `${header}
  <div style="display:grid;grid-template-columns:repeat(4,216px);gap:120px;justify-content:center;">${cards}
  </div>
`,
  );
}

/**
 * Section 11 — Top Posts · TikTok.
 *
 * NOTE: the design closed this slide with "All-time record: 2.42M views
 * (18 Apr 2025). No July post entered the all-time top four." Nothing in
 * ReportFacts carries an all-time high or its date, so the line is omitted
 * rather than invented. The slide's own gap/padding values are kept verbatim.
 */
export async function renderTopPostsTiktok(facts: ReportFacts, narrative: Narrative): Promise<string> {
  void narrative;
  return renderTopPosts(CONFIGS.tiktok!, facts);
}

/** Section 12 — Top Posts · Instagram. */
export async function renderTopPostsInstagram(facts: ReportFacts, narrative: Narrative): Promise<string> {
  void narrative;
  return renderTopPosts(CONFIGS.instagram!, facts);
}

/** Section 13 — Top Posts · YouTube. */
export async function renderTopPostsYoutube(facts: ReportFacts, narrative: Narrative): Promise<string> {
  void narrative;
  return renderTopPosts(CONFIGS.youtube!, facts);
}

/** Section 14 — Top Posts · Facebook. */
export async function renderTopPostsFacebook(facts: ReportFacts, narrative: Narrative): Promise<string> {
  void narrative;
  return renderTopPosts(CONFIGS.facebook!, facts);
}
