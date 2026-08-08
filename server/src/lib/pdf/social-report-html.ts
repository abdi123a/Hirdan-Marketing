// Assembles the monthly social performance report document.
//
// Each of the 21 slides is a near-verbatim transcription of the designed
// template, living in ./social-report/sections/*.ts. This module only orders
// them, supplies the document shell, and keeps the page geometry identical to
// the design (1920x1080 per slide).

import type { ReportFacts } from '../social/report/report-facts.js';
import type { Narrative } from '../social/report/narrative.js';
import { SLIDE_W, SLIDE_H, C } from './social-report/render-kit.js';

import { renderTitle, renderExecutiveSummary } from './social-report/sections/cover-and-summary.js';
import { renderMonthAtAGlance } from './social-report/sections/month-at-a-glance.js';
import {
  renderDividerPerformance,
  renderDividerContent,
  renderDividerAudience,
} from './social-report/sections/dividers.js';
import {
  renderReachEngagementTrend,
  renderFollowerGrowth,
} from './social-report/sections/trend-and-growth.js';
import {
  renderPlatformScorecard,
  renderPlatformMix,
} from './social-report/sections/scorecard-and-mix.js';
import { renderPaidAndOrganic } from './social-report/sections/paid-and-organic.js';
import {
  renderTopPostsTiktok,
  renderTopPostsInstagram,
  renderTopPostsYoutube,
  renderTopPostsFacebook,
} from './social-report/sections/top-posts.js';
import {
  renderFormatPerformance,
  renderBestTimes,
} from './social-report/sections/format-and-times.js';
import { renderAgeAndGender, renderTopLocations } from './social-report/sections/audience.js';
import { renderRecommendations, renderThankYou } from './social-report/sections/closing.js';

type SectionRenderer = (facts: ReportFacts, narrative: Narrative) => Promise<string>;

/** Slide order, exactly as the design sequences them. */
const SECTIONS: { key: string; render: SectionRenderer }[] = [
  { key: 'title', render: renderTitle },
  { key: 'executiveSummary', render: renderExecutiveSummary },
  { key: 'monthAtAGlance', render: renderMonthAtAGlance },
  { key: 'dividerPerformance', render: renderDividerPerformance },
  { key: 'reachEngagementTrend', render: renderReachEngagementTrend },
  { key: 'followerGrowth', render: renderFollowerGrowth },
  { key: 'platformScorecard', render: renderPlatformScorecard },
  { key: 'platformMix', render: renderPlatformMix },
  { key: 'paidAndOrganic', render: renderPaidAndOrganic },
  { key: 'dividerContent', render: renderDividerContent },
  { key: 'topPostsTiktok', render: renderTopPostsTiktok },
  { key: 'topPostsInstagram', render: renderTopPostsInstagram },
  { key: 'topPostsYoutube', render: renderTopPostsYoutube },
  { key: 'topPostsFacebook', render: renderTopPostsFacebook },
  { key: 'formatPerformance', render: renderFormatPerformance },
  { key: 'bestTimes', render: renderBestTimes },
  { key: 'dividerAudience', render: renderDividerAudience },
  { key: 'ageAndGender', render: renderAgeAndGender },
  { key: 'topLocations', render: renderTopLocations },
  { key: 'recommendations', render: renderRecommendations },
  { key: 'thankYou', render: renderThankYou },
];

export const SECTION_KEYS = SECTIONS.map(s => s.key);

/**
 * Render every slide.
 *
 * A section that throws is replaced with an empty slide rather than failing the
 * whole report — one bad data shape shouldn't cost the client their document —
 * but the error is logged loudly so it doesn't pass unnoticed.
 */
export async function renderSections(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<{ key: string; html: string }[]> {
  return Promise.all(
    SECTIONS.map(async ({ key, render }) => {
      try {
        return { key, html: await render(facts, narrative) };
      } catch (err) {
        console.error(`[SocialReport] Section "${key}" failed to render:`, err);
        return {
          key,
          html: `<section style="width:${SLIDE_W}px;height:${SLIDE_H}px;background:${C.white};"></section>`,
        };
      }
    }),
  );
}

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

/**
 * Wrap slides in the document shell.
 *
 * `forPrint` adds the page-break rules Puppeteer needs; the preview leaves them
 * off and stacks slides with a gap so they read as a scrollable deck.
 */
export function wrapDocument(slides: string[], opts: { forPrint: boolean }): string {
  const pageCss = opts.forPrint
    ? `@page { size: ${SLIDE_W}px ${SLIDE_H}px; margin: 0; }
       .slide { page-break-after: always; break-after: page; }
       .slide:last-child { page-break-after: auto; break-after: auto; }
       body { background: ${C.white}; }`
    : `body { background: ${C.page}; padding: 24px; }
       .slide { margin: 0 auto 24px; box-shadow: 0 2px 18px rgba(28,26,34,0.12); }`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${FONT_LINK}
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Archivo, Helvetica, sans-serif; }
  a { color: ${C.purple}; text-decoration: none; }
  .slide { width: ${SLIDE_W}px; height: ${SLIDE_H}px; overflow: hidden; position: relative; }
  .slide > section { width: ${SLIDE_W}px; height: ${SLIDE_H}px; }
  ${pageCss}
</style>
</head>
<body>${slides.map(s => `<div class="slide">${s}</div>`).join('')}</body>
</html>`;
}

/** Full document HTML for a report. */
export async function buildSocialReportHtml(
  facts: ReportFacts,
  narrative: Narrative,
  opts: { forPrint: boolean } = { forPrint: true },
): Promise<string> {
  const sections = await renderSections(facts, narrative);
  return wrapDocument(sections.map(s => s.html), opts);
}

/** Rebuild the document from stored per-section HTML (edited reports). */
export function buildSocialReportHtmlFromSections(
  sections: { key: string; html: string }[],
  opts: { forPrint: boolean } = { forPrint: true },
): string {
  const order = new Map(SECTION_KEYS.map((k, i) => [k, i]));
  const ordered = [...sections].sort(
    (a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999),
  );
  return wrapDocument(ordered.map(s => s.html), opts);
}
