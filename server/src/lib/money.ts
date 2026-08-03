/**
 * Money helpers — DB stores monetary amounts as integer cents.
 * Display / email / PDF should convert via these helpers.
 */

/** Convert cents → major currency units (e.g. 1999 → 19.99). */
export function centsToMajor(cents: number | null | undefined): number {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 0;
  return cents / 100;
}

/** Convert major units → cents (e.g. 19.99 → 1999). */
export function dollarsToCents(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Format cents as a currency string for emails / logs. */
export function formatCents(
  cents: number | null | undefined,
  currency = 'USD',
  locale = 'en-US'
): string {
  const major = centsToMajor(cents);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/** Format already-major amounts (e.g. after centsToMajor). */
export function formatMajor(
  amount: number | null | undefined,
  currency = 'USD',
  locale = 'en-US'
): string {
  const n = amount === null || amount === undefined || !Number.isFinite(amount) ? 0 : amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function sumItemCents(
  items: Array<{ quantity: number; unitPrice: number }> | null | undefined
): number {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/** Derive pre-tax subtotal (cents) from a tax-inclusive total (cents). */
export function deriveSubtotalCentsFromTotal(totalCents: number, taxRatePercent: number): number {
  if (!taxRatePercent) return totalCents;
  const rate = taxRatePercent / 100;
  return rate ? Math.round(totalCents / (1 + rate)) : totalCents;
}

export function computeInvoiceTotalsCents(input: {
  items?: Array<{ quantity: number; unitPrice: number }> | null;
  amountCents?: number | null;
  taxRate?: number | null;
  /** Fixed discount is in major units (dollars); percentage is 0–100. */
  discount?: number | null;
  discountType?: string | null;
  depositCents?: number | null;
}): {
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  balanceDueCents: number;
} {
  const taxRate = input.taxRate ?? 0;
  const discount = input.discount ?? 0;
  const depositCents = input.depositCents ?? 0;
  const fromItems = sumItemCents(input.items);
  const subtotalCents = fromItems
    ? fromItems
    : deriveSubtotalCentsFromTotal(input.amountCents ?? 0, taxRate);
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  const isPct = String(input.discountType || '').toUpperCase() === 'PERCENTAGE';
  const discountCents = isPct
    ? Math.round((subtotalCents * discount) / 100)
    : dollarsToCents(discount);
  const totalCents = subtotalCents + taxCents - discountCents;
  return {
    subtotalCents,
    taxCents,
    discountCents,
    totalCents,
    balanceDueCents: totalCents - depositCents,
  };
}
