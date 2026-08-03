import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import sanitizeHtml from 'sanitize-html';
import { resolveAssetUrl } from './content-plan-html.js';
import { getShortVerificationUrl } from '../short-url.js';
import {
  centsToMajor,
  computeInvoiceTotalsCents,
  formatMajor,
} from '../money.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const INVOICE_TEMPLATE_DIR = path.resolve(__dirname, '../../../templates/invoice');

export type InvoicePdfItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoicePdfAgency = {
  agencyName?: string | null;
  logo?: string | null;
  address?: string | null;
  adminEmail?: string | null;
  phone?: string | null;
  website?: string | null;
  defaultInvoiceNotes?: string | null;
  currency?: string | null;
  timezone?: string | null;
  primaryColor?: string | null;
  signature?: string | null;
  stamp?: string | null;
};

export type InvoicePdfInput = {
  type: 'Invoice' | 'Proforma';
  id: string;
  date: string | Date;
  dueDate: string | Date;
  client: string;
  clientEmail?: string | null;
  clientAddress?: string | null;
  items?: InvoicePdfItem[] | null;
  notes?: string | null;
  taxRate?: number | null;
  discount?: number | null;
  discountType?: string | null;
  deposit?: number | null;
  paymentMethod?: string | null;
  amount?: number | string | null;
  status?: string | null;
  showSignature?: boolean | null;
  showStamp?: boolean | null;
  deliveryNoteEnabled?: boolean | null;
  deliveryNoteTitle?: string | null;
  deliveryNoteContent?: string | null;
  agency: InvoicePdfAgency;
  verificationToken?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'div', 'span'],
    allowedAttributes: { '*': ['style'] },
  });
}

function parseAmountNumber(amount: string | number | null | undefined): number {
  if (amount === undefined || amount === null) return 0;
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0;
  const numeric = parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(date: string | Date, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeZone: timezone || 'UTC',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function isPercentageDiscount(discountType: string | null | undefined): boolean {
  return String(discountType || '').toUpperCase() === 'PERCENTAGE';
}

function iconPhone(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
}

function iconEmail(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.53 5.33a2 2 0 0 1-2.94 0L2 7"/></svg>`;
}

function iconWeb(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
}

export async function buildInvoiceHtml(input: InvoicePdfInput): Promise<string> {
  const cssPath = path.join(INVOICE_TEMPLATE_DIR, 'pdf.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const agency = input.agency || {};
  const primary = agency.primaryColor || '#504188';
  const agencyName = agency.agencyName || 'Hirdan Marketing';
  const currency = agency.currency || 'USD';
  const timezone = agency.timezone || 'UTC';
  const logoUrl = resolveAssetUrl(agency.logo);
  const signatureUrl = resolveAssetUrl(agency.signature);
  const stampUrl = resolveAssetUrl(agency.stamp);
  const website = (agency.website || '').replace(/^https?:\/\//i, '');

  const showSignature = input.showSignature ?? true;
  const showStamp = input.showStamp ?? true;
  const taxRate = input.taxRate ?? 0;
  const discount = input.discount ?? 0;
  const depositCents = input.deposit ?? 0;

  const totals = computeInvoiceTotalsCents({
    items: input.items,
    amountCents: parseAmountNumber(input.amount ?? 0),
    taxRate,
    discount,
    discountType: input.discountType,
    depositCents,
  });

  const subtotal = centsToMajor(totals.subtotalCents);
  const tax = centsToMajor(totals.taxCents);
  const discountAmount = centsToMajor(totals.discountCents);
  const total = centsToMajor(totals.totalCents);
  const deposit = centsToMajor(depositCents);
  const balanceDue = centsToMajor(totals.balanceDueCents);

  const itemsForTable =
    input.items?.length
      ? input.items.map((item) => ({
          ...item,
          unitPrice: centsToMajor(item.unitPrice),
        }))
      : [{ description: 'Services rendered', quantity: 1, unitPrice: subtotal }];

  const cleanedNotes = input.notes
    ? input.notes.replace(/(?:\r?\n)?\[Client\s+[^\]]+\]\s*:\s*"[\s\S]*?"/gi, '').trim()
    : '';

  const statusLabel =
    input.status ??
    (balanceDue <= 0 ? 'Full Paid' : deposit > 0 ? 'Partially Paid' : 'Pending');

  const verificationToken = input.verificationToken || '';
  const verificationUrl = verificationToken ? getShortVerificationUrl(verificationToken) : '';
  let qrDataUrl = '';
  if (verificationUrl) {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: primary, light: '#ffffff' },
    });
  }

  const watermark = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" />`
    : `<div class="watermark-text">${escapeHtml(agencyName)}</div>`;

  const logoBlock = logoUrl
    ? `<img class="header__logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(agencyName)}" />`
    : `<div class="header__agency-name">${escapeHtml(agencyName)}</div>`;

  const itemRows = itemsForTable
    .map(
      (item) => `
      <tr>
        <td class="desc">${sanitizeRichHtml(item.description || '')}</td>
        <td class="qty">${item.quantity}</td>
        <td class="rate">${escapeHtml(formatMajor(item.unitPrice, currency, 'en-DJ'))}</td>
        <td class="amount">${escapeHtml(formatMajor(item.quantity * item.unitPrice, currency, 'en-DJ'))}</td>
      </tr>`
    )
    .join('');

  const deliveryNote =
    input.deliveryNoteEnabled && (input.deliveryNoteTitle || input.deliveryNoteContent)
      ? `
      <section class="delivery">
        <div class="delivery__ornament"></div>
        <div class="delivery__inner">
          <div class="delivery__title-row">
            <div class="billed__rule"></div>
            ${
              input.deliveryNoteTitle
                ? `<div class="delivery__title">${escapeHtml(input.deliveryNoteTitle)}</div>`
                : ''
            }
          </div>
          ${
            input.deliveryNoteContent
              ? `<div class="delivery__content">${sanitizeRichHtml(input.deliveryNoteContent)}</div>`
              : ''
          }
        </div>
      </section>`
      : '';

  const taxRow =
    taxRate > 0
      ? `<div class="totals__row"><span class="totals__label">TVA (${taxRate}%)</span><span class="totals__value">${escapeHtml(formatMajor(tax, currency, 'en-DJ'))}</span></div>`
      : '';

  const discountRow =
    discountAmount > 0
      ? `<div class="totals__row"><span class="totals__label">Discount ${
          isPercentageDiscount(input.discountType) ? `(${discount}%)` : ''
        }</span><span class="totals__value totals__value--discount">-${escapeHtml(formatMajor(discountAmount, currency, 'en-DJ'))}</span></div>`
      : '';

  const depositRow =
    deposit > 0
      ? `<div class="totals__row"><span class="totals__label">Deposit / Paid</span><span class="totals__value totals__value--deposit">-${escapeHtml(formatMajor(deposit, currency, 'en-DJ'))}</span></div>`
      : '';

  const signatureBlock =
    showSignature || showStamp
      ? `
      <div class="sign">
        <div class="sign__box">
          <div class="sign__line"></div>
          ${
            showSignature && signatureUrl
              ? `<div class="sign__signature"><img src="${escapeHtml(signatureUrl)}" alt="Signature" /></div>`
              : ''
          }
          ${
            showStamp && stampUrl
              ? `<div class="sign__stamp"><img src="${escapeHtml(stampUrl)}" alt="Stamp" /></div>`
              : ''
          }
        </div>
        <div class="sign__caption">Authorized Signature</div>
      </div>`
      : '';

  const contacts: string[] = [];
  if (agency.phone) {
    contacts.push(
      `<div class="footer__item">${iconPhone()}<span>${escapeHtml(agency.phone)}</span></div>`
    );
  }
  if (agency.adminEmail) {
    contacts.push(
      `<div class="footer__item">${iconEmail()}<span>${escapeHtml(agency.adminEmail)}</span></div>`
    );
  }
  if (website) {
    contacts.push(
      `<div class="footer__item footer__item--accent">${iconWeb()}<span>${escapeHtml(website)}</span></div>`
    );
  }

  const docLabel = input.type === 'Invoice' ? 'Invoice' : 'Proforma';
  const noLabel = input.type === 'Invoice' ? 'Invoice No.' : 'Proforma No.';
  const notesText = (
    cleanedNotes ||
    agency.defaultInvoiceNotes ||
    'Bank Transfer, Credit Card. Please make payment by the due date. Thank you for your business!'
  ).trim();

  const addressHtml = input.clientAddress?.trim()
    ? `<div class="billed__address">${escapeHtml(input.clientAddress.trim())}</div>`
    : '';
  const emailHtml = input.clientEmail?.trim()
    ? `<div class="billed__email">${escapeHtml(input.clientEmail.trim())}</div>`
    : '';
  const paidViaHtml = input.paymentMethod?.trim()
    ? `<div class="notes__paid-via">Paid via: ${escapeHtml(input.paymentMethod.trim())}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docLabel)} ${escapeHtml(input.id)}</title>
  <style>${css}</style>
</head>
<body style="--primary:${escapeHtml(primary)}">
  <div class="doc" id="doc">
    <div class="sheet" data-sheet-template="1">
      <div class="sheet-header">
        <div class="top-bar">
          <div class="top-bar__primary"></div>
          <div class="top-bar__accent"></div>
        </div>
        <div class="sheet-header__body">
          <header class="header">
            <div class="header__left">
              ${logoBlock}
              <div class="header__address">${agency.address ? escapeHtml(agency.address) : ''}</div>
            </div>
            <div class="header__right">
              <div class="header__title">${escapeHtml(docLabel)}</div>
              <div class="meta-row">
                <div>
                  <div class="meta-item__label">${escapeHtml(noLabel)}</div>
                  <div class="meta-item__value meta-item__value--primary">${escapeHtml(input.id)}</div>
                </div>
                <div>
                  <div class="meta-item__label">Date Issued</div>
                  <div class="meta-item__value">${escapeHtml(formatDate(input.date, timezone))}</div>
                </div>
                <div>
                  <div class="meta-item__label">Due Date</div>
                  <div class="meta-item__value">${escapeHtml(formatDate(input.dueDate, timezone))}</div>
                </div>
              </div>
            </div>
          </header>

          <section class="billed">
            <div class="billed__card">
              <div class="billed__ornament"></div>
              <div class="billed__inner">
                <div class="billed__label-row">
                  <div class="billed__rule"></div>
                  <div class="billed__label">Billed To</div>
                </div>
                <div class="billed__name">${escapeHtml(input.client)}</div>
                ${addressHtml}${emailHtml}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="sheet-main">
        <div class="watermark">${watermark}</div>
        <table class="items" id="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="qty">Qty</th>
              <th class="rate">Rate</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody id="items-body">${itemRows}</tbody>
        </table>

        ${deliveryNote}

        <section class="bottom" id="closing-block">
          <div class="notes">
            <div class="notes__card">
              <div class="notes__icon">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <div class="notes__title"><div class="notes__swatch"></div>Payment Methods &amp; Conditions</div>
              <div class="notes__body">${escapeHtml(notesText)}${paidViaHtml}</div>
              <div class="notes__status">Status: ${escapeHtml(String(statusLabel))} • ${escapeHtml(docLabel)}: ${escapeHtml(input.id)}</div>
            </div>
          </div>

          <div class="totals-col">
            <div class="totals">
              <div class="totals__rows">
                <div class="totals__row"><span class="totals__label">Subtotal</span><span class="totals__value">${escapeHtml(formatMajor(subtotal, currency, 'en-DJ'))}</span></div>
                ${taxRow}
                ${discountRow}
                ${depositRow}
              </div>
              <div class="totals__due">
                <div class="totals__due-label">${balanceDue <= 0 ? 'Total<br />Paid' : 'Balance<br />Due'}</div>
                <span class="totals__due-amount">${escapeHtml(formatMajor(balanceDue, currency, 'en-DJ'))}</span>
              </div>
            </div>
            ${signatureBlock}
          </div>
        </section>
      </div>

      <footer class="footer">
        <div class="footer__accent"></div>
        <div class="footer__row">
          <div class="footer__left">
            ${
              qrDataUrl
                ? `<div class="footer__qr"><img src="${qrDataUrl}" alt="Verification QR" /></div>`
                : ''
            }
            <div class="footer__verified-wrap">
              <div class="footer__verified">Verified Original</div>
              <div class="footer__verified-sub">Secure Digital Verification</div>
            </div>
          </div>
          <div class="footer__right">
            <div class="footer__thanks">Thank You For Your Business</div>
            <div class="footer__contacts">${contacts.join('')}</div>
            <div class="footer__tagline">Empowering your brand's future through strategic digital growth</div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</body>
</html>`;
}
