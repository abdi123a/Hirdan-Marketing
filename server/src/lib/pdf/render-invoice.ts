import { getPdfBrowser } from './puppeteer-browser.js';
import { buildInvoiceHtml, type InvoicePdfInput } from './invoice-html.js';

/** A4 width in CSS px at 96dpi (210mm). */
const PAGE_WIDTH_PX = 794;

/**
 * Renders invoice/proforma as true A4 PDF pages.
 * Every sheet gets the full header (logo, billed-to, meta) and footer.
 * Line items are packed across sheets; Payment / Totals / Signature sit on
 * the last sheet just above the footer.
 */
export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const html = await buildInvoiceHtml(input);
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
    await page.evaluate(`(() => {
      const a4Px = Math.round((297 * 96) / 25.4);
      const doc = document.getElementById('doc');
      const template = doc && doc.querySelector('.sheet');
      if (!doc || !template) return;

      const header = template.querySelector('.sheet-header');
      const footer = template.querySelector('.footer');
      const main = template.querySelector('.sheet-main');
      const table = template.querySelector('.items');
      const tbody = template.querySelector('#items-body');
      const thead = table && table.querySelector('thead');
      const closing = template.querySelector('#closing-block');
      const delivery = template.querySelector('.delivery');
      if (!header || !footer || !main || !table || !tbody || !thead) return;

      const footerH = Math.ceil(footer.getBoundingClientRect().height);
      const headerH = Math.ceil(header.getBoundingClientRect().height);
      const mainPadTop = 16;
      const mainPadBottom = footerH + 16;
      main.style.paddingBottom = mainPadBottom + 'px';
      void main.offsetHeight;

      const available = a4Px - headerH - mainPadTop - mainPadBottom;
      const rowEls = Array.from(tbody.querySelectorAll('tr'));
      const rowHeights = rowEls.map((tr) => Math.max(1, Math.ceil(tr.getBoundingClientRect().height)));
      const theadH = Math.ceil(thead.getBoundingClientRect().height);
      const closingH = closing ? Math.ceil(closing.getBoundingClientRect().height) + 12 : 0;
      const deliveryH = delivery ? Math.ceil(delivery.getBoundingClientRect().height) + 16 : 0;
      const lastExtras = deliveryH + closingH;

      const chunkHeight = (start, end, withLastExtras) => {
        let used = theadH;
        for (let i = start; i < end; i++) used += rowHeights[i];
        if (withLastExtras) used += lastExtras;
        return used;
      };

      const pages = [];
      let i = 0;
      const n = rowEls.length;
      while (i < n) {
        let j = i;
        let used = theadH;
        while (j < n) {
          const rowH = rowHeights[j];
          const isLastRow = j + 1 === n;
          const extra = isLastRow ? lastExtras : 0;
          if (j > i && used + rowH + extra > available) break;
          if (j === i && isLastRow && used + rowH + extra > available) {
            // Row fits alone but not with closing — leave closing for the next sheet.
            used += rowH;
            j += 1;
            break;
          }
          if (j === i && used + rowH > available) {
            j += 1; // pathological tall row: place alone
            break;
          }
          used += rowH;
          j += 1;
        }
        if (j === i) j = i + 1;
        pages.push({ start: i, end: j });
        i = j;
      }

      if (pages.length === 0) pages.push({ start: 0, end: 0 });

      const last = pages[pages.length - 1];
      if (closing && chunkHeight(last.start, last.end, true) > available + 0.5) {
        pages.push({ start: last.end, end: last.end });
      }

      const headerHtml = header.outerHTML;
      const footerHtml = footer.outerHTML;
      const theadHtml = thead.outerHTML;
      const closingHtml = closing ? closing.outerHTML : '';
      const deliveryHtml = delivery ? delivery.outerHTML : '';
      const watermarkNode = main.querySelector('.watermark');
      const watermarkHtml = watermarkNode ? watermarkNode.outerHTML : '';

      doc.innerHTML = pages
        .map((range, pageIndex) => {
          const isLast = pageIndex === pages.length - 1;
          const rowsHtml = rowEls
            .slice(range.start, range.end)
            .map((tr) => tr.outerHTML)
            .join('');
          const hasRows = range.end > range.start;
          const tableBlock = hasRows
            ? '<table class="items">' + theadHtml + '<tbody>' + rowsHtml + '</tbody></table>'
            : '';
          return (
            '<div class="sheet' +
            (isLast ? ' sheet--last' : '') +
            '">' +
            headerHtml +
            '<div class="sheet-main" style="padding-bottom:' +
            mainPadBottom +
            'px">' +
            watermarkHtml +
            tableBlock +
            (isLast ? deliveryHtml + closingHtml : '') +
            '</div>' +
            footerHtml +
            '</div>'
          );
        })
        .join('');
    })()`);

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
