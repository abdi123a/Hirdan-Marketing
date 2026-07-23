import {
  Banknote,
  Users,
  Briefcase,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Settings,
  Target,
  UserPlus,
  TrendingDown,
  Contact,
  Plus,
  Coins,
  Tag,
  FileText,
  Clock,
  Wallet,
  CalendarClock,
  FolderKanban,
  UserCog,
  Send,
  Sparkles,
  FileSignature,
  AlertTriangle,
  Boxes,
  Zap,
  Share2,
  Layers,
  Gauge,
  Package as PackageIcon,
  BarChart3,
  Hourglass,
  CircleDollarSign,
  ClipboardList
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { DashboardSkeleton } from "@/components/ui/PageSkeleton";
import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickAddExpenseModal } from "@/components/QuickAddExpenseModal";
import { EXPENSE_CATEGORIES } from "./ExpensesPage";
import {
  formatDistanceToNow,
  isAfter,
  isBefore,
  addDays,
  format,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachDayOfInterval,
  subYears,
  startOfYear,
  endOfYear,
  eachYearOfInterval,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  subMonths,
  differenceInCalendarDays
} from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

/* ────────────────────────────────────────────────────────────────────────────
   Small presentational helpers (kept in-file to keep the dashboard cohesive)
   ──────────────────────────────────────────────────────────────────────────── */

const cardBase = "bg-card rounded-2xl border border-border/60 shadow-sm";

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 mt-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground leading-none">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground font-medium mt-1 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
  onClick,
  tone = "primary",
}: {
  icon: React.ElementType;
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: keyof typeof toneChip;
}) {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border border-border/60 bg-card hover:bg-muted/50 hover:border-primary/40 hover:shadow-sm transition-all group text-center h-full">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${toneChip[tone]}`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <span className="text-[11px] font-bold text-foreground leading-tight">{label}</span>
    </div>
  );
  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return <button onClick={onClick} className="block w-full h-full text-left">{inner}</button>;
}

const toneChip = {
  primary: "bg-primary/10 text-primary",
  gold: "bg-secondary/15 text-secondary",
  green: "bg-emerald-500/10 text-emerald-600",
  red: "bg-destructive/10 text-destructive",
  blue: "bg-blue-500/10 text-blue-600",
  purple: "bg-violet-500/10 text-violet-600",
  cyan: "bg-cyan-500/10 text-cyan-600",
  orange: "bg-orange-500/10 text-orange-600",
} as const;

function StatPill({
  icon: Icon,
  label,
  value,
  tone = "primary",
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: keyof typeof toneChip;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneChip[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-foreground leading-none group-hover:text-primary transition-colors">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </Link>
  );
}

export default function DashboardOverview() {
  const { clients, projects, invoices, subscriptions, leads, team, proformas, packages, services, taskAnalytics, fetchAllData } = useAgencyStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trajectoryView, setTrajectoryView] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    const now = new Date();
    const fourYearsAgo = subYears(now, 4);
    const fromStr = format(startOfYear(fourYearsAgo), "yyyy-MM-dd");
    const toStr = format(endOfYear(now), "yyyy-MM-dd");

    await Promise.all([
      fetchAllData(),
      apiFetch<{ expenses: any[]; total: number }>(`/expenses?from=${fromStr}&to=${toStr}&limit=2000`).then(res => {
        setAllExpenses(res.expenses);
        const currentMonthStart = startOfMonth(now);
        const currentMonthEnd = endOfMonth(now);
        const currentMonthExpenses = res.expenses.filter((e: any) => {
          const d = new Date(e.date);
          return d >= currentMonthStart && d <= currentMonthEnd;
        });
        const totalDollars = currentMonthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0) / 100;
        setMonthlyExpenses(totalDollars);
      }).catch(err => {
        console.error("Failed to load expenses for dashboard overview:", err);
      }),
      apiFetch<{ accounts: any[] }>("/accounts").then(res => {
        setAccounts(res.accounts);
      }).catch(err => {
        console.error("Failed to load accounts for dashboard overview:", err);
      })
    ]);

    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAllData]);

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[^0-9.-]+/g, ""));
  };

  const colorMap = {
    primary: "from-[hsl(var(--primary))] to-[hsl(260,45%,55%)] shadow-primary/20",
    gold: "from-[hsl(var(--secondary))] to-[hsl(38,95%,58%)] shadow-secondary/20",
    accent: "from-[hsl(var(--primary))] to-[hsl(var(--secondary))] shadow-primary/10",
    danger: "from-red-500 to-rose-600 shadow-red-500/20",
  };

  const activeMrr = useMemo(() => {
    return subscriptions
      .filter(s => s.status === 'Active')
      .reduce((sum, s) => {
        const amt = parseFloat((s.amount || '0').toString().replace(/[^0-9.-]+/g, ''));
        if (s.billingCycle === 'Annual') return sum + amt / 12;
        if (s.billingCycle === 'Quarterly') return sum + amt / 3;
        return sum + amt;
      }, 0);
  }, [subscriptions]);

  const netProfitValue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRev = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    return monthlyRev - monthlyExpenses + activeMrr;
  }, [invoices, monthlyExpenses, activeMrr]);

  const profitMarginValue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRev = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    const totalRev = monthlyRev + activeMrr;
    if (totalRev === 0) return 0;
    return Math.round((netProfitValue / totalRev) * 100);
  }, [invoices, netProfitValue, activeMrr]);

  const last3MonthsExpenses = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(subMonths(now, 2));
    const end = endOfMonth(now);
    const exps = allExpenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    const total = exps.reduce((sum, e) => sum + e.amount, 0) / 100;
    return total / 3;
  }, [allExpenses]);

  const growthRate = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRev = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    const lastMonthRev = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === (currentMonth - 1 + 12) % 12)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    if (lastMonthRev === 0) return monthlyRev > 0 ? 100 : 0;
    return Math.round(((monthlyRev - lastMonthRev) / lastMonthRev) * 100);
  }, [invoices]);

  const activeClientsCount = useMemo(() => {
    return clients.filter(c => c.status === 'Active').length;
  }, [clients]);

  const newLeadsThisMonth = useMemo(() => {
    const now = new Date();
    return leads.filter(l => {
      const d = new Date(l.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [leads]);

  const activeProjectsCount = useMemo(() => projects.filter(p => p.status === 'In Progress').length, [projects]);
  const activeTeamCount = useMemo(() => team.filter(m => m.status === 'Active').length, [team]);
  const activeSubsCount = useMemo(() => subscriptions.filter(s => s.status === 'Active').length, [subscriptions]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const activeClients = clients.filter(c => c.status === 'Active').length;

    const monthlyRevenue = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);

    const outstandingAmount = invoices
      .filter(i => i.status !== 'Paid')
      .reduce((sum, i) => {
        let subtotal = 0;
        if (i.items?.length) {
          subtotal = i.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
        } else {
          return sum + (parseCurrency(i.amount) - (i.deposit || 0));
        }
        const rate = i.taxRate ?? 0;
        const tax = (subtotal * rate) / 100;
        const discountAmt = i.discountType === 'percentage'
          ? (subtotal * (i.discount || 0) / 100)
          : (i.discount || 0);
        const total = subtotal + tax - discountAmt;
        return sum + (total - (i.deposit || 0));
      }, 0);

    const mrr = subscriptions
      .filter(s => s.status === 'Active')
      .reduce((sum, s) => {
        const amt = parseCurrency(s.amount);
        if (s.billingCycle === 'Annual') return sum + amt / 12;
        if (s.billingCycle === 'Quarterly') return sum + amt / 3;
        return sum + amt;
      }, 0);

    const revUp = growthRate >= 0;

    return [
      { id: 'revenue', label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), growth: growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`, up: revUp, icon: Banknote, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/invoices' },
      { id: 'mrr', label: 'Active MRR', value: formatCurrency(mrr), icon: TrendingUp, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/subscriptions' },
      { id: 'outstanding', label: 'Outstanding Balance', value: formatCurrency(outstandingAmount), icon: CreditCard, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/invoices' },
      { id: 'expenses', label: 'Monthly Expenses', value: formatCurrency(monthlyExpenses), subText: `Burn rate: ${formatCurrency(last3MonthsExpenses)}/mo`, icon: TrendingDown, gradient: colorMap.danger, hoverBorder: 'hover:border-red-500', link: '/dashboard/expenses' },
      { id: 'netprofit', label: 'Net Profit', value: formatCurrency(netProfitValue), growth: `${profitMarginValue}% Margin`, up: netProfitValue >= 0, icon: Coins, gradient: netProfitValue >= 0 ? colorMap.primary : colorMap.danger, hoverBorder: netProfitValue >= 0 ? 'hover:border-primary' : 'hover:border-red-500', link: '/dashboard/invoices' },
      { id: 'clients', label: 'Active Clients', value: activeClients.toString(), icon: Users, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/clients' },
    ];
  }, [clients, invoices, subscriptions, monthlyExpenses, netProfitValue, profitMarginValue, last3MonthsExpenses, growthRate]);

  const revenueTrend = useMemo(() => {
    const now = new Date();
    let periods: Date[] = [];
    let formatStr = '';

    if (trajectoryView === 'daily') {
      periods = eachDayOfInterval({
        start: startOfMonth(now),
        end: endOfMonth(now)
      });
      formatStr = 'd';
    } else if (trajectoryView === 'weekly') {
      periods = eachWeekOfInterval({
        start: subWeeks(now, 11),
        end: now
      });
      formatStr = 'MMM d';
    } else if (trajectoryView === 'monthly') {
      periods = eachMonthOfInterval({
        start: startOfYear(now),
        end: endOfYear(now)
      });
      formatStr = 'MMM';
    } else { // yearly
      periods = eachYearOfInterval({
        start: subYears(now, 4),
        end: now
      });
      formatStr = 'yyyy';
    }

    return periods.map(period => {
      const label = format(period, formatStr);

      const periodInvoices = invoices.filter(inv => {
        const d = new Date(inv.date);
        if (trajectoryView === 'daily') return isSameDay(d, period);
        if (trajectoryView === 'weekly') return isSameWeek(d, period);
        if (trajectoryView === 'monthly') return isSameMonth(d, period);
        return isSameYear(d, period);
      });

      const paid = periodInvoices
        .filter(inv => inv.status === 'Paid' || inv.status === 'Partially Paid')
        .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);

      const recurring = subscriptions
        .filter(s => {
          const start = new Date(s.startDate);
          const end = s.endDate && s.endDate !== 'N/A' ? new Date(s.endDate) : null;
          const status = s.status === 'Active';
          if (!status) return false;

          let endOfPeriod;
          let startOfPeriod;
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

          // Must have started before or during the period
          const hasStarted = !isAfter(start, endOfPeriod);
          // Must not have ended before the period started
          const hasNotEnded = !end || !isBefore(end, startOfPeriod);

          return hasStarted && hasNotEnded;
        })
        .reduce((sum, s) => {
          const amt = parseCurrency(s.amount);
          let periodAmt = 0;
          if (trajectoryView === 'daily') {
            periodAmt = (s.billingCycle === 'Annual' ? amt / 365 : amt / 30);
          } else if (trajectoryView === 'weekly') {
            periodAmt = (s.billingCycle === 'Annual' ? amt / 52 : amt / 4);
          } else if (trajectoryView === 'monthly') {
            periodAmt = (s.billingCycle === 'Annual' ? amt / 12 : amt);
          } else { // yearly
            periodAmt = (s.billingCycle === 'Annual' ? amt : amt * 12);
          }
          return sum + periodAmt;
        }, 0);

      const periodExpenses = allExpenses.filter(e => {
        const d = new Date(e.date);
        if (trajectoryView === 'daily') return isSameDay(d, period);
        if (trajectoryView === 'weekly') return isSameWeek(d, period);
        if (trajectoryView === 'monthly') return isSameMonth(d, period);
        return isSameYear(d, period);
      });

      const expenses = periodExpenses.reduce((sum, e) => sum + (e.amount / 100), 0);

      return { label, paid, recurring, expenses };
    });
  }, [invoices, subscriptions, allExpenses, trajectoryView]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return allExpenses.filter(e => {
      const d = new Date(e.date);
      if (trajectoryView === 'daily') {
        return isSameMonth(d, now);
      } else if (trajectoryView === 'weekly') {
        const twelveWeeksAgo = subWeeks(now, 12);
        return isAfter(d, twelveWeeksAgo) && isBefore(d, now);
      } else if (trajectoryView === 'monthly') {
        return isSameYear(d, now);
      } else { // yearly
        const fourYearsAgo = subYears(now, 4);
        return d >= startOfYear(fourYearsAgo);
      }
    });
  }, [allExpenses, trajectoryView]);

  const expenseByCategoryData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const amt = e.amount / 100;
      groups[e.category] = (groups[e.category] || 0) + amt;
    });

    return Object.entries(groups).map(([category, amount]) => {
      const meta = EXPENSE_CATEGORIES.find(c => c.value === category) || { label: category, icon: Tag, color: "#9ca3af" };
      return {
        name: meta.label,
        value: Math.round(amount * 100) / 100,
        icon: meta.icon,
        color: meta.color,
      };
    }).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const gatewayReportData = useMemo(() => {
    const groups: Record<string, number> = {};
    let totalCollected = 0;

    invoices.forEach(inv => {
      if (inv.status === 'Paid' || inv.status === 'Partially Paid') {
        const method = inv.paymentMethod || 'Unspecified';
        const amount = inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0);
        groups[method] = (groups[method] || 0) + amount;
        totalCollected += amount;
      }
    });

    const colors = [
      "hsl(var(--primary))",
      "hsl(260, 45%, 55%)",
      "hsl(var(--secondary))",
      "hsl(142, 72%, 29%)",
      "hsl(200, 80%, 40%)",
      "hsl(0, 72%, 51%)",
      "#9ca3af"
    ];

    return Object.entries(groups).map(([gateway, amount], index) => {
      return {
        name: gateway,
        value: Math.round(amount * 100) / 100,
        color: colors[index % colors.length],
        percentage: totalCollected > 0 ? (amount / totalCollected) * 100 : 0
      };
    }).sort((a, b) => b.value - a.value);
  }, [invoices]);

  const activities = useMemo(() => {
    const items: any[] = [];
    invoices.slice(-10).forEach(i => {
      if (i.status === 'Paid') items.push({ icon: CheckCircle2, colorType: 'secondary', action: 'Payment Received', subject: `${i.client} - ${i.amount}`, time: new Date(i.createdAt), link: `/dashboard/invoices/view/${i.id}` });
    });
    clients.slice(-5).forEach(c => items.push({ icon: UserPlus, colorType: 'primary', action: 'New Client Onboarded', subject: c.company || c.name, time: new Date(c.createdAt), link: `/dashboard/clients/view/${c.id}` }));
    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
  }, [clients, invoices]);

  const receivables = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'Overdue' || inv.status === 'Pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5)
      .map(inv => ({
        id: inv.id,
        client: inv.client,
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
        link: `/dashboard/invoices/view/${inv.id}`
      }));
  }, [invoices]);

  const projectHealth = useMemo(() => {
    const total = projects.filter(p => p.status === 'In Progress').length;
    if (total === 0) return { onTrack: 0, delayed: 0, atRisk: 0, total: 0 };
    const onTrack = projects.filter(p => p.status === 'In Progress' && p.progress >= 50).length;
    const delayed = projects.filter(p => p.status === 'In Progress' && p.progress < 30).length;
    return {
      total,
      onTrack: Math.round((onTrack / total) * 100),
      delayed: Math.round((delayed / total) * 100),
      atRisk: 100 - Math.round((onTrack / total) * 100) - Math.round((delayed / total) * 100)
    };
  }, [projects]);

  const quarterlyTarget = useMemo(() => {
    const now = new Date();
    const currentQStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    let qRevenue = 0;
    let lastQRevenue = 0;
    const lastQStart = subMonths(currentQStart, 3);

    invoices.forEach(inv => {
      if (inv.status !== 'Paid' && inv.status !== 'Partially Paid') return;

      const invDate = new Date(inv.date);
      const amount = inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0);

      if (invDate >= currentQStart) {
        qRevenue += amount;
      } else if (invDate >= lastQStart && invDate < currentQStart) {
        lastQRevenue += amount;
      }
    });

    const target = lastQRevenue > 0 ? lastQRevenue * 1.2 : (qRevenue > 0 ? Math.ceil(qRevenue / 10000) * 10000 + 20000 : 50000);
    const progress = Math.min(Math.round((qRevenue / target) * 100), 100);

    let trendText = "Consistent performance based on recent history.";
    if (lastQRevenue > 0) {
      const growth = Math.round(((qRevenue - lastQRevenue) / lastQRevenue) * 100);
      if (growth > 0) trendText = `You are on track to exceed last quarter's performance by ${growth}%.`;
      else if (growth < 0) trendText = `You are currently ${Math.abs(growth)}% behind last quarter's performance.`;
    }

    return {
      current: qRevenue,
      target: target,
      progress: progress,
      label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
      trendText
    };
  }, [invoices]);

  const recentLeads = useMemo(() => {
    return leads
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [leads]);

  /* ── New widget data ─────────────────────────────────────────────────────── */

  // Upcoming: project deadlines, invoices due & subscription renewals in the next 14 days
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const horizon = addDays(now, 14);
    const items: { id: string; title: string; subtitle: string; date: Date; type: string; tone: keyof typeof toneChip; icon: React.ElementType; link: string }[] = [];

    projects.forEach(p => {
      if (p.dueDate && p.status === 'In Progress') {
        const d = new Date(p.dueDate);
        if (!isNaN(d.getTime()) && d <= horizon) {
          items.push({ id: `proj-${p.id}`, title: p.name, subtitle: p.client, date: d, type: 'Deadline', tone: 'purple', icon: Briefcase, link: `/dashboard/projects/view/${p.id}` });
        }
      }
    });

    invoices.forEach(i => {
      if (i.dueDate && i.status !== 'Paid') {
        const d = new Date(i.dueDate);
        if (!isNaN(d.getTime()) && d <= horizon) {
          items.push({ id: `inv-${i.id}`, title: `Invoice · ${formatCurrency(i.amount)}`, subtitle: i.client, date: d, type: 'Invoice', tone: 'gold', icon: FileText, link: `/dashboard/invoices/view/${i.id}` });
        }
      }
    });

    subscriptions.forEach(s => {
      if (s.endDate && s.endDate !== 'N/A' && s.status === 'Active') {
        const d = new Date(s.endDate);
        if (!isNaN(d.getTime()) && d <= horizon) {
          items.push({ id: `sub-${s.id}`, title: `Renewal · ${s.plan}`, subtitle: s.client, date: d, type: 'Renewal', tone: 'blue', icon: CreditCard, link: `/dashboard/subscriptions/view/${s.id}` });
        }
      }
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [projects, invoices, subscriptions]);

  // Active projects sorted by nearest due date
  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status === 'In Progress')
      .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
      .slice(0, 5);
  }, [projects]);

  // Team snapshot + workload (from task analytics)
  const teamSnapshot = useMemo(() => {
    const active = team.filter(m => m.status === 'Active').length;
    const onLeave = team.filter(m => m.status === 'On Leave').length;
    const pending = team.filter(m => m.status === 'Pending Documents' || m.status === 'Draft').length;
    const workload = (taskAnalytics?.workload || []).slice().sort((a, b) => b.count - a.count).slice(0, 5);
    const maxLoad = workload.reduce((m, w) => Math.max(m, w.count), 0);
    return { active, onLeave, pending, total: team.length, workload, maxLoad };
  }, [team, taskAnalytics]);

  // Fulfillment warnings (subscription cycles under 50% complete)
  const warnings = useMemo(() => (taskAnalytics?.warnings || []).slice(0, 4), [taskAnalytics]);

  // Proforma pipeline funnel
  const proformaPipeline = useMemo(() => {
    const buckets = [
      { key: 'Draft', label: 'Draft', tone: 'orange' as const },
      { key: 'Sent', label: 'Sent', tone: 'blue' as const },
      { key: 'Accepted', label: 'Accepted', tone: 'green' as const },
    ];
    const result = buckets.map(b => {
      const rows = proformas.filter(p => p.status === b.key);
      const value = rows.reduce((sum, p) => sum + parseCurrency(p.amount), 0);
      return { ...b, count: rows.length, value };
    });
    const totalValue = result.reduce((s, r) => s + r.value, 0);
    return { result, totalValue, total: proformas.length };
  }, [proformas]);

  // Upcoming subscription renewals (next 30 days)
  const renewals = useMemo(() => {
    const now = new Date();
    const horizon = addDays(now, 30);
    return subscriptions
      .filter(s => {
        if (s.status !== 'Active' || !s.endDate || s.endDate === 'N/A') return false;
        const d = new Date(s.endDate);
        return !isNaN(d.getTime()) && d >= now && d <= horizon;
      })
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 5);
  }, [subscriptions]);

  // Catalog snapshot
  const catalogStats = useMemo(() => {
    const availableServices = services.filter(s => s.status === 'Available').length;
    return { packages: packages.length, services: services.length, availableServices };
  }, [packages, services]);

  // Personalized greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const firstName = (user?.name || '').trim().split(' ')[0] || 'there';
  const todayLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

  const quickActions: { icon: React.ElementType; label: string; to?: string; onClick?: () => void; tone: keyof typeof toneChip }[] = [
    { icon: FileText, label: 'New Invoice', to: '/dashboard/invoices/add', tone: 'gold' as const },
    { icon: FileSignature, label: 'New Proforma', to: '/dashboard/proforma/add', tone: 'orange' as const },
    { icon: UserPlus, label: 'Add Client', to: '/dashboard/clients/add', tone: 'primary' as const },
    { icon: FolderKanban, label: 'New Project', to: '/dashboard/projects/add', tone: 'purple' as const },
    { icon: CreditCard, label: 'New Subscription', to: '/dashboard/subscriptions/add', tone: 'blue' as const },
    { icon: Share2, label: 'Schedule Post', to: '/dashboard/social-media/publish', tone: 'cyan' as const },
    { icon: UserCog, label: 'Add Team', to: '/dashboard/team/add', tone: 'green' as const },
    { icon: Wallet, label: 'Add Expense', onClick: () => setShowAddModal(true), tone: 'red' as const },
    { icon: Send, label: 'Send Files', to: '/dashboard/transfers', tone: 'primary' as const },
    { icon: BarChart3, label: 'Reports', to: '/dashboard/reports/financial', tone: 'gold' as const },
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const dueLabel = (date: Date) => {
    const diff = differenceInCalendarDays(date, new Date());
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: 'Today', overdue: false };
    if (diff === 1) return { text: 'Tomorrow', overdue: false };
    return { text: `In ${diff}d`, overdue: false };
  };

  return (
    <div className="space-y-6 pb-10">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[hsl(260,45%,52%)] p-6 md:p-7 shadow-md">
        <div className="absolute -right-8 -top-10 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-20 top-10 w-64 h-64 rounded-full border-4 border-white/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{todayLabel}</p>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
              {greeting}, {firstName} <span className="inline-block">👋</span>
            </h2>
            <p className="text-sm text-white/80 mt-1.5 font-medium">Here's what's happening across your agency today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl text-xs font-bold h-10 px-4 bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button className="flex items-center gap-2 bg-white hover:bg-white/90 text-primary rounded-xl text-xs font-bold h-10 px-4 shadow-md border-0" asChild>
              <Link to="/dashboard/invoices/add">
                <Plus className="w-3.5 h-3.5" /> New Invoice
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0 bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm" asChild>
              <Link to="/dashboard/settings">
                <Settings className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Launcher ── */}
      <div>
        <SectionHeading icon={Sparkles} title="Quick Actions" subtitle="Jump straight to what you need" />
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          {quickActions.map((qa) => (
            <QuickAction key={qa.label} icon={qa.icon} label={qa.label} to={qa.to} onClick={qa.onClick} tone={qa.tone} />
          ))}
        </div>
      </div>

      {/* ── Business Snapshot ── */}
      <div>
        <SectionHeading icon={Gauge} title="Business Snapshot" subtitle="Your financial & operational pulse this month" />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
          {/* Monthly Revenue */}
          <Link to="/dashboard/invoices" className={`${cardBase} p-5 hover:shadow-md transition-all flex flex-col justify-between group border-b-4 hover:border-b-primary`}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Revenue</p>
              <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground mb-4 group-hover:text-primary transition-colors">
              {stats.find(s => s.id === 'revenue')?.value || formatCurrency(0)}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${growthRate >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                {growthRate >= 0 ? '+' : ''}{growthRate}%
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">from last month</span>
            </div>
          </Link>

          {/* Monthly Expenses */}
          <Link to="/dashboard/expenses" className={`${cardBase} p-5 hover:shadow-md transition-all flex flex-col justify-between group border-b-4 hover:border-b-primary`}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Expenses</p>
              <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground mb-4 group-hover:text-primary transition-colors">{formatCurrency(monthlyExpenses)}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-semibold">Burn rate {formatCurrency(last3MonthsExpenses)}/mo</span>
            </div>
          </Link>

          {/* Net Profit */}
          <Link to="/dashboard/invoices" className={`${netProfitValue >= 0 ? 'bg-[hsl(140_35%_40%)]/5 border-[hsl(140_35%_40%)]/20' : 'bg-destructive/5 border-destructive/20'} hover:border-b-primary rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border-b-4`}>
            <div className="flex justify-between items-start mb-2">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${netProfitValue >= 0 ? 'text-[hsl(140_35%_40%)]' : 'text-destructive'}`}>Net Profit</p>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${netProfitValue >= 0 ? 'bg-[hsl(140_35%_40%)]/20 text-[hsl(140_35%_40%)]' : 'bg-destructive/20 text-destructive'}`}>
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <h3 className={`text-2xl font-black mb-4 transition-colors ${netProfitValue >= 0 ? 'text-[hsl(140_35%_40%)] group-hover:text-primary' : 'text-destructive group-hover:text-primary'}`}>
              {netProfitValue >= 0 ? '' : '-'}{formatCurrency(Math.abs(netProfitValue))}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${netProfitValue >= 0 ? 'bg-[hsl(140_35%_40%)]/20 text-[hsl(140_35%_40%)]' : 'bg-destructive/20 text-destructive'}`}>
                {netProfitValue >= 0 ? '+' : '-'}{Math.abs(profitMarginValue)}% margin
              </span>
              <span className={`text-[10px] font-semibold ${netProfitValue >= 0 ? 'text-[hsl(140_35%_40%)]/70' : 'text-destructive/70'}`}>this month</span>
            </div>
          </Link>

          {/* Outstanding Balance */}
          <Link to="/dashboard/invoices" className={`${cardBase} p-5 hover:shadow-md transition-all flex flex-col justify-between group border-b-4 hover:border-b-primary`}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Outstanding</p>
              <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-foreground mb-4 group-hover:text-primary transition-colors">
              {stats.find(s => s.id === 'outstanding')?.value || formatCurrency(0)}
            </h3>
            <div className="flex items-center gap-2">
              {receivables.length > 0 && (
                <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded">{receivables.length} unpaid</span>
              )}
              <span className="text-[10px] text-muted-foreground font-semibold">invoices pending</span>
            </div>
          </Link>
        </div>

        {/* Secondary stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <StatPill icon={TrendingUp} label="Active MRR" value={formatCurrency(activeMrr)} tone="primary" to="/dashboard/subscriptions" />
          <StatPill icon={Users} label="Active Clients" value={activeClientsCount} tone="blue" to="/dashboard/clients" />
          <StatPill icon={Briefcase} label="Active Projects" value={activeProjectsCount} tone="purple" to="/dashboard/projects" />
          <StatPill icon={CreditCard} label="Active Subs" value={activeSubsCount} tone="green" to="/dashboard/subscriptions" />
          <StatPill icon={UserCog} label="Team Members" value={activeTeamCount} tone="orange" to="/dashboard/team" />
          <StatPill icon={Target} label="New Leads (mo)" value={newLeadsThisMonth} tone="gold" to="/dashboard/leads" />
        </div>
      </div>

      {/* ── Financial Performance ── */}
      <div>
        <SectionHeading
          icon={CircleDollarSign}
          title="Financial Performance"
          subtitle="Revenue, expenses & collections"
          action={
            <Link to="/dashboard/reports/financial" className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 group shrink-0">
              Full Report <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          {/* Left: Revenue Trajectory (takes 2/3 width) */}
          <div className={`xl:col-span-2 ${cardBase} p-6`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
              <div>
                <h3 className="text-base font-bold text-foreground">Revenue & Expenses</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Financial performance over time</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={trajectoryView} onValueChange={(v) => setTrajectoryView(v as any)}>
                  <SelectTrigger size="xs" className="w-auto min-w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="h-[280px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="secGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="destGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : `${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", padding: '10px', background: 'hsl(var(--card))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 700, fontSize: '12px', color: 'hsl(var(--foreground))' }}
                    formatter={(v: number) => [formatCurrency(v), '']}
                  />
                  <Area type="monotone" dataKey="paid" name="Paid Revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#mainGrad)" />
                  <Area type="monotone" dataKey="recurring" name="Recurring" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#secGrad)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#destGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="absolute -bottom-2 left-0 right-0 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expenses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recurring</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Receivables sidebar */}
          <div className={`${cardBase} p-6 flex flex-col justify-between`}>
            <div>
              <div className="flex items-center gap-2 mb-6">
                <h4 className="text-base font-bold text-foreground">Receivables</h4>
                <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full">{receivables.length}</span>
              </div>
              {receivables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50 mb-2" />
                  <p className="text-sm font-bold text-emerald-600/70 italic">All clear — no outstanding invoices!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receivables.map(inv => {
                    const isOverdue = inv.status === 'Overdue';
                    return (
                      <Link key={inv.id} to={inv.link} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{inv.client}</p>
                            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>Due {formatDate(inv.dueDate)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">{formatCurrency(parseCurrency(inv.amount))}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                            {inv.status}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-border/60 flex justify-center">
              <Link to="/dashboard/invoices" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 group">
                View All Invoices <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Financial detail row: Expense Hub / Gateways / Ops+Target / Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mt-4 md:mt-6">

          {/* Col 1: Expense Hub */}
          <div className={`${cardBase} p-6 flex flex-col justify-between`}>
            <Tabs defaultValue="breakdown" className="w-full h-full flex flex-col">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-base font-bold text-foreground">Expense Hub</h3>
                <TabsList className="h-7 p-0.5 bg-muted rounded-lg">
                  <TabsTrigger value="breakdown" className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">Breakdown</TabsTrigger>
                  <TabsTrigger value="trends" className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">Trends</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="breakdown" className="mt-0 flex-1 flex flex-col justify-center focus-visible:outline-none">
                {expenseByCategoryData.length > 0 ? (
                  <div className="flex flex-col items-center gap-6 py-2">
                    <div className="w-[180px] h-[180px] shrink-0 mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expenseByCategoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                            {expenseByCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", padding: "8px", fontSize: '12px', background: 'hsl(var(--card))' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full space-y-3">
                      {expenseByCategoryData.slice(0, 3).map((item, index) => {
                        const total = expenseByCategoryData.reduce((a, c) => a + c.value, 0);
                        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                        return (
                          <div key={index} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black text-foreground">{formatCurrency(item.value)}</span>
                              <span className="text-[10px] font-bold text-muted-foreground w-6 text-right">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <TrendingDown className="w-8 h-8 opacity-20 mb-2" />
                    <span className="text-sm font-semibold">No expense data</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trends" className="mt-0 flex-1 focus-visible:outline-none">
                <div className="h-[200px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${v / 1000}k` : `$${v}`} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", padding: '8px', background: 'hsl(var(--card))' }}
                        itemStyle={{ fontWeight: 700, fontSize: '11px', color: 'hsl(var(--foreground))' }}
                        formatter={(v: number) => [formatCurrency(v), 'Expenses']}
                      />
                      <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Col 2: Payment Gateways */}
          <div className={`${cardBase} p-6 flex flex-col justify-between`}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" /> Payment Gateways
                </h3>
                <Link to="/dashboard/reports/financial" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">
                  Reports
                </Link>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {gatewayReportData.length > 0 ? (
                  <div className="flex flex-col items-center gap-6 py-2">
                    <div className="w-[180px] h-[180px] shrink-0 mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gatewayReportData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                            {gatewayReportData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", padding: "8px", fontSize: '12px', background: 'hsl(var(--card))' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full space-y-3">
                      {gatewayReportData.slice(0, 3).map((item, index) => {
                        const total = gatewayReportData.reduce((a, c) => a + c.value, 0);
                        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                        return (
                          <div key={index} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black text-foreground">{formatCurrency(item.value)}</span>
                              <span className="text-[10px] font-bold text-muted-foreground w-6 text-right">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <CreditCard className="w-8 h-8 opacity-20 mb-2" />
                    <span className="text-sm font-semibold">No gateway data</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Col 3: Ops Pulse + Revenue Target stacked */}
          <div className="space-y-4 md:space-y-6">
            {/* Ops Pulse */}
            <div className={`${cardBase} p-6 flex flex-col justify-between min-h-[160px]`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-foreground">Ops Pulse</h4>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                </div>
                <Link to="/dashboard/projects" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">
                  Projects
                </Link>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground">{projectHealth.total}</h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Active Projects</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
                    <span className="text-muted-foreground">On Track</span>
                    <span className="text-primary">{projectHealth.onTrack}%</span>
                  </div>
                  <Progress value={projectHealth.onTrack} className="h-1.5 bg-muted" indicatorClassName="bg-primary" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
                    <span className="text-muted-foreground">At Risk</span>
                    <span className="text-destructive">{projectHealth.atRisk}%</span>
                  </div>
                  <Progress value={projectHealth.atRisk} className="h-1.5 bg-muted" indicatorClassName="bg-destructive" />
                </div>
              </div>
            </div>

            {/* Revenue Target */}
            <div className="bg-primary rounded-2xl p-6 shadow-md border border-primary/20 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-4 border-white/10 opacity-50 pointer-events-none" />
              <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border-4 border-white/10 opacity-50 pointer-events-none" />
              <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full border-4 border-white/10 opacity-50 pointer-events-none" />

              <div className="flex items-center justify-between mb-4 relative z-10">
                <h4 className="text-base font-bold text-primary-foreground">Revenue Target</h4>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">{quarterlyTarget.label}</span>
              </div>

              <div className="flex items-end gap-2 mb-2 relative z-10">
                <p className="text-3xl font-black text-primary-foreground">{quarterlyTarget.progress}%</p>
                <p className="text-[10px] font-bold text-primary-foreground/70 uppercase tracking-widest mb-1">of {formatCurrency(quarterlyTarget.target)}</p>
              </div>
              <Progress value={quarterlyTarget.progress} className="h-1.5 bg-black/20 mb-4 relative z-10" indicatorClassName="bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />

              <p className="text-[10px] font-bold text-primary-foreground/80 relative z-10 max-w-[90%] leading-relaxed">{quarterlyTarget.trendText}</p>
            </div>
          </div>

          {/* Col 4: Leads & Recent Activity Tabs */}
          <div className={`${cardBase} p-6 flex flex-col h-full`}>
            <Tabs defaultValue="activity" className="w-full h-full flex flex-col">
              <div className="flex gap-4 border-b border-border mb-4">
                <TabsList className="h-auto p-0 bg-transparent gap-4 w-full justify-start">
                  <TabsTrigger value="activity" className="text-[10px] uppercase tracking-widest font-bold bg-transparent shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 text-muted-foreground">Recent Activity</TabsTrigger>
                  <TabsTrigger value="leads" className="text-[10px] uppercase tracking-widest font-bold bg-transparent shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 text-muted-foreground">Lead Pipeline</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="activity" className="mt-0 flex-1 focus-visible:outline-none">
                <div className="space-y-4">
                  {activities.length > 0 ? activities.map((act, i) => (
                    <Link key={i} to={act.link} className="flex items-center gap-3 group">
                      <div className={`w-8 h-8 rounded-full ${act.colorType === 'primary' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'} flex items-center justify-center shrink-0`}>
                        {act.colorType === 'primary' ? <Users className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{act.subject}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{act.action}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-bold uppercase tracking-widest">{formatDistanceToNow(act.time)} ago</span>
                    </Link>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                      No recent activity yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="leads" className="mt-0 flex-1 focus-visible:outline-none">
                <div className="space-y-4">
                  {recentLeads.length > 0 ? (
                    recentLeads.map((lead) => (
                      <Link key={lead.id} to="/dashboard/leads" className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{lead.email || 'Unknown'}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">New lead onboarded</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-bold uppercase tracking-widest">{formatDistanceToNow(new Date(lead.createdAt))} ago</span>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Contact className="w-7 h-7 opacity-20 mx-auto mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No recent leads</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ── Operations & Delivery ── */}
      <div>
        <SectionHeading
          icon={ClipboardList}
          title="Operations & Delivery"
          subtitle="Deadlines, projects, team workload & delivery risks"
          action={
            <Link to="/dashboard/calendar" className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 group shrink-0">
              Open Calendar <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
          {/* Upcoming (next 14 days) */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" /> Upcoming
              </h4>
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">14 days</span>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3 flex-1">
                {upcomingEvents.map(ev => {
                  const due = dueLabel(ev.date);
                  return (
                    <Link key={ev.id} to={ev.link} className="flex items-center gap-3 group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneChip[ev.tone]}`}>
                        <ev.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{ev.title}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{ev.subtitle}</p>
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${due.overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{due.text}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-center text-muted-foreground">
                <CalendarClock className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs font-semibold">Nothing due in the next 14 days</p>
              </div>
            )}
          </div>

          {/* Active Projects */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-violet-600" /> Active Projects
              </h4>
              <Link to="/dashboard/projects" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">All</Link>
            </div>
            {activeProjects.length > 0 ? (
              <div className="space-y-4 flex-1">
                {activeProjects.map(p => {
                  const due = p.dueDate ? dueLabel(new Date(p.dueDate)) : null;
                  return (
                    <Link key={p.id} to={`/dashboard/projects/view/${p.id}`} className="block group">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</p>
                        {due && (
                          <span className={`text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded uppercase tracking-wider ${due.overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{due.text}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="h-1.5 bg-muted flex-1" indicatorClassName={p.progress >= 50 ? 'bg-primary' : p.progress < 30 ? 'bg-destructive' : 'bg-secondary'} />
                        <span className="text-[10px] font-bold text-muted-foreground w-8 text-right">{p.progress}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-center text-muted-foreground">
                <FolderKanban className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs font-semibold mb-3">No active projects</p>
                <Link to="/dashboard/projects/add" className="text-[11px] font-bold text-primary hover:underline">+ New Project</Link>
              </div>
            )}
          </div>

          {/* Team Workload */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserCog className="w-4 h-4 text-emerald-600" /> Team
              </h4>
              <Link to="/dashboard/team" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">Manage</Link>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <p className="text-lg font-black text-foreground leading-none">{teamSnapshot.active}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Active</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <p className="text-lg font-black text-secondary leading-none">{teamSnapshot.onLeave}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">On Leave</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <p className="text-lg font-black text-orange-500 leading-none">{teamSnapshot.pending}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Pending</p>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Active Task Load</p>
            {teamSnapshot.workload.length > 0 ? (
              <div className="space-y-2.5 flex-1">
                {teamSnapshot.workload.map(w => (
                  <div key={w.id} className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-foreground truncate w-20 shrink-0">{w.name}</span>
                    <Progress value={teamSnapshot.maxLoad > 0 ? (w.count / teamSnapshot.maxLoad) * 100 : 0} className="h-1.5 bg-muted flex-1" indicatorClassName="bg-emerald-500" />
                    <span className="text-[10px] font-bold text-muted-foreground w-4 text-right">{w.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center py-4 text-muted-foreground">
                <p className="text-xs font-semibold">No active task assignments</p>
              </div>
            )}
          </div>

          {/* Fulfillment Warnings */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Delivery Risks
              </h4>
              <Link to="/dashboard/social-media" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">Tasks</Link>
            </div>
            {warnings.length > 0 ? (
              <div className="space-y-4 flex-1">
                {warnings.map(w => (
                  <Link key={w.id} to="/dashboard/social-media" className="block group">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{w.client}</p>
                      <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{w.progress}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={w.progress} className="h-1.5 bg-muted flex-1" indicatorClassName="bg-destructive" />
                      <span className="text-[10px] font-bold text-muted-foreground shrink-0">{w.completed}/{w.total}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-muted-foreground truncate mt-1">{w.plan} · {w.label}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50 mb-2" />
                <p className="text-xs font-bold text-emerald-600/70 italic">All deliveries on track!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sales Pipeline & Catalog ── */}
      <div>
        <SectionHeading icon={Layers} title="Sales Pipeline & Catalog" subtitle="Quotes, renewals & what you sell" />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {/* Proforma Pipeline */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-orange-500" /> Proforma Pipeline
              </h4>
              <Link to="/dashboard/proforma" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">All</Link>
            </div>

            <div className="space-y-4 flex-1">
              {proformaPipeline.result.map(b => {
                const pct = proformaPipeline.total > 0 ? Math.round((b.count / proformaPipeline.total) * 100) : 0;
                return (
                  <div key={b.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black ${toneChip[b.tone]}`}>{b.count}</span>
                        <span className="text-[13px] font-bold text-foreground">{b.label}</span>
                      </div>
                      <span className="text-xs font-black text-foreground">{formatCurrency(b.value)}</span>
                    </div>
                    <Progress value={pct} className="h-1.5 bg-muted" indicatorClassName={b.tone === 'green' ? 'bg-emerald-500' : b.tone === 'blue' ? 'bg-blue-500' : 'bg-orange-500'} />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pipeline Value</span>
              <span className="text-sm font-black text-foreground">{formatCurrency(proformaPipeline.totalValue)}</span>
            </div>
          </div>

          {/* Subscription Renewals */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-blue-600" /> Renewals
              </h4>
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">30 days</span>
            </div>
            {renewals.length > 0 ? (
              <div className="space-y-3.5 flex-1">
                {renewals.map(s => {
                  const due = dueLabel(new Date(s.endDate));
                  return (
                    <Link key={s.id} to={`/dashboard/subscriptions/view/${s.id}`} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{s.client}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{s.plan}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black text-foreground">{formatCurrency(s.amount)}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${due.overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{due.text}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-center text-muted-foreground">
                <Hourglass className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs font-semibold">No renewals in the next 30 days</p>
              </div>
            )}
          </div>

          {/* Catalog Snapshot */}
          <div className={`${cardBase} p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <Boxes className="w-4 h-4 text-primary" /> Catalog
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Link to="/dashboard/packages" className="rounded-xl border border-border/60 p-4 hover:border-primary/40 hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <PackageIcon className="w-4 h-4" />
                </div>
                <p className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">{catalogStats.packages}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Packages</p>
              </Link>
              <Link to="/dashboard/services" className="rounded-xl border border-border/60 p-4 hover:border-primary/40 hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center mb-3">
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">{catalogStats.services}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Services</p>
              </Link>
            </div>

            <div className="rounded-xl bg-muted/50 p-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Available services
              </span>
              <span className="text-sm font-black text-foreground">{catalogStats.availableServices}</span>
            </div>

            <div className="mt-auto pt-4 flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-lg text-[11px] font-bold h-9" asChild>
                <Link to="/dashboard/packages/add"><Plus className="w-3 h-3 mr-1" /> Package</Link>
              </Button>
              <Button variant="outline" size="sm" className="flex-1 rounded-lg text-[11px] font-bold h-9" asChild>
                <Link to="/dashboard/services/add"><Plus className="w-3 h-3 mr-1" /> Service</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <QuickAddExpenseModal
          accounts={accounts}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            await loadData(true);
          }}
        />
      )}
    </div>
  );
}
