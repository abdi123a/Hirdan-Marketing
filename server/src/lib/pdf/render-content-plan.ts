import { getPdfBrowser } from './puppeteer-browser.js';
import { buildContentPlanHtml, type ContentPlanPdfInput } from './content-plan-html.js';

/**
 * Renders the content-plan PDF at 1200px wide, cropped flush to content
 * (no leftover whitespace under the footer).
 */
export async function renderContentPlanPdf(input: ContentPlanPdfInput): Promise<Buffer> {
  const html = await buildContentPlanHtml(input);
  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1200, height: 2400, deviceScaleFactor: 1 });
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 60_000,
    });

    await page.evaluate(`
      Promise.all(
        Array.from(document.images).map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
              })
        )
      )
    `);

    // Use integer offsetHeight of .plan (footer is the last child) so the
    // PDF page ends exactly at the purple bar — no trailing white strip.
    const contentHeight = await page.evaluate(`
      (() => {
        const el = document.querySelector('.plan');
        if (!el) return 600;
        // Force layout, then read the integer layout height.
        void el.offsetHeight;
        return el.offsetHeight;
      })()
    `) as number;

    const heightPx = Math.max(600, Math.floor(Number(contentHeight) || 600));

    const pdf = await page.pdf({
      width: '1200px',
      height: `${heightPx}px`,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      preferCSSPageSize: false,
      pageRanges: '1',
      omitBackground: false,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
