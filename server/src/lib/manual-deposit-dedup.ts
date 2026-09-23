/**
 * Conservative de-duplication of manual revenue deposits against legacy paid
 * invoices (pure, unit-tested).
 *
 * Before deposit-sync existed, staff sometimes recorded an invoice payment by
 * hand as a REVENUE deposit *and* marked the invoice paid. The income
 * statement counts such an invoice from the invoice itself (it has no linked
 * deposit) and the hand-made deposit as "other revenue" — the same money twice.
 *
 * A manual deposit is treated as a duplicate of an invoice when the amounts are
 * identical (cents) and the dates are at most `windowDays` apart. Matching is
 * 1:1 and greedy: deposits in date order (then id), each taking the unmatched
 * invoice closest in date (ties: earlier invoice, then id). The result is
 * deterministic, so the same deposit is excluded whatever period is reported.
 */

export interface ManualDepositLike {
  id: string;
  amount: number; // cents
  date: Date;
}

export interface LegacyPaidInvoiceLike {
  id: string;
  /** Amount the invoice reports as paid (cents): full amount, or the partial deposit. */
  paidAmount: number;
  date: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** depositId → invoiceId for every manual deposit judged to duplicate an invoice. */
export function matchManualDepositsToInvoices(
  deposits: ManualDepositLike[],
  invoices: LegacyPaidInvoiceLike[],
  windowDays = 7,
): Map<string, string> {
  const windowMs = windowDays * DAY_MS;
  const byAmount = new Map<number, LegacyPaidInvoiceLike[]>();
  for (const inv of invoices) {
    if (!(inv.paidAmount > 0)) continue;
    const list = byAmount.get(inv.paidAmount) ?? [];
    list.push(inv);
    byAmount.set(inv.paidAmount, list);
  }

  const ordered = [...deposits].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
  );
  const usedInvoices = new Set<string>();
  const matches = new Map<string, string>();

  for (const dep of ordered) {
    const candidates = byAmount.get(dep.amount);
    if (!candidates) continue;
    let best: LegacyPaidInvoiceLike | null = null;
    let bestDiff = Infinity;
    for (const inv of candidates) {
      if (usedInvoices.has(inv.id)) continue;
      const diff = Math.abs(inv.date.getTime() - dep.date.getTime());
      if (diff > windowMs) continue;
      if (
        !best ||
        diff < bestDiff ||
        (diff === bestDiff &&
          (inv.date.getTime() < best.date.getTime() ||
            (inv.date.getTime() === best.date.getTime() && inv.id.localeCompare(best.id) < 0)))
      ) {
        best = inv;
        bestDiff = diff;
      }
    }
    if (best) {
      usedInvoices.add(best.id);
      matches.set(dep.id, best.id);
    }
  }
  return matches;
}
