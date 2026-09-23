import { describe, it, expect } from 'vitest';
import {
  changedFields,
  discountError,
  isAppendOnlyNotes,
  isClientProformaTransitionAllowed,
  normalizeItems,
  resolveInvoicePayment,
  resolveTotalCents,
} from './billing-rules.js';
import { computeInvoiceTotalsCents, deriveBaseSubtotalCents } from './money.js';
import { sanitizeRichHtml, cleanRichText } from './rich-text.js';

describe('rich text sanitization', () => {
  it('strips script-capable markup but keeps editor formatting', () => {
    const dirty = '<b>Bold</b> <u>u</u><img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:x">l</a>';
    const clean = sanitizeRichHtml(dirty);
    expect(clean).toContain('<b>Bold</b>');
    expect(clean).toContain('<u>u</u>');
    expect(clean).not.toMatch(/onerror|<script|<img|javascript:|<a /i);
  });

  it('leaves plain text untouched', () => {
    expect(cleanRichText('Design & build')).toBe('Design & build');
    expect(cleanRichText(null)).toBeNull();
  });

  it('sanitizes item descriptions on normalize', () => {
    const [item] = normalizeItems([{ description: '<p onclick="x()">Hi</p>', quantity: 1, unitPrice: 100 }])!;
    expect(item).toEqual({ description: '<p>Hi</p>', quantity: 1, unitPrice: 100, position: 0, discountable: true });
  });
});

describe('item-less totals', () => {
  it('derives the base without applying the discount twice', () => {
    // base 100.00, 10% tax, 10.00 fixed discount → stored total 100.00
    const stored = computeInvoiceTotalsCents({ baseSubtotalCents: 10000, taxRate: 10, discount: 10, discountType: 'FIXED' }).totalCents;
    expect(stored).toBe(10000);
    expect(deriveBaseSubtotalCents(stored, 10, 10, 'FIXED')).toBe(10000);
    const shown = computeInvoiceTotalsCents({ amountCents: stored, taxRate: 10, discount: 10, discountType: 'FIXED' });
    expect(shown).toMatchObject({ subtotalCents: 10000, taxCents: 1000, discountCents: 1000, totalCents: 10000 });
  });

  it('re-prices the existing base when tax changes instead of zeroing it', () => {
    const amount = resolveTotalCents({
      items: [],
      affectsTotal: true,
      current: { amount: 11000, taxRate: 10, discount: null, discountType: null },
      next: { taxRate: 20, discount: null, discountType: null },
    });
    expect(amount).toBe(12000);
  });

  it('keeps the stored amount when nothing affecting it changed', () => {
    const amount = resolveTotalCents({
      items: [{ quantity: 1, unitPrice: 999 }],
      affectsTotal: false,
      current: { amount: 1234, taxRate: null, discount: null, discountType: null },
      next: { taxRate: null, discount: null, discountType: null },
    });
    expect(amount).toBe(1234);
  });
});

describe('resolveInvoicePayment', () => {
  it('rejects a deposit above the total', () => {
    expect(resolveInvoicePayment({ amount: 100, deposit: 150, status: 'PENDING', financialChange: true }).ok).toBe(false);
  });

  it('derives the status from the money on create / financial edits', () => {
    expect(resolveInvoicePayment({ amount: 100, deposit: 100, status: 'PENDING', financialChange: true })).toMatchObject({ status: 'PAID' });
    expect(resolveInvoicePayment({ amount: 100, deposit: 40, status: 'PAID', financialChange: true })).toMatchObject({ status: 'PARTIALLY_PAID', deposit: 40 });
    expect(resolveInvoicePayment({ amount: 100, deposit: 0, status: 'PARTIALLY_PAID', financialChange: true }).ok).toBe(false);
  });

  it('records the full payment when a partially paid invoice is marked paid', () => {
    expect(
      resolveInvoicePayment({ amount: 100, deposit: 40, status: 'PAID', previousStatus: 'PARTIALLY_PAID', financialChange: false })
    ).toMatchObject({ ok: true, status: 'PAID', deposit: 100 });
  });

  it('clears the recorded full payment when un-paying', () => {
    expect(
      resolveInvoicePayment({ amount: 100, deposit: 100, status: 'PENDING', previousStatus: 'PAID', financialChange: false })
    ).toMatchObject({ ok: true, status: 'PENDING', deposit: null });
  });

  it('leaves stored state alone for non-financial edits', () => {
    expect(
      resolveInvoicePayment({ amount: 100, deposit: 40, status: 'PAID', previousStatus: 'PAID', financialChange: false })
    ).toMatchObject({ ok: true, status: 'PAID', deposit: 40 });
  });
});

describe('changedFields', () => {
  const current = {
    notes: 'a',
    taxRate: null,
    discount: null,
    deposit: null,
    date: new Date('2026-01-01T00:00:00.000Z'),
    invoiceNumber: 'INV-2026-00001',
  };
  const items = [{ description: 'x', quantity: 1, unitPrice: 100, position: 0, discountable: true }];

  it('ignores values that did not change', () => {
    expect(
      changedFields(
        {
          notes: 'a',
          taxRate: 0,
          deposit: undefined,
          date: '2026-01-01T00:00:00.000Z',
          invoiceNumber: 'INV-2026-00001',
          items: normalizeItems([{ description: 'x', quantity: 1, unitPrice: 100 }]),
        },
        current,
        items
      )
    ).toEqual([]);
  });

  it('reports real changes', () => {
    expect(
      changedFields(
        { notes: 'b', deposit: 5, items: normalizeItems([{ description: 'x', quantity: 2, unitPrice: 100 }]) },
        current,
        items
      )
    ).toEqual(['notes', 'deposit', 'items']);
  });
});

describe('small guards', () => {
  it('validates discounts', () => {
    expect(discountError(101, 'PERCENTAGE')).not.toBeNull();
    expect(discountError(-1, 'FIXED')).not.toBeNull();
    expect(discountError(150, 'FIXED')).toBeNull();
  });

  it('only lets clients append to notes', () => {
    expect(isAppendOnlyNotes('Terms', 'Terms\n[Client Approved - 1/1/2026]: "ok"')).toBe(true);
    expect(isAppendOnlyNotes('Terms', 'Something else')).toBe(false);
    expect(isAppendOnlyNotes(null, 'anything')).toBe(true);
  });

  it('limits client proforma transitions', () => {
    expect(isClientProformaTransitionAllowed('SENT', 'ACCEPTED')).toBe(true);
    expect(isClientProformaTransitionAllowed('SENT', 'DRAFT')).toBe(true);
    expect(isClientProformaTransitionAllowed('DRAFT', 'ACCEPTED')).toBe(false);
    expect(isClientProformaTransitionAllowed('ACCEPTED', 'SENT')).toBe(false);
    expect(isClientProformaTransitionAllowed('SENT', 'EXPIRED')).toBe(false);
  });
});
