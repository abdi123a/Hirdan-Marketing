// Puppeteer renderer for the monthly social performance report.
//
// Mirrors render-invoice.ts, minus its pagination pass: report slides are a
// fixed 1920x1080 each, so one CSS page per slide is all that's needed.

import { getPdfBrowser } from './puppeteer-browser.js';
import { SLIDE_W, SLIDE_H } from './social-report/render-kit.js';

export async function renderSocialReportPdf(html: string): Promise<Buffer> {
  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 1 });

    await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });

    // Images are inlined as data URIs, but post thumbnails may still be decoding.
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

    // The design leans on Archivo's weights, and setContent's 'load' resolves
    // before the webfont has swapped in — snapshotting then silently renders
    // (and embeds) the fallback face instead. `fonts.ready` alone isn't enough
    // either: it only settles the faces laid out so far, so faces used further
    // down a 21-slide document can still be pending. Every declared face is
    // therefore loaded explicitly. Bounded, so an offline host still exports —
    // with fallback type rather than no PDF at all.
    await page.evaluate(`
      (async () => {
        if (!document.fonts) return;
        const all = Promise.all(
          Array.from(document.fonts).map((f) => f.load().catch(() => undefined))
        ).then(() => document.fonts.ready);
        await Promise.race([
          all,
          new Promise((resolve) => setTimeout(resolve, 30000)),
        ]);
      })()
    `);

    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      width: `${SLIDE_W / 96}in`,
      height: `${SLIDE_H / 96}in`,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
