import { getPdfBrowser } from './puppeteer-browser.js';

export type HtmlPagesPdfOptions = {
  pages: string[]; // each item is FULL HTML document or a body fragment
  /** CSS px width of one page */
  widthPx: number;
  /** CSS px height of one page */
  heightPx: number;
  /** Optional extra CSS injected into every page */
  extraCss?: string;
};

function isFullDocument(html: string): boolean {
  const trimmed = html.trimStart();
  return /^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}

function extractBodyInner(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

function buildCombinedHtml(opts: HtmlPagesPdfOptions): string {
  const { pages, widthPx, heightPx, extraCss } = opts;

  const sheets = pages
    .map((pageHtml) => {
      const inner = isFullDocument(pageHtml) ? extractBodyInner(pageHtml) : pageHtml;
      return (
        `<div class="sheet" style="width:${widthPx}px;height:${heightPx}px;overflow:hidden">` +
        inner +
        `</div>`
      );
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
@page { size: ${widthPx}px ${heightPx}px; margin: 0; }
.sheet {
  width: ${widthPx}px;
  height: ${heightPx}px;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}
${extraCss || ''}
</style>
</head>
<body>${sheets}</body>
</html>`;
}

/**
 * Renders one or more HTML pages into a single PDF via Puppeteer.
 * Pages are stacked in one document with CSS page breaks (no pdf-lib).
 */
export async function renderHtmlPagesPdf(opts: HtmlPagesPdfOptions): Promise<Buffer> {
  const widthPx = Math.max(1, opts.widthPx);
  const heightPx = Math.max(1, opts.heightPx);
  const html = buildCombinedHtml({ ...opts, widthPx, heightPx });

  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: Math.ceil(widthPx),
      height: Math.ceil(heightPx),
      deviceScaleFactor: 1,
    });
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 120_000,
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

    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      width: `${widthPx / 96}in`,
      height: `${heightPx / 96}in`,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
