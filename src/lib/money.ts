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

