/**
 * Pure helpers shared by the financial reports and expense summaries.
 * Amounts are integer cents throughout (the DB unit); API *inputs* for
 * expenses/deposits/transfers are whole currency units and are converted by
 * the routes before reaching these helpers.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidDateError extends Error {}

function parseDate(value: string): Date {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new InvalidDateError('Invalid date format. Use YYYY-MM-DD.');
  return d;
}

/**
 * Exclusive upper bound for an inclusive "to"/"asOf" parameter.
 * "2026-09-30" → 2026-10-01T00:00Z, so the whole last day is included
 * (query with `lt`). A full timestamp is treated as an inclusive instant.
 */
export function exclusiveEnd(value: string): Date {
  const d = parseDate(value);
  return new Date(d.getTime() + (DATE_ONLY.test(value) ? DAY_MS : 1));
}

export interface ReportRange {
  fromDate: Date;
  /** Exclusive end — use `lt`. */
  toExclusive: Date;
  /** Inclusive last day, for display ("YYYY-MM-DD"). */
  toLabel: string;
}

/**
 * Parse ?from=&to= (inclusive days). Defaults: start of the current year
 * through the end of the current month (UTC).
 */
export function parseReportRange(from: unknown, to: unknown, now: Date = new Date()): ReportRange {
  const fromDate = typeof from === 'string' && from
    ? parseDate(from)
    : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const toExclusive = typeof to === 'string' && to
    ? exclusiveEnd(to)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (toExclusive.getTime() <= fromDate.getTime()) {
    throw new InvalidDateError('"from" must not be after "to".');
  }
  const toLabel = new Date(toExclusive.getTime() - 1).toISOString().split('T')[0];
  return { fromDate, toExclusive, toLabel };
}

/** Months between two instants using the average month length (≥ 0). */
export function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS / 30.44);
}

/**
 * Straight-line depreciation accumulated on one purchase by `asOf`,
 * `monthlyRate` of cost per month since the purchase date, capped at cost.
 */
export function straightLineDepreciation(
  cost: number,
  purchaseDate: Date,
  asOf: Date,
  monthlyRate = 0.01,
): number {
  const raw = cost * monthlyRate * monthsBetween(purchaseDate, asOf);
  return Math.round(Math.min(cost, raw));
}

/** Marker deposit-sync writes into invoice-payment deposits: "(ID: <invoice uuid>)". */
const INVOICE_MARKER = /\(ID: ([0-9a-fA-F-]{36})\)/;

export interface DepositLike {
  category: string;
  description: string | null;
  /** Present once deposits carry a real FK to their invoice. */
  invoiceId?: string | null;
}

/** Invoice id an auto-synced invoice-payment deposit belongs to, or null. */
export function invoiceIdOfDeposit(d: DepositLike): string | null {
  if (d.invoiceId) return d.invoiceId;
  if (d.category !== 'REVENUE' || !d.description) return null;
  return INVOICE_MARKER.exec(d.description)?.[1] ?? null;
}

/** Add `amount` to `map[key]`. */
export function addTo(map: Record<string, number>, key: string, amount: number): void {
  map[key] = (map[key] ?? 0) + amount;
}
