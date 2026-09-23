/**
 * Pure date helpers for subscription billing and recurring-expense posting.
 * Everything is computed in UTC so results do not depend on the server's TZ
 * (dates such as "2026-09-01" are stored as UTC midnight).
 */

export type BillingCycleName = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export const CYCLE_MONTHS: Record<BillingCycleName, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
};

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

function monthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** "YYYY-MM" key of a calendar month (UTC). */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/**
 * The given day of a month as UTC midnight, clamped to the month's last day
 * (target 31 in February → 28/29).
 */
export function billingDateInMonth(year: number, month0: number, targetDay: number): Date {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Math.trunc(targetDay) || 1), lastDay);
  return new Date(Date.UTC(year, month0, day));
}

export interface BillableSubscription {
  billingCycle: BillingCycleName | string;
  startDate: Date;
  endDate: Date | null;
  /**
   * "YYYY-MM" key of the first period that may be auto-billed (periods with a
   * smaller key are never billed). Null/undefined for rows created before the
   * column existed: the caller then derives it from createdAt via
   * firstAutoBillingPeriod().
   */
  firstBillingPeriod?: string | null;
}

export interface DueBillingPeriod {
  /** "YYYY-MM" of the first month of the billing period — the idempotency key. */
  billingPeriod: string;
  periodStart: Date;
  billingDate: Date;
  cycleMonths: number;
}

/**
 * The billing period that should be invoiced as of `now`, or null when nothing
 * is due. Periods are anchored on the subscription's start month and repeat
 * every 1/3/12 months according to the billing cycle. The current period is
 * due once `now` reaches its billing day (client's invoice day, clamped to
 * month end, never before the start date) — so a run that missed the exact
 * day still catches up later in the period. Older periods are never
 * back-billed. The caller must still check the period has not been billed.
 */
export function dueBillingPeriod(
  sub: BillableSubscription,
  targetDay: number,
  now: Date,
): DueBillingPeriod | null {
  if (sub.startDate.getTime() > now.getTime()) return null;

  const cycleMonths = CYCLE_MONTHS[sub.billingCycle as BillingCycleName] ?? 1;
  const startMi = monthIndex(sub.startDate);
  const elapsed = monthIndex(now) - startMi;
  if (elapsed < 0) return null;

  const periodMi = startMi + Math.floor(elapsed / cycleMonths) * cycleMonths;
  const year = Math.floor(periodMi / 12);
  const month0 = periodMi % 12;
  const periodStart = new Date(Date.UTC(year, month0, 1));

  if (sub.endDate && sub.endDate.getTime() <= periodStart.getTime()) return null;

  const billingPeriod = `${year}-${pad(month0 + 1)}`;
  if (sub.firstBillingPeriod && billingPeriod < sub.firstBillingPeriod) return null;

  let billingDate = billingDateInMonth(year, month0, targetDay);
  if (billingDate.getTime() < sub.startDate.getTime()) billingDate = sub.startDate;
  if (now.getTime() < billingDate.getTime()) return null;

  return { billingPeriod, periodStart, billingDate, cycleMonths };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Key of the first billing period a subscription may be auto-billed for,
 * decided once when the subscription is created.
 *
 * Default: the first period that starts on/after the day the subscription was
 * created (date-level, UTC). A period "starts" on the 1st of its first month,
 * except the very first period, which starts on the start date. So a
 * subscription back-dated into a running period (e.g. ANNUAL from 2025-11-03
 * entered in 2026-09) is first billed at its next renewal (2026-11), not
 * immediately for a period that began long ago. The first period gets one day
 * of grace because a date-only "today" start date can be a day behind UTC.
 *
 * `billCurrentPeriod` (admin opt-in): also bill the period running at creation.
 */
export function firstAutoBillingPeriod(
  sub: Pick<BillableSubscription, 'billingCycle' | 'startDate'>,
  createdAt: Date,
  billCurrentPeriod = false,
): string {
  const cycleMonths = CYCLE_MONTHS[sub.billingCycle as BillingCycleName] ?? 1;
  const startMi = monthIndex(sub.startDate);
  const keyOf = (mi: number) => `${Math.floor(mi / 12)}-${pad((mi % 12) + 1)}`;

  const createdDay = utcDay(createdAt);
  // Start date on/after creation (future start, or "today" ±1 day): first period.
  if (utcDay(sub.startDate) >= createdDay - DAY_MS) return keyOf(startMi);

  // Period running on the creation day.
  const elapsed = monthIndex(createdAt) - startMi;
  const currentMi = startMi + Math.floor(elapsed / cycleMonths) * cycleMonths;
  if (billCurrentPeriod) return keyOf(currentMi);

  // Current period's effective start: its 1st day, or the start date for the first one.
  const currentStart = currentMi === startMi ? utcDay(sub.startDate) : Date.UTC(Math.floor(currentMi / 12), currentMi % 12, 1);
  return keyOf(currentStart >= createdDay ? currentMi : currentMi + cycleMonths);
}

/** ISO-8601 week key, e.g. "2026-W39". */
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7; // Mon=1..Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // Thursday of this week decides the year
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

/**
 * Period key a recurring-expense template covers on `date`. Posting the same
 * template twice with the same key is rejected by a unique index. ON_DEMAND
 * (and unknown) templates have no period and may be posted any number of times.
 */
export function recurringPeriodKey(frequency: string, date: Date): string | null {
  switch (frequency) {
    case 'DAILY':
      return `${monthKey(date)}-${pad(date.getUTCDate())}`;
    case 'WEEKLY':
      return isoWeekKey(date);
    case 'MONTHLY':
      return monthKey(date);
    case 'YEARLY':
      return String(date.getUTCFullYear());
    default:
      return null;
  }
}
