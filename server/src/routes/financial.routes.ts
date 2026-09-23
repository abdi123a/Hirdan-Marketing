import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import {
  addTo,
  exclusiveEnd,
  InvalidDateError,
  invoiceIdOfDeposit,
  monthsBetween,
  parseReportRange,
  straightLineDepreciation,
} from '../lib/report-period.js';
import { matchManualDepositsToInvoices } from '../lib/manual-deposit-dedup.js';

const router = Router();

// Secure all financial endpoints to Admin only
router.use(authenticate);
router.use(requireAdmin);

/**
 * All report figures are integer cents in the agency's base currency
 * (AgencySettings.currency). Accounts held in other currencies are left out of
 * the totals and reported separately per currency — we have no FX rates to
 * convert them. Invoices carry no currency and are in the base currency.
 *
 * Revenue has exactly one source per figure:
 *  - income statement: invoice payments (dated by payment date = the date of
 *    the deposit that deposit-sync records for the invoice; invoices paid
 *    before that sync existed fall back to their issue date) plus manual
 *    REVENUE deposits not tied to an invoice.
 *  - cash (balance sheet, cash flow): account ledgers only — opening balances
 *    + deposits (which already include invoice payments) − expenses, with
 *    transfers netting out between base-currency accounts.
 */
function getPeriodDates(req: Request) {
  try {
    return parseReportRange(req.query.from, req.query.to);
  } catch (error) {
    if (error instanceof InvalidDateError) throw AppError.badRequest(error.message);
    throw error;
  }
}

interface LedgerContext {
  baseCurrency: string;
  baseAccountIds: string[];
  currencyOf: Map<string, string>;
  openingByCurrency: Record<string, number>;
}

async function loadLedgerContext(): Promise<LedgerContext> {
  const [settings, accounts] = await Promise.all([
    prisma.agencySettings.findFirst({ select: { currency: true } }),
    // Archived accounts included: their history is still part of the books.
    prisma.account.findMany({ select: { id: true, currency: true, openingBalance: true } }),
  ]);
  const baseCurrency = settings?.currency || 'USD';
  const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
  const openingByCurrency: Record<string, number> = {};
  for (const a of accounts) addTo(openingByCurrency, a.currency, a.openingBalance);
  return {
    baseCurrency,
    baseAccountIds: accounts.filter((a) => a.currency === baseCurrency).map((a) => a.id),
    currencyOf,
    openingByCurrency,
  };
}

/** Cash held per currency strictly before `before` (sum of account ledgers). */
async function cashByCurrencyBefore(ctx: LedgerContext, before: Date): Promise<Record<string, number>> {
  const date = { lt: before };
  const [deposits, expenses, transfersOut, transfersInSame, transfersInConverted] = await Promise.all([
    prisma.deposit.groupBy({ by: ['accountId'], where: { date }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ['accountId'], where: { date }, _sum: { amount: true } }),
    prisma.accountTransfer.groupBy({ by: ['fromAccountId'], where: { date }, _sum: { amount: true } }),
    prisma.accountTransfer.groupBy({ by: ['toAccountId'], where: { date, toAmount: null }, _sum: { amount: true } }),
    prisma.accountTransfer.groupBy({ by: ['toAccountId'], where: { date, toAmount: { not: null } }, _sum: { toAmount: true } }),
  ]);
  const cash: Record<string, number> = { ...ctx.openingByCurrency };
  const add = (accountId: string, amount: number) => {
    const currency = ctx.currencyOf.get(accountId);
    if (currency) addTo(cash, currency, amount);
  };
  for (const r of deposits) add(r.accountId, r._sum.amount ?? 0);
  for (const r of expenses) add(r.accountId, -(r._sum.amount ?? 0));
  for (const r of transfersOut) add(r.fromAccountId, -(r._sum.amount ?? 0));
  for (const r of transfersInSame) add(r.toAccountId, r._sum.amount ?? 0);
  for (const r of transfersInConverted) add(r.toAccountId, r._sum.toAmount ?? 0);
  return cash;
}

/**
 * Invoice payments received in [from, to), split by whether the invoice was
 * generated for a subscription.
 */
async function invoicePaymentsInPeriod(from: Date, to: Date) {
  // Every invoice-payment deposit ever recorded; needed to know which paid
  // invoices have a real payment date. Fetched without `select` so a future
  // Deposit.invoiceId column is picked up by invoiceIdOfDeposit.
  const revenueDeposits = await prisma.deposit.findMany({ where: { category: 'REVENUE' } });
  const invoicesWithDeposit = new Set<string>();
  const paidInPeriod = new Map<string, number>();
  for (const d of revenueDeposits) {
    const invoiceId = invoiceIdOfDeposit(d);
    if (!invoiceId) continue;
    invoicesWithDeposit.add(invoiceId);
    if (d.date >= from && d.date < to) {
      paidInPeriod.set(invoiceId, (paidInPeriod.get(invoiceId) ?? 0) + d.amount);
    }
  }

  const [depositInvoices, legacyPaid] = await Promise.all([
    prisma.invoice.findMany({
      where: { id: { in: [...paidInPeriod.keys()] } },
      select: { id: true, subscriptionId: true },
    }),
    // Paid before deposit-sync existed: no payment date recorded, use issue date.
    prisma.invoice.findMany({
      where: {
        date: { gte: from, lt: to },
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
        id: { notIn: [...invoicesWithDeposit] },
      },
      select: { amount: true, deposit: true, status: true, subscriptionId: true },
    }),
  ]);

  let invoiceRevenue = 0;
  let subscriptionRevenue = 0;
  const isSubscription = new Map(depositInvoices.map((i) => [i.id, !!i.subscriptionId]));
  for (const [invoiceId, amount] of paidInPeriod) {
    if (isSubscription.get(invoiceId)) subscriptionRevenue += amount;
    else invoiceRevenue += amount;
  }
  for (const inv of legacyPaid) {
    const amount = inv.status === 'PAID' ? inv.amount : (inv.deposit ?? 0);
    if (inv.subscriptionId) subscriptionRevenue += amount;
    else invoiceRevenue += amount;
  }
  return { invoiceRevenue, subscriptionRevenue, revenueDeposits, invoicesWithDeposit };
}

// ─── GET /api/financial/income-statement ───────────────────────────
router.get('/income-statement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toExclusive, toLabel } = getPeriodDates(req);
    const months = Math.max(0.1, monthsBetween(fromDate, toExclusive));
    const ctx = await loadLedgerContext();

    // 1. Revenue: invoice payments (subscription invoices reported separately;
    //    the old pro-rated subscription estimate double counted them).
    const { invoiceRevenue, subscriptionRevenue, revenueDeposits, invoicesWithDeposit } =
      await invoicePaymentsInPeriod(fromDate, toExclusive);

    // 2. Manual revenue deposits (not created from an invoice) in base-currency accounts,
    //    minus legacy duplicates: a hand-recorded payment of an invoice that was
    //    also marked paid (and has no deposit of its own) is already counted in
    //    invoice revenue. Matched over all history so the result is stable.
    const baseIds = new Set(ctx.baseAccountIds);
    const manualDeposits = revenueDeposits.filter((d) => baseIds.has(d.accountId) && !invoiceIdOfDeposit(d));
    const legacyPaidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
        id: { notIn: [...invoicesWithDeposit] },
      },
      select: { id: true, amount: true, deposit: true, status: true, date: true },
    });
    const duplicateOf = matchManualDepositsToInvoices(
      manualDeposits,
      legacyPaidInvoices.map((inv) => ({
        id: inv.id,
        paidAmount: inv.status === 'PAID' ? inv.amount : (inv.deposit ?? 0),
        date: inv.date,
      })),
    );

    let otherRevenue = 0;
    const dedupedManualDeposits = { count: 0, amount: 0 };
    for (const d of manualDeposits) {
      if (d.date < fromDate || d.date >= toExclusive) continue;
      if (duplicateOf.has(d.id)) {
        dedupedManualDeposits.count += 1;
        dedupedManualDeposits.amount += d.amount;
      } else {
        otherRevenue += d.amount;
      }
    }

    const totalRevenue = invoiceRevenue + subscriptionRevenue + otherRevenue;

    // 3. Calculate Real Expenses in period
    const dbExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: fromDate,
          lt: toExclusive,
        },
      },
      select: { amount: true, category: true, accountId: true },
    });

    let payrollExpense = 0;
    let rentExpense = 0;
    let softwareExpense = 0;
    let marketingExpense = 0;
    let utilitiesExpense = 0;
    let miscellaneousExpense = 0;
    const otherCurrencyExpenses: Record<string, number> = {};

    dbExpenses.forEach((exp) => {
      const amt = exp.amount; // in cents
      const currency = ctx.currencyOf.get(exp.accountId) ?? ctx.baseCurrency;
      if (currency !== ctx.baseCurrency) {
        addTo(otherCurrencyExpenses, currency, amt);
        return;
      }
      if (exp.category === 'PAYROLL') {
        payrollExpense += amt;
      } else if (exp.category === 'RENT') {
        rentExpense += amt;
      } else if (exp.category === 'SOFTWARE') {
        softwareExpense += amt;
      } else if (exp.category === 'MARKETING') {
        marketingExpense += amt;
      } else if (exp.category === 'UTILITIES') {
        utilitiesExpense += amt;
      } else {
        miscellaneousExpense += amt;
      }
    });

    const totalOperatingExpenses = payrollExpense + rentExpense + softwareExpense + marketingExpense + utilitiesExpense + miscellaneousExpense;
    
    // Profit metrics
    const grossProfit = totalRevenue; // No COGS in pure service agency model usually
    const netProfit = grossProfit - totalOperatingExpenses;

    res.json({
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toLabel,
        months,
      },
      currency: ctx.baseCurrency,
      revenue: {
        invoiceRevenue,
        subscriptionRevenue,
        otherRevenue,
        total: totalRevenue,
      },
      expenses: {
        payroll: payrollExpense,
        rent: rentExpense,
        software: softwareExpense,
        marketing: marketingExpense,
        utilities: utilitiesExpense,
        miscellaneous: miscellaneousExpense,
        total: totalOperatingExpenses,
      },
      // Expenses from accounts in other currencies, excluded from the totals above.
      otherCurrencyExpenses,
      // Manual REVENUE deposits left out of otherRevenue because they look like a
      // hand-recorded payment of an invoice already counted (same amount, ±7 days).
      dedupedManualDeposits,
      grossProfit,
      netProfit,
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/financial/balance-sheet ──────────────────────────────
router.get('/balance-sheet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asOfParam = req.query.asOf as string;
    let asOfExclusive: Date;
    try {
      asOfExclusive = asOfParam ? exclusiveEnd(asOfParam) : new Date(Date.now() + 1);
    } catch {
      throw AppError.badRequest('Invalid date format. Use YYYY-MM-DD.');
    }
    const asOfDate = new Date(asOfExclusive.getTime() - 1); // last instant included
    const ctx = await loadLedgerContext();

    // 1. ASSETS
    // A. Cash: real account balances (opening balances + deposits ± transfers − expenses)
    const cashByCurrency = await cashByCurrencyBefore(ctx, asOfExclusive);
    const cashAndCashEquivalents = cashByCurrency[ctx.baseCurrency] ?? 0;

    // B. Accounts Receivable (invoices outstanding up to asOfDate)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        date: { lt: asOfExclusive },
        status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
      select: {
        amount: true,
        deposit: true,
        status: true,
      },
    });

    let accountsReceivable = 0;
    unpaidInvoices.forEach((inv) => {
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') {
        accountsReceivable += inv.amount;
      } else if (inv.status === 'PARTIALLY_PAID') {
        accountsReceivable += inv.amount - (inv.deposit || 0);
      }
    });

    // C. Equipment / Fixed Assets (EQUIPMENT expenses in base-currency accounts)
    const equipment = await prisma.expense.findMany({
      where: {
        date: { lt: asOfExclusive },
        category: 'EQUIPMENT',
        accountId: { in: ctx.baseAccountIds },
      },
      select: { amount: true, date: true },
    });
    const fixedAssets = equipment.reduce((sum, e) => sum + e.amount, 0);

    // 1% of cost per month from each item's purchase date, capped at cost
    const accumulatedDepreciation = -equipment.reduce(
      (sum, e) => sum + straightLineDepreciation(e.amount, e.date, asOfDate),
      0,
    );

    const totalAssets = cashAndCashEquivalents + accountsReceivable + fixedAssets + accumulatedDepreciation;

    // 2. LIABILITIES
    // A. Accounts Payable: the app does not track unpaid bills (expenses are
    //    recorded when paid), so there is nothing to report here.
    const accountsPayable = 0;

    // B. Accrued Payroll: salary earned so far this month minus payroll already
    //    recorded as paid this month (base-currency staff only).
    const teamMembers = await prisma.teamMember.findMany({
      where: { status: 'ACTIVE', OR: [{ currency: ctx.baseCurrency }, { currency: null }] },
      select: {
        basicSalary: true,
        housingAllowance: true,
        transportAllowance: true,
      },
    });

    let monthlyPayroll = 0;
    teamMembers.forEach((m) => {
      monthlyPayroll += (m.basicSalary || 0) + (m.housingAllowance || 0) + (m.transportAllowance || 0);
    });

    const monthStart = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1));
    const payrollPaidAgg = await prisma.expense.aggregate({
      where: {
        category: 'PAYROLL',
        date: { gte: monthStart, lt: asOfExclusive },
        accountId: { in: ctx.baseAccountIds },
      },
      _sum: { amount: true },
    });
    const daysIntoCurrentMonth = Math.min(30, asOfDate.getUTCDate());
    const earnedPayroll = Math.round(monthlyPayroll * (daysIntoCurrentMonth / 30));
    const accruedPayroll = Math.max(0, earnedPayroll - (payrollPaidAgg._sum.amount ?? 0));

    const totalLiabilities = accountsPayable + accruedPayroll;

    // 3. OWNER'S EQUITY
    // Equity = Assets - Liabilities
    const ownersEquity = totalAssets - totalLiabilities;

    res.json({
      asOf: asOfDate.toISOString().split('T')[0],
      currency: ctx.baseCurrency,
      assets: {
        cash: cashAndCashEquivalents,
        accountsReceivable,
        fixedAssets,
        accumulatedDepreciation,
        total: totalAssets,
      },
      // Cash per account currency (base currency included); only the base
      // currency figure is part of the totals.
      cashByCurrency,
      liabilities: {
        accountsPayable,
        accruedPayroll,
        total: totalLiabilities,
      },
      equity: {
        retainedEarnings: ownersEquity,
        total: ownersEquity,
      },
      totalLiabilitiesAndEquity: totalLiabilities + ownersEquity,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/financial/cash-flow ──────────────────────────────────
router.get('/cash-flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toExclusive, toLabel } = getPeriodDates(req);
    const ctx = await loadLedgerContext();
    const inPeriod = { gte: fromDate, lt: toExclusive };
    const baseIds = new Set(ctx.baseAccountIds);

    // 1. CASH INFLOWS FROM OPERATIONS
    // Money actually received from clients: REVENUE deposits (this includes the
    // deposits recorded for paid invoices, dated on payment).
    const periodDeposits = await prisma.deposit.findMany({
      where: { date: inPeriod, accountId: { in: ctx.baseAccountIds } },
    });

    let operatingCashInflows = 0;
    let financingCashFlow = 0; // owner investment, refunds, other non-revenue deposits
    periodDeposits.forEach((d) => {
      if (d.category === 'REVENUE' || invoiceIdOfDeposit(d)) operatingCashInflows += d.amount;
      else financingCashFlow += d.amount;
    });

    // 2. CASH OUTFLOWS FROM OPERATIONS
    // Real expenses in this range
    const periodExpenses = await prisma.expense.findMany({
      where: { date: inPeriod, accountId: { in: ctx.baseAccountIds } },
      select: { amount: true, category: true },
    });

    let operatingCashPayrollOutflows = 0;
    let operatingCashExpensesOutflows = 0;
    let investingCashFlow = 0; // EQUIPMENT expenses in period

    periodExpenses.forEach((exp) => {
      const amt = exp.amount;
      if (exp.category === 'PAYROLL') {
        operatingCashPayrollOutflows += amt;
      } else if (exp.category === 'EQUIPMENT') {
        investingCashFlow += amt;
      } else {
        operatingCashExpensesOutflows += amt;
      }
    });

    const netOperatingCashFlow = operatingCashInflows - operatingCashPayrollOutflows - operatingCashExpensesOutflows;

    // 3. CASH FLOW FROM INVESTING
    // Negate the positive sum to show as cash outflow
    const netInvestingCashFlow = -investingCashFlow;

    // 4. CASH FLOW FROM FINANCING
    // Non-revenue deposits, plus money moved to/from accounts in other
    // currencies (transfers between base-currency accounts net to zero).
    const periodTransfers = await prisma.accountTransfer.findMany({
      where: { date: inPeriod },
      select: { fromAccountId: true, toAccountId: true, amount: true, toAmount: true },
    });
    let currencyTransfers = 0;
    for (const t of periodTransfers) {
      const fromBase = baseIds.has(t.fromAccountId);
      const toBase = baseIds.has(t.toAccountId);
      if (toBase && !fromBase) currencyTransfers += t.toAmount ?? t.amount;
      if (fromBase && !toBase) currencyTransfers -= t.amount;
    }
    const netFinancingCashFlow = financingCashFlow + currencyTransfers;

    // 5. RECONCILIATION — from the same ledgers, so begin + change = end.
    const cashAtBeginning = (await cashByCurrencyBefore(ctx, fromDate))[ctx.baseCurrency] ?? 0;
    const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
    const cashAtEnd = cashAtBeginning + netChangeInCash;

    res.json({
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toLabel,
      },
      currency: ctx.baseCurrency,
      operatingActivities: {
        receiptsFromClients: operatingCashInflows,
        paymentsForPayroll: -operatingCashPayrollOutflows,
        paymentsForExpenses: -operatingCashExpensesOutflows,
        netCashFromOperating: netOperatingCashFlow,
      },
      investingActivities: {
        purchaseOfEquipment: -investingCashFlow,
        netCashFromInvesting: netInvestingCashFlow,
      },
      financingActivities: {
        // Kept for API compatibility: non-revenue deposits (owner
        // contributions, refunds, …) — positive = cash in.
        ownerDrawings: financingCashFlow,
        currencyTransfers,
        netCashFromFinancing: netFinancingCashFlow,
      },
      netChangeInCash,
      cashAtBeginning,
      cashAtEnd,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/financial/monthly-commitments ────────────────────────
router.get('/monthly-commitments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeRecurring = await prisma.recurringExpense.findMany({
      where: { isActive: true },
    });
    const recurringTotal = activeRecurring.reduce((sum, r) => sum + r.amount, 0);

    const activeTeam = await prisma.teamMember.findMany({
      where: { status: 'ACTIVE' },
      select: {
        basicSalary: true,
        housingAllowance: true,
        transportAllowance: true,
      },
    });

    let payrollTotal = 0;
    activeTeam.forEach((m) => {
      payrollTotal += (m.basicSalary || 0) + (m.housingAllowance || 0) + (m.transportAllowance || 0);
    });

    res.json({
      recurringTotal,
      payrollTotal,
      combinedMonthlyBurden: recurringTotal + payrollTotal,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
