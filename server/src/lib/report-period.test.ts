import { describe, it, expect } from 'vitest';
import {
  exclusiveEnd,
  parseReportRange,
  straightLineDepreciation,
  invoiceIdOfDeposit,
  InvalidDateError,
} from './report-period.js';

describe('parseReportRange', () => {
  it('includes the whole last day of a date-only "to"', () => {
    const r = parseReportRange('2026-09-01', '2026-09-30');
    expect(r.fromDate.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(r.toExclusive.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(r.toLabel).toBe('2026-09-30');
  });

  it('defaults to start of year through end of current month', () => {
    const r = parseReportRange(undefined, undefined, new Date('2026-02-10T12:00Z'));
    expect(r.fromDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.toExclusive.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(r.toLabel).toBe('2026-02-28');
  });

  it('rejects invalid or inverted ranges', () => {
    expect(() => parseReportRange('nope', undefined)).toThrow(InvalidDateError);
    expect(() => parseReportRange('2026-09-10', '2026-09-01')).toThrow(InvalidDateError);
  });

  it('treats full timestamps as inclusive instants', () => {
    expect(exclusiveEnd('2026-09-30T12:00:00.000Z').toISOString()).toBe('2026-09-30T12:00:00.001Z');
  });
});

describe('straightLineDepreciation', () => {
  it('depreciates from each purchase date and caps at cost', () => {
    const bought = new Date('2026-01-01T00:00Z');
    expect(straightLineDepreciation(100000, bought, bought)).toBe(0);
    const tenMonths = new Date(bought.getTime() + 10 * 30.44 * 86400000);
    expect(straightLineDepreciation(100000, bought, tenMonths)).toBe(10000);
    expect(straightLineDepreciation(100000, bought, new Date('2040-01-01'))).toBe(100000);
    // purchase after asOf → nothing
    expect(straightLineDepreciation(100000, new Date('2027-01-01'), bought)).toBe(0);
  });
});

describe('invoiceIdOfDeposit', () => {
  const id = '3f1c2b1e-9a7d-4c1e-8b2a-0e6f5d4c3b2a';
  it('reads the deposit-sync marker on REVENUE deposits', () => {
    expect(invoiceIdOfDeposit({ category: 'REVENUE', description: `Payment for Invoice INV-1 (ID: ${id})` })).toBe(id);
  });
  it('ignores manual deposits and other categories', () => {
    expect(invoiceIdOfDeposit({ category: 'REVENUE', description: 'Cash from client' })).toBeNull();
    expect(invoiceIdOfDeposit({ category: 'OTHER', description: `x (ID: ${id})` })).toBeNull();
  });
  it('prefers an explicit invoiceId', () => {
    expect(invoiceIdOfDeposit({ category: 'OTHER', description: null, invoiceId: id })).toBe(id);
  });
});
