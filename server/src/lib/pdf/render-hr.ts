import { getPdfBrowser } from './puppeteer-browser.js';
import { buildHrDocumentHtml, type HrPdfInput } from './hr-html.js';

/** A4 width in CSS px at 96dpi (210mm). */
const PAGE_WIDTH_PX = 794;

/**
 * Renders an HR document as a single A4 PDF page (or natural page breaks for long payslips).
 */
export async function renderHrDocumentPdf(input: HrPdfInput): Promise<Buffer> {
  const html = await buildHrDocumentHtml(input);
  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: PAGE_WIDTH_PX, height: 1123, deviceScaleFactor: 1 });
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

    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
