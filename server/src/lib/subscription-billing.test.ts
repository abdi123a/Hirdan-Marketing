import { describe, it, expect } from 'vitest';
import { nextReminderKind } from './subscription-billing.js';

const day = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000);
const client = { paymentReminderDelay: null, overdueNoticeDelay: null }; // defaults: 5 / 10
const inv = (over: Partial<Parameters<typeof nextReminderKind>[0]> = {}) => ({
  date: day(0), dueDate: day(14), reminderSentAt: null, overdueSentAt: null, ...over,
});

describe('nextReminderKind', () => {
  it('never sends "overdue" before the invoice is due', () => {
    // Old bug: overdue fired at invoice date + 10 days, 4 days before the due date.
    expect(nextReminderKind(inv(), client, day(10))).toBeNull();
  });

  it('sends the reminder at due date + grace days', () => {
    expect(nextReminderKind(inv(), client, day(18))).toBeNull();
    expect(nextReminderKind(inv(), client, day(19))).toBe('reminder');
  });

  it('sends the overdue notice only after the reminder was sent or skipped', () => {
    expect(nextReminderKind(inv({ reminderSentAt: day(19) }), client, day(20))).toBe('overdue');
  });

  it('sends nothing once both are handled', () => {
    expect(nextReminderKind(inv({ reminderSentAt: day(19), overdueSentAt: day(20) }), client, day(60))).toBeNull();
  });
});
