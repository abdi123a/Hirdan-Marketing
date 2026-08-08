// Template sections 04 / 10 / 17 — the three purple section dividers
// ("Section One — Performance", "Section Two — Content", "Section Three —
// Audience"). All three are the same design with three swapped strings; the
// eyebrow, title and subtitle are static design copy, not data, so they stay
// literal. Nothing on these slides is derived from facts or narrative.

import type { ReportFacts } from '../../../social/report/report-facts.js';
import type { Narrative } from '../../../social/report/narrative.js';
import { slide, logoWhite } from '../render-kit.js';

const DIVIDER_STYLE =
  'background:#4E3D8F;padding:90px 100px 80px;display:flex;flex-direction:column;justify-content:space-between;';

/** The shared divider layout. `eyebrow`, `title` and `subtitle` are design copy. */
async function renderDivider(eyebrow: string, title: string, subtitle: string): Promise<string> {
  const logo = await logoWhite();
  // If the logo asset is missing, drop the <img> rather than emit an empty src
  // that renders as a broken-image box in the PDF.
  const logoImg = logo
    ? `<img src="${logo}" alt="Hirdan" style="width:200px;height:auto;display:block;opacity:0.9;">`
    : '';
  return slide(
    DIVIDER_STYLE,
    `
  <div style="font-size:26px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#F2B01F;">${eyebrow}</div>
  <div style="display:flex;flex-direction:column;gap:34px;"><h2 style="margin:0;font-size:140px;font-weight:800;letter-spacing:-0.04em;line-height:1;color:#FFFFFF;">${title}</h2></div>
  <div style="display:flex;align-items:flex-end;justify-content:space-between;">
    <div style="font-size:34px;font-weight:500;color:#C9C2E4;">${subtitle}</div>
    ${logoImg}
  </div>
`,
  );
}

/** Section 04 — divider before the performance chapter. */
export async function renderDividerPerformance(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  void facts;
  void narrative;
  return renderDivider('Section One', 'Performance', 'Reach, growth, platform mix, paid and organic');
}

/** Section 10 — divider before the content chapter. */
export async function renderDividerContent(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  void facts;
  void narrative;
  return renderDivider('Section Two', 'Content', 'What we published and what it returned');
}

/** Section 17 — divider before the audience chapter. */
export async function renderDividerAudience(
  facts: ReportFacts,
  narrative: Narrative,
): Promise<string> {
  void facts;
  void narrative;
  return renderDivider('Section Three', 'Audience', 'Who follows the account and where they are');
}
