/**
 * Format integer cents in an account's own currency (accounts can hold
 * currencies other than the agency's base currency, so the global
 * formatCurrency() is not appropriate for them).
 */
export function formatAccountAmount(cents: number, currency: string): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    // Unknown/invalid ISO code: fall back to "CODE 1,234.50"
    return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/** Currency codes offered when creating an account (any stored code is kept on edit). */
export const ACCOUNT_CURRENCIES = ["USD", "EUR", "GBP", "AED", "DJF", "SAR", "ETB", "KES"];

/** Parse a whole-units money input ("1,250.50", "-20"); null when not a finite number. */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.replace(/,/g, "").trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
