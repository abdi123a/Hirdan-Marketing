import { describe, it, expect } from 'vitest';
import { matchManualDepositsToInvoices } from './manual-deposit-dedup.js';

const d = (s: string) => new Date(s);
const dep = (id: string, amount: number, date: string) => ({ id, amount, date: d(date) });
const inv = (id: string, paidAmount: number, date: string) => ({ id, paidAmount, date: d(date) });

describe('matchManualDepositsToInvoices', () => {
  it('matches same amount within ±7 days', () => {
    const m = matchManualDepositsToInvoices(
      [dep('d1', 50000, '2026-03-10')],
      [inv('i1', 50000, '2026-03-04')],
    );
    expect(m.get('d1')).toBe('i1');
  });

  it('ignores different amounts and dates outside the window', () => {
    const m = matchManualDepositsToInvoices(
      [dep('d1', 50000, '2026-03-10'), dep('d2', 50001, '2026-03-10')],
      [inv('i1', 50000, '2026-03-17T00:00:01Z')],
    );
    expect(m.size).toBe(0);
  });

  it('includes the window boundary (exactly 7 days)', () => {
    const m = matchManualDepositsToInvoices([dep('d1', 100, '2026-03-10')], [inv('i1', 100, '2026-03-17')]);
    expect(m.get('d1')).toBe('i1');
  });

  it('is 1:1 — one invoice absorbs at most one deposit', () => {
    const m = matchManualDepositsToInvoices(
      [dep('d1', 100, '2026-03-10'), dep('d2', 100, '2026-03-11')],
      [inv('i1', 100, '2026-03-10')],
    );
    expect(m.size).toBe(1);
    expect(m.get('d1')).toBe('i1');
    expect(m.has('d2')).toBe(false);
  });

  it('greedily picks the closest invoice so later deposits can still match', () => {
    const m = matchManualDepositsToInvoices(
      [dep('d1', 100, '2026-03-10'), dep('d2', 100, '2026-03-16')],
      [inv('far', 100, '2026-03-15'), inv('near', 100, '2026-03-09')],
    );
    expect(m.get('d1')).toBe('near');
    expect(m.get('d2')).toBe('far');
  });

  it('is independent of input order', () => {
    const deposits = [dep('b', 100, '2026-03-10'), dep('a', 100, '2026-03-10')];
    const invoices = [inv('i2', 100, '2026-03-12'), inv('i1', 100, '2026-03-08')];
    const m1 = matchManualDepositsToInvoices(deposits, invoices);
    const m2 = matchManualDepositsToInvoices([...deposits].reverse(), [...invoices].reverse());
    expect([...m1.entries()].sort()).toEqual([...m2.entries()].sort());
    expect(m1.get('a')).toBe('i1'); // tie on distance → earlier invoice
    expect(m1.get('b')).toBe('i2');
  });

  it('skips invoices with nothing paid', () => {
    const m = matchManualDepositsToInvoices([dep('d1', 0, '2026-03-10')], [inv('i1', 0, '2026-03-10')]);
    expect(m.size).toBe(0);
  });
});
