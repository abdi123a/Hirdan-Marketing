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

