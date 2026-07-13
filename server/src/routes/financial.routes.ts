import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// Secure all financial endpoints to Admin only
router.use(authenticate);
router.use(requireAdmin);

/**
 * Helper to parse date params or return default range (this year)
 */
function getPeriodDates(req: Request) {
  const { from, to } = req.query;
  const now = new Date();
  
  // Default to start of current year to now
  const fromDate = from ? new Date(from as string) : new Date(now.getFullYear(), 0, 1);
  const toDate = to ? new Date(to as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month
  
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw AppError.badRequest('Invalid date format. Use YYYY-MM-DD.');
  }
  
  return { fromDate, toDate };
}

/**
 * Helper to calculate number of months between two dates (pro-rating)
 */
function getMonthsInRange(from: Date, to: Date): number {
  const diffTime = Math.abs(to.getTime() - from.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  // Pro-rate based on average month length (30.44 days)
  return Math.max(0.1, diffDays / 30.44);
}

// ─── GET /api/financial/income-statement ───────────────────────────
router.get('/income-statement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = getPeriodDates(req);
    const months = getMonthsInRange(fromDate, toDate);

    // 1. Calculate Invoice Revenue in period
    const invoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
        status: {
          in: ['PAID', 'PARTIALLY_PAID'],
        },
      },
      select: {
        amount: true,
        deposit: true,
        status: true,
      },
    });

    let invoiceRevenue = 0;
    invoices.forEach((inv) => {
      if (inv.status === 'PAID') {
        invoiceRevenue += inv.amount;
      } else if (inv.status === 'PARTIALLY_PAID') {
        invoiceRevenue += inv.deposit || 0;
      }
    });

    // 2. Calculate Active Subscription MRR in period
    // Subscription is active if it started before the period end, and hasn't ended or ended after period start
    const subscriptions = await prisma.subscription.findMany({
      where: {
        startDate: {
          lte: toDate,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: fromDate } },
        ],
        status: 'ACTIVE',
      },
      select: {
        amount: true,
        startDate: true,
        endDate: true,
        billingCycle: true,
      },
    });

    // Pro-rate subscription revenue based on how long it was active in this window
    let subscriptionRevenue = 0;
    subscriptions.forEach((sub) => {
      // Find overlap period between subscription validity and selected date range
      const subStart = new Date(Math.max(sub.startDate.getTime(), fromDate.getTime()));
      const subEnd = sub.endDate 
        ? new Date(Math.min(sub.endDate.getTime(), toDate.getTime()))
        : toDate;
      
      if (subStart <= subEnd) {
        const activeMonths = getMonthsInRange(subStart, subEnd);
        let monthlyRate = sub.amount;
        if (sub.billingCycle === 'ANNUAL') {
          monthlyRate = sub.amount / 12;
        } else if (sub.billingCycle === 'QUARTERLY') {
          monthlyRate = sub.amount / 3;
        }
        subscriptionRevenue += monthlyRate * activeMonths;
      }
    });

    const totalRevenue = invoiceRevenue + subscriptionRevenue;

    // 3. Calculate Real Expenses in period
    const dbExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    let payrollExpense = 0;
    let rentExpense = 0;
    let softwareExpense = 0;
    let marketingExpense = 0;
    let utilitiesExpense = 0;
    let miscellaneousExpense = 0;

    dbExpenses.forEach((exp) => {
      const amt = exp.amount; // in cents
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
        to: toDate.toISOString().split('T')[0],
        months,
      },
      revenue: {
        invoiceRevenue,
        subscriptionRevenue,
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
    const asOfDate = asOfParam ? new Date(asOfParam) : new Date();

    if (isNaN(asOfDate.getTime())) {
      throw AppError.badRequest('Invalid date format. Use YYYY-MM-DD.');
    }

    // 1. ASSETS
    // A. Cash (starting baseline $50,000 + paid invoices - payroll/rent/software up to asOfDate)
    const baselineCash = 5000000; // $50,000 in cents

    // Get all paid invoice revenue up to asOfDate
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        date: { lte: asOfDate },
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      select: {
        amount: true,
        deposit: true,
        status: true,
      },
    });

    let cumulativeRevenue = 0;
    paidInvoices.forEach((inv) => {
      if (inv.status === 'PAID') {
        cumulativeRevenue += inv.amount;
      } else if (inv.status === 'PARTIALLY_PAID') {
        cumulativeRevenue += inv.deposit || 0;
      }
    });

    // Real cumulative expenses up to asOfDate
    const paidExpensesAgg = await prisma.expense.aggregate({
      where: { date: { lte: asOfDate } },
      _sum: { amount: true },
    });
    const cumulativeExpenses = paidExpensesAgg._sum.amount ?? 0;

    const cashAndCashEquivalents = baselineCash + cumulativeRevenue - cumulativeExpenses;

    // B. Accounts Receivable (invoices outstanding up to asOfDate)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        date: { lte: asOfDate },
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

    // C. Equipment / Fixed Assets (Real database EQUIPMENT expenses)
    const equipmentExpensesAgg = await prisma.expense.aggregate({
      where: {
        date: { lte: asOfDate },
        category: 'EQUIPMENT',
      },
      _sum: { amount: true },
    });
    const fixedAssets = equipmentExpensesAgg._sum.amount ?? 0;

    // 1% depreciation per month since inception (say Jan 1, 2026)
    const inceptionDate = new Date(2026, 0, 1);
    const monthsSinceInception = Math.max(0.5, getMonthsInRange(inceptionDate, asOfDate));
    const accumulatedDepreciation = Math.round(-0.01 * fixedAssets * monthsSinceInception);

    const totalAssets = cashAndCashEquivalents + accountsReceivable + fixedAssets + accumulatedDepreciation;

    // 2. LIABILITIES
    // A. Accounts Payable (Simulated vendors, unpaid bills, hosting fees)
    const accountsPayable = 35000; // $350.00
    
    // B. Accrued Payroll (salaries accumulated for current month but not yet paid)
    // Get active payroll monthly sum
    const teamMembers = await prisma.teamMember.findMany({
      where: { status: 'ACTIVE' },
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

    const daysIntoCurrentMonth = asOfDate.getDate();
    const accruedPayroll = Math.round(monthlyPayroll * (daysIntoCurrentMonth / 30));

    const totalLiabilities = accountsPayable + accruedPayroll;

    // 3. OWNER'S EQUITY
    // Equity = Assets - Liabilities
    const ownersEquity = totalAssets - totalLiabilities;

    res.json({
      asOf: asOfDate.toISOString().split('T')[0],
      assets: {
        cash: cashAndCashEquivalents,
        accountsReceivable,
        fixedAssets,
        accumulatedDepreciation,
        total: totalAssets,
      },
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
    const { fromDate, toDate } = getPeriodDates(req);
    const months = getMonthsInRange(fromDate, toDate);

    // 1. CASH INFLOWS FROM OPERATIONS
    // Invoices paid in this range
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      select: {
        amount: true,
        deposit: true,
        status: true,
      },
    });

    let operatingCashInflows = 0;
    paidInvoices.forEach((inv) => {
      if (inv.status === 'PAID') {
        operatingCashInflows += inv.amount;
      } else if (inv.status === 'PARTIALLY_PAID') {
        operatingCashInflows += inv.deposit || 0;
      }
    });

    // 2. CASH OUTFLOWS FROM OPERATIONS
    // Real expenses in this range
    const periodExpenses = await prisma.expense.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
      },
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
    const financingCashFlow = 0;

    // 5. RECONCILIATION
    // Calculate cash at beginning of period
    const baselineCash = 5000000; // $50,000 baseline

    // Get all paid invoice revenue before fromDate
    const paidInvoicesBefore = await prisma.invoice.findMany({
      where: {
        date: { lt: fromDate },
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      select: {
        amount: true,
        deposit: true,
        status: true,
      },
    });

    let revenueBefore = 0;
    paidInvoicesBefore.forEach((inv) => {
      if (inv.status === 'PAID') {
        revenueBefore += inv.amount;
      } else if (inv.status === 'PARTIALLY_PAID') {
        revenueBefore += inv.deposit || 0;
      }
    });

    // Get all expenses before fromDate
    const expensesBeforeAgg = await prisma.expense.aggregate({
      where: {
        date: { lt: fromDate },
      },
      _sum: {
        amount: true,
      },
    });
    const expensesBefore = expensesBeforeAgg._sum.amount ?? 0;
    
    const cashAtBeginning = baselineCash + revenueBefore - expensesBefore;
    const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + financingCashFlow;
    const cashAtEnd = cashAtBeginning + netChangeInCash;

    res.json({
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
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
        ownerDrawings: financingCashFlow,
        netCashFromFinancing: financingCashFlow,
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
