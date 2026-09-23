import { describe, it, expect } from 'vitest';
import { billingDateInMonth, dueBillingPeriod, recurringPeriodKey } from './billing-period.js';

const d = (s: string) => new Date(s);

describe('billingDateInMonth', () => {
  it('clamps day 31 to the last day of February', () => {
    expect(billingDateInMonth(2026, 1, 31).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(billingDateInMonth(2028, 1, 31).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
  it('keeps valid days and floors bad input to 1', () => {
    expect(billingDateInMonth(2026, 8, 15).toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(billingDateInMonth(2026, 8, 0).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('dueBillingPeriod', () => {
  const monthly = { billingCycle: 'MONTHLY', startDate: d('2026-01-01'), endDate: null };

  it('is due on the billing day and any later day of the month (catch-up)', () => {
    expect(dueBillingPeriod(monthly, 10, d('2026-09-09T23:00Z'))).toBeNull();
    expect(dueBillingPeriod(monthly, 10, d('2026-09-10T00:00Z'))?.billingPeriod).toBe('2026-09');
    expect(dueBillingPeriod(monthly, 10, d('2026-09-28T12:00Z'))?.billingPeriod).toBe('2026-09');
  });

  it('handles month-end targets in short months', () => {
    expect(dueBillingPeriod(monthly, 31, d('2026-02-27T12:00Z'))).toBeNull();
    expect(dueBillingPeriod(monthly, 31, d('2026-02-28T00:00Z'))?.billingPeriod).toBe('2026-02');
  });

  it('bills quarterly subscriptions only in cycle months anchored on start', () => {
    const q = { billingCycle: 'QUARTERLY', startDate: d('2026-02-15'), endDate: null };
    expect(dueBillingPeriod(q, 1, d('2026-02-20'))?.billingPeriod).toBe('2026-02');
    // March and April still belong to the Feb period
    expect(dueBillingPeriod(q, 1, d('2026-03-05'))?.billingPeriod).toBe('2026-02');
    expect(dueBillingPeriod(q, 1, d('2026-04-30'))?.billingPeriod).toBe('2026-02');
    expect(dueBillingPeriod(q, 1, d('2026-05-01'))?.billingPeriod).toBe('2026-05');
  });

  it('bills annual subscriptions once a year', () => {
    const a = { billingCycle: 'ANNUAL', startDate: d('2025-11-03'), endDate: null };
    expect(dueBillingPeriod(a, 3, d('2026-09-23'))?.billingPeriod).toBe('2025-11');
    // In the renewal month but before the billing day: nothing new is due yet
    expect(dueBillingPeriod(a, 3, d('2026-11-02'))).toBeNull();
    expect(dueBillingPeriod(a, 3, d('2026-11-03'))?.billingPeriod).toBe('2026-11');
  });

  it('does not bill before the start date', () => {
    const s = { billingCycle: 'MONTHLY', startDate: d('2026-09-20'), endDate: null };
    expect(dueBillingPeriod(s, 1, d('2026-09-19'))).toBeNull();
    const first = dueBillingPeriod(s, 1, d('2026-09-20T01:00Z'));
    expect(first?.billingPeriod).toBe('2026-09');
    expect(first?.billingDate.toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  it('does not bill periods starting on/after the end date', () => {
    const e = { billingCycle: 'MONTHLY', startDate: d('2026-01-01'), endDate: d('2026-09-01') };
    expect(dueBillingPeriod(e, 1, d('2026-09-05'))).toBeNull();
    const e2 = { ...e, endDate: d('2026-09-15') };
    expect(dueBillingPeriod(e2, 1, d('2026-09-05'))?.billingPeriod).toBe('2026-09');
  });
});

describe('recurringPeriodKey', () => {
  const at = d('2026-09-23T10:00Z');
  it('keys by frequency', () => {
    expect(recurringPeriodKey('MONTHLY', at)).toBe('2026-09');
    expect(recurringPeriodKey('YEARLY', at)).toBe('2026');
    expect(recurringPeriodKey('DAILY', at)).toBe('2026-09-23');
    expect(recurringPeriodKey('WEEKLY', at)).toBe('2026-W39');
    expect(recurringPeriodKey('ON_DEMAND', at)).toBeNull();
  });
  it('uses ISO week-years at year boundaries', () => {
    expect(recurringPeriodKey('WEEKLY', d('2027-01-01T00:00Z'))).toBe('2026-W53');
    expect(recurringPeriodKey('WEEKLY', d('2025-12-29T00:00Z'))).toBe('2026-W01');
  });
});
