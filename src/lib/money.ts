import type { InvoiceItem } from "./store";

export function parseAmountNumber(amount: string | number | undefined | null): number {
  if (amount === undefined || amount === null) return 0;
  if (typeof amount === "number") return Number.isFinite(amount) ? amount : 0;
  const numeric = parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function deriveSubtotalFromTotal(total: number, taxRate: number): number {
  if (!taxRate) return total;
  const rate = taxRate / 100;
  // Invoices: amount is stored as "total due" (subtotal + tax). Convert back to subtotal.
  return rate ? total / (1 + rate) : total;
}

export function sumItems(items?: InvoiceItem[]): number {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export interface DocTotals {
  subtotal: number;
  tax: number;
  discountAmount: number;
  total: number;
  balanceDue: number;
  /** How many line items the discount applies to (for "N/M items" labels). */
  discountableCount: number;
  itemCount: number;
}

/**
 * Single source of truth for invoice/proforma totals on the client.
 * Mirrors the server's `computeInvoiceTotalsCents` exactly (integer-cent
 * arithmetic), so the total shown on screen always equals the stored amount:
 * tax on the full subtotal; discount restricted to `discountable` items
 * (default true) and capped at that base; fixed discounts in major units.
 */
export function computeDocTotals(input: {
  items?: InvoiceItem[];
  /** Fallback when there are no line items (amount is tax-inclusive). */
  amount?: string | number | null;
  taxRate?: number | null;
  discount?: number | null;
  discountType?: string | null;
  deposit?: number | null;
}): DocTotals {
  const items = input.items ?? [];
  const taxRate = input.taxRate ?? 0;
  const toCents = (n: number) => Math.round(n * 100);
  const itemCents = (it: InvoiceItem) => toCents(it.unitPrice) * it.quantity;

  const subtotalCents = items.length
    ? items.reduce((sum, it) => sum + itemCents(it), 0)
    : toCents(deriveSubtotalFromTotal(parseAmountNumber(input.amount), taxRate));
  const discountBaseCents = items.length
    ? items.reduce((sum, it) => (it.discountable !== false ? sum + itemCents(it) : sum), 0)
    : subtotalCents;

  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  const isPct = String(input.discountType || '').toLowerCase() === 'percentage';
  const discountCents = Math.min(
    isPct ? Math.round((discountBaseCents * (input.discount ?? 0)) / 100) : toCents(input.discount ?? 0),
    discountBaseCents
  );
  const totalCents = Math.max(0, subtotalCents + taxCents - discountCents);
  const depositCents = toCents(input.deposit ?? 0);

  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    discountAmount: discountCents / 100,
    total: totalCents / 100,
    balanceDue: (totalCents - depositCents) / 100,
    discountableCount: items.filter((it) => it.discountable !== false).length,
    itemCount: items.length,
  };
}

/** Strip HTML so rich-editor descriptions still match plain inventory names. */
function normalizeItemDescription(description: string): string {
  return description.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().toLowerCase();
}

/** Add an inventory line, or bump qty when the same item is already on the list. */
export function upsertInventoryLineItem(
  items: InvoiceItem[],
  description: string,
  unitPrice: number,
  quantity = 1,
): InvoiceItem[] {
  const target = normalizeItemDescription(description);
  if (!target) {
    return [...items, { description, quantity, unitPrice }];
  }

  const existingIndex = items.findIndex(
    (item) => normalizeItemDescription(item.description) === target,
  );

  if (existingIndex >= 0) {
    return items.map((item, i) =>
      i === existingIndex
        ? { ...item, quantity: item.quantity + quantity }
        : item,
    );
  }

  return [...items, { description, quantity, unitPrice }];
}

