/** Dashboard KPI math — mirrors web `DashboardOverview.tsx` (amounts in major units). */

export type TrajectoryView = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type DashInvoice = {
  id: string;
  invoiceNumber?: string;
  client: string;
  clientId?: string;
  amount: number; // major units
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid' | string;
  date: string;
  dueDate: string;
  deposit?: number; // major units
  taxRate?: number;
  discount?: number;
  discountType?: string;
  items?: { quantity: number; unitPrice: number }[]; // unitPrice major units
  createdAt?: string;
};

export type DashSubscription = {
  id: string;
  client: string;
  plan: string;
  amount: number; // major
  billingCycle: 'Monthly' | 'Quarterly' | 'Annual' | string;
  startDate: string;
  endDate: string;
  status: string;
};

export type DashProject = {
  id: string;
  name: string;
  client: string;
  status: string;
  progress: number;
  dueDate?: string;
};

export type DashClient = {
  id: string;
  name: string;
  company?: string;
  status: string;
  createdAt?: string;
};

export type DashLead = { id: string; createdAt?: string };
export type DashTeamMember = { id: string; name: string; status: string };
export type DashExpense = { id: string; amount: number; date: string }; // amount cents from API
export type TaskWarning = {
  id: string;
  client: string;
  progress: number;
  completed: number;
  total: number;
  plan: string;
  label: string;
};
export type WorkloadItem = { id: string; name: string; count: number };

export function parseLocalDate(value?: string | null): Date | null {
  if (!value || value === 'N/A') return null;
  const datePart = String(value).split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameLocalMonth(date: Date, ref: Date) {
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d: Date) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59, 999);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function subMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() - n, d.getDate());
}
function subWeeks(d: Date, n: number) {
  return addDays(d, -n * 7);
}
function subYears(d: Date, n: number) {
  return new Date(d.getFullYear() - n, d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isSameYear(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear();
}
function differenceInCalendarDays(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / 86400000);
}

function eachDayOfInterval(start: Date, end: Date) {
  const out: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function eachWeekOfInterval(start: Date, end: Date) {
  const out: Date[] = [];
  let cur = startOfWeek(start);
  const last = endOfWeek(end);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = addDays(cur, 7);
  }
  return out;
}
function eachMonthOfInterval(start: Date, end: Date) {
  const out: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}
function eachYearOfInterval(start: Date, end: Date) {
  const out: Date[] = [];
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    out.push(new Date(y, 0, 1));
  }
  return out;
}

function formatPeriodLabel(d: Date, view: TrajectoryView) {
  if (view === 'daily') return String(d.getDate());
  if (view === 'weekly') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (view === 'monthly') return d.toLocaleDateString(undefined, { month: 'short' });
  return String(d.getFullYear());
}

function invoicePaidAmount(inv: DashInvoice): number {
  if (inv.status === 'Paid') return inv.amount;
  if (inv.status === 'Partially Paid') return inv.deposit || 0;
  return 0;
}

export function unpaidBalance(inv: DashInvoice): number {
  if (inv.items?.length) {
    const subtotal = inv.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const rate = inv.taxRate ?? 0;
    const tax = (subtotal * rate) / 100;
    const discountAmt =
      inv.discountType === 'percentage' || inv.discountType === 'PERCENTAGE'
        ? (subtotal * (inv.discount || 0)) / 100
        : inv.discount || 0;
    return subtotal + tax - discountAmt - (inv.deposit || 0);
  }
  return inv.amount - (inv.deposit || 0);
}

export function computeDashboardMetrics(input: {
  invoices: DashInvoice[];
  subscriptions: DashSubscription[];
  projects: DashProject[];
  clients: DashClient[];
  leads: DashLead[];
  team: DashTeamMember[];
  expenses: DashExpense[];
  expensesAvailable: boolean;
  trajectoryView: TrajectoryView;
  warnings: TaskWarning[];
  workload: WorkloadItem[];
  canRead: (module: string) => boolean;
}) {
  const {
    invoices,
    subscriptions,
    projects,
    clients,
    leads,
    team,
    expenses,
    expensesAvailable,
    trajectoryView,
    warnings,
    workload,
    canRead,
  } = input;

  const now = new Date();

  const activeMrr = subscriptions
    .filter((s) => s.status === 'Active')
    .reduce((sum, s) => {
      if (s.billingCycle === 'Annual') return sum + s.amount / 12;
      if (s.billingCycle === 'Quarterly') return sum + s.amount / 3;
      return sum + s.amount;
    }, 0);

  const monthlyRevenue = invoices
    .filter((inv) => {
      if (inv.status !== 'Paid' && inv.status !== 'Partially Paid') return false;
      const d = parseLocalDate(inv.date);
      return d ? isSameLocalMonth(d, now) : false;
    })
    .reduce((sum, inv) => sum + invoicePaidAmount(inv), 0);

  const lastMonthRef = subMonths(now, 1);
  const lastMonthRevenue = invoices
    .filter((inv) => {
      if (inv.status !== 'Paid' && inv.status !== 'Partially Paid') return false;
      const d = parseLocalDate(inv.date);
      return d ? isSameLocalMonth(d, lastMonthRef) : false;
    })
    .reduce((sum, inv) => sum + invoicePaidAmount(inv), 0);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthlyExpenses = expensesAvailable
    ? expenses
        .filter((e) => {
          const d = parseLocalDate(e.date);
          return d && d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0) / 100
    : 0;

  const last3Start = startOfMonth(subMonths(now, 2));
  const last3MonthsExpenses = expensesAvailable
    ? expenses
        .filter((e) => {
          const d = parseLocalDate(e.date);
          return d && d >= last3Start && d <= monthEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0) /
        100 /
        3
    : 0;

  const netProfitValue = expensesAvailable
    ? monthlyRevenue - monthlyExpenses + activeMrr
    : monthlyRevenue + activeMrr;

  const totalRev = monthlyRevenue + activeMrr;
  const profitMarginValue = totalRev === 0 ? 0 : Math.round((netProfitValue / totalRev) * 100);

  const growthRate =
    lastMonthRevenue === 0
      ? monthlyRevenue > 0
        ? 100
        : 0
      : Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);

  const activeClientsCount = clients.filter((c) => c.status === 'Active').length;
  const newLeadsThisMonth = leads.filter((l) => {
    const d = parseLocalDate(l.createdAt);
    return d ? isSameLocalMonth(d, now) : false;
  }).length;
  const activeProjectsCount = projects.filter((p) => p.status === 'In Progress').length;
  const activeTeamCount = team.filter((m) => m.status === 'Active').length;
  const activeSubsCount = subscriptions.filter((s) => s.status === 'Active').length;

  const unpaidInvoices = invoices.filter(
    (i) => i.status === 'Overdue' || i.status === 'Pending' || i.status === 'Partially Paid'
  );
  const outstandingAmount = unpaidInvoices.reduce((sum, i) => sum + unpaidBalance(i), 0);

  let periods: Date[] = [];
  if (trajectoryView === 'daily') {
    periods = eachDayOfInterval(startOfMonth(now), endOfMonth(now));
  } else if (trajectoryView === 'weekly') {
    periods = eachWeekOfInterval(subWeeks(now, 11), now);
  } else if (trajectoryView === 'monthly') {
    periods = eachMonthOfInterval(startOfYear(now), endOfYear(now));
  } else {
    periods = eachYearOfInterval(subYears(now, 4), now);
  }

  const revenueTrend = periods.map((period) => {
    const label = formatPeriodLabel(period, trajectoryView);

    const periodInvoices = invoices.filter((inv) => {
      const d = parseLocalDate(inv.date);
      if (!d) return false;
      if (trajectoryView === 'daily') return isSameDay(d, period);
      if (trajectoryView === 'weekly') return isSameWeek(d, period);
      if (trajectoryView === 'monthly') return isSameMonth(d, period);
      return isSameYear(d, period);
    });

    const paid = periodInvoices
      .filter((inv) => inv.status === 'Paid' || inv.status === 'Partially Paid')
      .reduce((sum, inv) => sum + invoicePaidAmount(inv), 0);

    let startOfPeriod: Date;
    let endOfPeriod: Date;
    if (trajectoryView === 'daily') {
      startOfPeriod = period;
      endOfPeriod = addDays(period, 1);
    } else if (trajectoryView === 'weekly') {
      startOfPeriod = startOfWeek(period);
      endOfPeriod = endOfWeek(period);
    } else if (trajectoryView === 'monthly') {
      startOfPeriod = startOfMonth(period);
      endOfPeriod = endOfMonth(period);
    } else {
      startOfPeriod = startOfYear(period);
      endOfPeriod = endOfYear(period);
    }

    const recurring = subscriptions
      .filter((s) => {
        if (s.status !== 'Active') return false;
        const start = parseLocalDate(s.startDate);
        const end = s.endDate && s.endDate !== 'N/A' ? parseLocalDate(s.endDate) : null;
        if (!start) return false;
        const hasStarted = start <= endOfPeriod;
        const hasNotEnded = !end || end >= startOfPeriod;
        return hasStarted && hasNotEnded;
      })
      .reduce((sum, s) => {
        const amt = s.amount;
        let periodAmt = 0;
        if (trajectoryView === 'daily') {
          periodAmt = s.billingCycle === 'Annual' ? amt / 365 : amt / 30;
        } else if (trajectoryView === 'weekly') {
          periodAmt = s.billingCycle === 'Annual' ? amt / 52 : amt / 4;
        } else if (trajectoryView === 'monthly') {
          periodAmt = s.billingCycle === 'Annual' ? amt / 12 : amt;
        } else {
          periodAmt = s.billingCycle === 'Annual' ? amt : amt * 12;
        }
        return sum + periodAmt;
      }, 0);

    const periodExpenses = expensesAvailable
      ? expenses.filter((e) => {
          const d = parseLocalDate(e.date);
          if (!d) return false;
          if (trajectoryView === 'daily') return isSameDay(d, period);
          if (trajectoryView === 'weekly') return isSameWeek(d, period);
          if (trajectoryView === 'monthly') return isSameMonth(d, period);
          return isSameYear(d, period);
        })
      : [];

    const expenseTotal = periodExpenses.reduce((sum, e) => sum + e.amount / 100, 0);

    return { label, paid, recurring, expenses: expenseTotal };
  });

  const horizon = addDays(now, 14);
  const upcomingEvents: {
    id: string;
    title: string;
    subtitle: string;
    date: Date;
    type: string;
    tone: 'purple' | 'gold' | 'blue';
  }[] = [];

  if (canRead('projects')) {
    projects.forEach((p) => {
      if (p.dueDate && p.status === 'In Progress') {
        const d = parseLocalDate(p.dueDate);
        if (d && d <= horizon) {
          upcomingEvents.push({
            id: `proj-${p.id}`,
            title: p.name,
            subtitle: p.client,
            date: d,
            type: 'Deadline',
            tone: 'purple',
          });
        }
      }
    });
  }

  if (canRead('invoices')) {
    invoices.forEach((i) => {
      if (i.dueDate && i.status !== 'Paid') {
        const d = parseLocalDate(i.dueDate);
        if (d && d <= horizon) {
          upcomingEvents.push({
            id: `inv-${i.id}`,
            title: `Invoice · ${i.amount.toLocaleString()}`,
            subtitle: i.client,
            date: d,
            type: 'Invoice',
            tone: 'gold',
          });
        }
      }
    });
  }

  if (canRead('subscriptions')) {
    subscriptions.forEach((s) => {
      if (s.endDate && s.endDate !== 'N/A' && s.status === 'Active') {
        const d = parseLocalDate(s.endDate);
        if (d && d <= horizon) {
          upcomingEvents.push({
            id: `sub-${s.id}`,
            title: `Renewal · ${s.plan}`,
            subtitle: s.client,
            date: d,
            type: 'Renewal',
            tone: 'blue',
          });
        }
      }
    });
  }

  upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  const activities: {
    colorType: 'primary' | 'secondary';
    action: string;
    subject: string;
    time: Date;
    invoiceId?: string;
    clientId?: string;
  }[] = [];

  if (canRead('invoices')) {
    invoices.slice(-10).forEach((i) => {
      if (i.status === 'Paid') {
        activities.push({
          colorType: 'secondary',
          action: 'Payment Received',
          subject: `${i.client} — ${i.amount.toLocaleString()}`,
          time: new Date(i.createdAt || i.date),
          invoiceId: i.id,
        });
      }
    });
  }
  if (canRead('clients')) {
    clients.slice(-5).forEach((c) => {
      if (!c.createdAt) return;
      activities.push({
        colorType: 'primary',
        action: 'New Client Onboarded',
        subject: c.company || c.name,
        time: new Date(c.createdAt),
        clientId: c.id,
      });
    });
  }
  activities.sort((a, b) => b.time.getTime() - a.time.getTime());

  const receivables = unpaidInvoices
    .slice()
    .sort((a, b) => {
      const da = parseLocalDate(a.dueDate)?.getTime() || 0;
      const db = parseLocalDate(b.dueDate)?.getTime() || 0;
      return da - db;
    })
    .slice(0, 5)
    .map((inv) => ({
      id: inv.id,
      client: inv.client,
      amount: unpaidBalance(inv),
      status: inv.status,
      dueDate: inv.dueDate,
    }));

  const currentQStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  let qRevenue = 0;
  let lastQRevenue = 0;
  const lastQStart = subMonths(currentQStart, 3);

  invoices.forEach((inv) => {
    if (inv.status !== 'Paid' && inv.status !== 'Partially Paid') return;
    const invDate = parseLocalDate(inv.date);
    if (!invDate) return;
    const amount = invoicePaidAmount(inv);
    if (invDate >= currentQStart) qRevenue += amount;
    else if (invDate >= lastQStart && invDate < currentQStart) lastQRevenue += amount;
  });

  const target =
    lastQRevenue > 0
      ? lastQRevenue * 1.2
      : qRevenue > 0
        ? Math.ceil(qRevenue / 10000) * 10000 + 20000
        : 50000;
  const progress = Math.min(Math.round((qRevenue / target) * 100), 100);

  let trendText = 'Based on invoices collected this quarter.';
  if (lastQRevenue > 0) {
    const growth = Math.round(((qRevenue - lastQRevenue) / lastQRevenue) * 100);
    if (growth > 0) trendText = `On track to exceed last quarter by ${growth}%.`;
    else if (growth < 0) trendText = `Currently ${Math.abs(growth)}% behind last quarter.`;
  }

  const quarterlyTarget = {
    current: qRevenue,
    target,
    progress,
    label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
    trendText,
  };

  const activeProjects = projects
    .filter((p) => p.status === 'In Progress')
    .sort((a, b) => {
      const da = parseLocalDate(a.dueDate)?.getTime() || 0;
      const db = parseLocalDate(b.dueDate)?.getTime() || 0;
      return da - db;
    })
    .slice(0, 5);

  const teamSnapshot = {
    active: team.filter((m) => m.status === 'Active').length,
    onLeave: team.filter((m) => m.status === 'On Leave').length,
    pending: team.filter((m) => m.status === 'Pending Documents' || m.status === 'Draft').length,
    total: team.length,
    workload: workload.slice().sort((a, b) => b.count - a.count).slice(0, 5),
    maxLoad: workload.reduce((m, w) => Math.max(m, w.count), 0),
  };

  return {
    activeMrr,
    monthlyRevenue,
    lastMonthRevenue,
    monthlyExpenses,
    last3MonthsExpenses,
    netProfitValue,
    profitMarginValue,
    growthRate,
    activeClientsCount,
    newLeadsThisMonth,
    activeProjectsCount,
    activeTeamCount,
    activeSubsCount,
    unpaidCount: unpaidInvoices.length,
    outstandingAmount,
    revenueTrend,
    upcomingEvents: upcomingEvents.slice(0, 6),
    activities: activities.slice(0, 6),
    receivables,
    quarterlyTarget,
    activeProjects,
    teamSnapshot,
    warnings: warnings.slice(0, 4),
  };
}

export function dueLabel(date: Date): { text: string; overdue: boolean } {
  const diff = differenceInCalendarDays(date, new Date());
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Tomorrow', overdue: false };
  return { text: `In ${diff}d`, overdue: false };
}

export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Map API enum STATUS_CASE → Title Case used by web dashboard. */
export function titleCaseStatus(raw: string): string {
  return String(raw || '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
