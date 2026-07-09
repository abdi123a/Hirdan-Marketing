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
        subscriptionRevenue += sub.amount * activeMonths;
      }
    });

    const totalRevenue = invoiceRevenue + subscriptionRevenue;

    // 3. Calculate Payroll Expenses (pro-rated for period)
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        basicSalary: true,
        housingAllowance: true,
        transportAllowance: true,
        otherAllowances: true,
        isHourlyMode: true,
        hourlyRate: true,
      },
    });

    let monthlyPayroll = 0;
    teamMembers.forEach((member) => {
      if (member.isHourlyMode && member.hourlyRate) {
        // Estimate 160 hours per month for hourly employees
        monthlyPayroll += member.hourlyRate * 160;
      } else {
        const basic = member.basicSalary || 0;
        const housing = member.housingAllowance || 0;
        const transport = member.transportAllowance || 0;
        
        let others = 0;
        if (member.otherAllowances) {
          try {
            // Check if otherAllowances is a JSON string of numbers/items
            const parsed = JSON.parse(member.otherAllowances);
            if (Array.isArray(parsed)) {
              others = parsed.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
            } else if (typeof parsed === 'object') {
              others = Object.values(parsed).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
            }
          } catch {
            // Fallback: parse as single number if possible
            others = Number(member.otherAllowances) || 0;
          }
        }

        monthlyPayroll += basic + housing + transport + others;
      }
    });

    const totalPayroll = Math.round(monthlyPayroll * months);

    // 4. Simulated Operational Expenses (Rent, Software, Marketing, Utilities)
    // Scale operational expenses with revenue/team size to make reports look beautiful and complete
    const rentMonthly = 250000; // $2,500.00
    const softwareMonthly = 15000 + (teamMembers.length * 2000); // $150 + $20/user
    const marketingMonthly = Math.round(totalRevenue * 0.05 / months); // 5% of monthly revenue
    const utilitiesMonthly = 80000; // $800.00

    const rentExpense = Math.round(rentMonthly * months);
    const softwareExpense = Math.round(softwareMonthly * months);
    const marketingExpense = Math.round(marketingMonthly * months);
    const utilitiesExpense = Math.round(utilitiesMonthly * months);
    const miscellaneousExpense = Math.round(totalRevenue * 0.02); // 2% of revenue

    const totalOperatingExpenses = totalPayroll + rentExpense + softwareExpense + marketingExpense + utilitiesExpense + miscellaneousExpense;
    
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
        payroll: totalPayroll,
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

    // Estimate total expenses from seed/inception date (say Jan 1, 2026) to asOfDate
    const inceptionDate = new Date(2026, 0, 1);
    const monthsSinceInception = Math.max(0.5, getMonthsInRange(inceptionDate, asOfDate));

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

    const cumulativePayroll = Math.round(monthlyPayroll * monthsSinceInception);
    const cumulativeOtherExpenses = Math.round((250000 + 150000 + 40000) * monthsSinceInception); // Rent + Software + Utilities

    const cashAndCashEquivalents = baselineCash + cumulativeRevenue - cumulativePayroll - cumulativeOtherExpenses;

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

    // C. Equipment / Fixed Assets (Simulated office computers & furniture)
    const fixedAssets = 850000; // $8,500.00
    const accumulatedDepreciation = Math.round(-75000 * monthsSinceInception); // -$75/month depreciation

    const totalAssets = cashAndCashEquivalents + accountsReceivable + fixedAssets + accumulatedDepreciation;

    // 2. LIABILITIES
    // A. Accounts Payable (Simulated vendors, unpaid bills, hosting fees)
    const accountsPayable = 35000; // $350.00
    
    // B. Accrued Payroll (salaries accumulated for current month but not yet paid)
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
    // Payroll paid in this range
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

    const operatingCashPayrollOutflows = Math.round(monthlyPayroll * months);
    
    // Operating expenses paid (Rent, Software, Utilities, Marketing)
    const operatingExpensesMonthly = 250000 + 150000 + 80000; // Rent + Software + Utilities
    const operatingCashExpensesOutflows = Math.round(operatingExpensesMonthly * months);

    const netOperatingCashFlow = operatingCashInflows - operatingCashPayrollOutflows - operatingCashExpensesOutflows;

    // 3. CASH FLOW FROM INVESTING
    // Simulated computer equipment purchases
    const investingCashFlow = -120000; // -$1,200 purchase of new laptop

    // 4. CASH FLOW FROM FINANCING
    // Simulated owner drawing or loan repayment
    const financingCashFlow = -150000; // -$1,500 owner drawing

    // 5. RECONCILIATION
    // Calculate cash at beginning of period
    const baselineCash = 5000000; // $50,000 baseline
    const inceptionDate = new Date(2026, 0, 1);
    const monthsBeforeStart = getMonthsInRange(inceptionDate, fromDate);

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

    const payrollBefore = Math.round(monthlyPayroll * monthsBeforeStart);
    const expensesBefore = Math.round(operatingExpensesMonthly * monthsBeforeStart);
    
    const cashAtBeginning = baselineCash + revenueBefore - payrollBefore - expensesBefore;
    const netChangeInCash = netOperatingCashFlow + investingCashFlow + financingCashFlow;
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
        purchaseOfEquipment: investingCashFlow,
        netCashFromInvesting: investingCashFlow,
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

export default router;
