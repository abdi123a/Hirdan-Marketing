import { describe, it, expect } from 'vitest';
import { parseMonthDay, resolveSequentialDates } from './import-utils.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const label = (d: Date) => `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

// Exactly what TikTok Studio writes: one year-less "Month D" label per day,
// oldest first, ending the day before the export.
const yearOfLabels = (lastDay: Date, days: number) =>
  Array.from({ length: days }, (_, i) => label(addDays(lastDay, i - (days - 1))));

describe('resolveSequentialDates', () => {
  const ref = new Date('2026-08-22T15:00:00Z');

  it('dates a 365-day export across the year boundary instead of folding its first days onto this week', () => {
    const last = new Date('2026-08-20T00:00:00Z');
    const cells = yearOfLabels(last, 365);
    const dates = resolveSequentialDates(cells, ref);

    expect(iso(dates[0])).toBe('2025-08-21');
    expect(iso(dates[364])).toBe('2026-08-20');
    // Contiguous, one day per row, no collisions.
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]!.getTime() - dates[i - 1]!.getTime()).toBe(86400000);
    }
    expect(new Set(dates.map(iso)).size).toBe(365);
  });

  it('is the documented failure mode of parseMonthDay that the sequence fixes', () => {
    // Cell-by-cell, the first rows of that same file land a year late — on the
    // current week and one of them tomorrow.
    expect(iso(parseMonthDay('August 21', ref))).toBe('2026-08-21');
    expect(iso(parseMonthDay('August 23', ref))).toBe('2026-08-23');
  });

  it('matches parseMonthDay for a short window entirely inside the current year', () => {
    const cells = ['August 15', 'August 16', 'August 17', 'August 18'];
    expect(resolveSequentialDates(cells, ref).map(iso)).toEqual(
      cells.map(c => iso(parseMonthDay(c, ref))),
    );
  });

  it('keeps repeated dates together (hourly activity rows) while still wrapping the year', () => {
    const cells = ['December 31', 'December 31', 'January 1', 'January 1'];
    expect(resolveSequentialDates(cells, ref).map(iso)).toEqual([
      '2025-12-31', '2025-12-31', '2026-01-01', '2026-01-01',
    ]);
  });

  it('handles a newest-first export the same way', () => {
    const last = new Date('2026-08-20T00:00:00Z');
    const cells = yearOfLabels(last, 365).reverse();
    const dates = resolveSequentialDates(cells, ref);
    expect(iso(dates[0])).toBe('2026-08-20');
    expect(iso(dates[364])).toBe('2025-08-21');
  });

  it('anchors a last row dated tomorrow to this year, like parseMonthDay does', () => {
    const cells = ['August 21', 'August 22', 'August 23'];
    expect(resolveSequentialDates(cells, ref).map(iso)).toEqual([
      '2026-08-21', '2026-08-22', '2026-08-23',
    ]);
  });

  it('passes through cells that already carry a year and nulls cells that do not parse', () => {
    const cells = ['2025-12-30', 'not a date', 'December 31', 'January 1', null];
    expect(resolveSequentialDates(cells, ref).map(iso)).toEqual([
      '2025-12-30', null, '2025-12-31', '2026-01-01', null,
    ]);
  });
});
