import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Banknote,
  Users,
  Briefcase,
  TrendingUp,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Settings,
  Target,
  UserPlus,
  ArrowUpRight,
  TrendingDown,
  Contact,
  Activity,
  Plus,
  Flame,
  Coins,
  Percent,
  PiggyBank
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
import { Badge } from "@/components/ui/badge";
import { useAgencyStore } from "@/lib/store";
import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
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
  subMonths
} from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardOverview() {
  const { clients, projects, invoices, subscriptions, leads, fetchAllData } = useAgencyStore();
  const [isLoading, setIsLoading] = useState(true);
  const [trajectoryView, setTrajectoryView] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
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
    };
    loadData();
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

  const netProfitValue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRev = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    return monthlyRev - monthlyExpenses;
  }, [invoices, monthlyExpenses]);

  const profitMarginValue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRev = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    if (monthlyRev === 0) return 0;
    return Math.round((netProfitValue / monthlyRev) * 100);
  }, [invoices, netProfitValue]);

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
      const meta = EXPENSE_CATEGORIES.find(c => c.value === category) || { label: category, emoji: "📦", color: "#9ca3af" };
      return {
        name: meta.label,
        value: Math.round(amount * 100) / 100,
        emoji: meta.emoji,
        color: meta.color,
      };
    }).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 text-primary animate-spin opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your agency's financial & operational snapshot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all h-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary" /> Add Expense
          </Button>
          <Link to="/dashboard/invoices/add" className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-primary/20">
            <Plus className="w-3.5 h-3.5" /> New Invoice
          </Link>
          <Link to="/dashboard/clients/add" className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
            <UserPlus className="w-3.5 h-3.5 text-primary" /> Add Client
          </Link>
          <Link to="/dashboard/settings" className="p-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl transition-all">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── Row 1: 4 KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Revenue */}
        <Link to="/dashboard/invoices" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group border-b-4 hover:border-secondary">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(38,95%,58%)] rounded-xl flex items-center justify-center text-white shadow-md">
              <Banknote className="w-5 h-5" />
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${growthRate >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {growthRate >= 0 ? '↑' : '↓'} {Math.abs(growthRate)}%
            </span>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Monthly Revenue</p>
          <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors truncate">
            {stats.find(s => s.id === 'revenue')?.value}
          </h3>
        </Link>

        {/* Monthly Expenses */}
        <Link to="/dashboard/expenses" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group border-b-4 hover:border-red-400">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Monthly Expenses</p>
          <h3 className="text-xl font-black text-foreground group-hover:text-red-500 transition-colors truncate">
            {formatCurrency(monthlyExpenses)}
          </h3>
        </Link>

        {/* Net Profit */}
        <Link to="/dashboard/invoices" className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group border-b-4 ${netProfitValue >= 0 ? 'hover:border-primary' : 'hover:border-red-400'}`}>
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${netProfitValue >= 0 ? 'from-[hsl(var(--primary))] to-[hsl(260,45%,55%)]' : 'from-red-500 to-rose-600'} rounded-xl flex items-center justify-center text-white shadow-md`}>
              <Coins className="w-5 h-5" />
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${netProfitValue >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {profitMarginValue}% margin
            </span>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Net Profit</p>
          <h3 className={`text-xl font-black transition-colors truncate ${netProfitValue >= 0 ? 'text-foreground group-hover:text-primary' : 'text-red-500'}`}>
            {formatCurrency(netProfitValue)}
          </h3>
        </Link>

        {/* Outstanding Balance */}
        <Link to="/dashboard/invoices" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group border-b-4 hover:border-secondary">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(38,95%,58%)] rounded-xl flex items-center justify-center text-white shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            {receivables.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">
                {receivables.length} unpaid
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Outstanding</p>
          <h3 className="text-xl font-black text-foreground group-hover:text-secondary transition-colors truncate">
            {stats.find(s => s.id === 'outstanding')?.value}
          </h3>
        </Link>
      </div>

      {/* ── Secondary Metrics Strip ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap items-center gap-0 divide-x divide-border/50">
        {/* Active MRR */}
        <Link to="/dashboard/subscriptions" className="flex items-center gap-3 pr-6 hover:opacity-80 transition-opacity group">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active MRR</p>
            <p className="text-base font-black text-foreground group-hover:text-primary transition-colors">{formatCurrency(activeMrr)}</p>
          </div>
        </Link>
        {/* Active Clients */}
        <Link to="/dashboard/clients" className="flex items-center gap-3 px-6 hover:opacity-80 transition-opacity group">
          <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Clients</p>
            <p className="text-base font-black text-foreground group-hover:text-secondary transition-colors">{activeClientsCount}</p>
          </div>
        </Link>
        {/* New Leads This Month */}
        <Link to="/dashboard/leads" className="flex items-center gap-3 pl-6 hover:opacity-80 transition-opacity group">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">New Leads · This Month</p>
            <p className="text-base font-black text-foreground group-hover:text-emerald-600 transition-colors">{newLeadsThisMonth}</p>
          </div>
        </Link>
      </div>

      {/* ── Row 2: Main Content Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Revenue Trajectory (takes 2/3 width) */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-foreground">Revenue & Expenses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Paid revenue vs recurring vs spending</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={trajectoryView} onValueChange={(v: any) => setTrajectoryView(v)}>
                <TabsList className="h-8 p-1 bg-muted/50 rounded-lg">
                  <TabsTrigger value="daily" className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Month</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Yearly</TabsTrigger>
                  <TabsTrigger value="yearly" className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">All Time</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Paid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Recurring</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Expenses</span>
                </div>
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${v / 1000}k` : `$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", padding: '10px', background: 'hsl(var(--card))' }}
                  itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                  formatter={(v: number) => [formatCurrency(v), '']}
                />
                <Area type="monotone" dataKey="paid" name="Paid Revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#mainGrad)" />
                <Area type="monotone" dataKey="recurring" name="Recurring" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#secGrad)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#destGrad)" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Receivables sidebar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2.5 mb-5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <h4 className="text-base font-bold text-foreground">Receivables</h4>
          </div>
          {receivables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50 mb-2" />
              <p className="text-sm font-bold text-emerald-600/70 italic">All clear — no outstanding invoices!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {receivables.map(inv => {
                const isOverdue = inv.status === 'Overdue';
                return (
                  <Link key={inv.id} to={inv.link} className={`block p-3.5 rounded-xl border transition-all ${isOverdue ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10' : 'bg-muted/20 border-border hover:bg-primary/5'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isOverdue ? 'text-destructive' : 'text-primary'}`}>
                        {isOverdue && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
                        {inv.status}
                      </span>
                      <span className="text-sm font-black text-foreground">{inv.amount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground truncate pr-2">{inv.client}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold shrink-0">Due {formatDate(inv.dueDate)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-dashed border-border/60">
            <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider h-9 gap-1.5 group" asChild>
              <Link to="/dashboard/invoices">
                View All Invoices <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Row 3: Expense Hub & Stacked Sidebar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Expense Hub (2/3 width) */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <Tabs defaultValue="breakdown" className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Expense Hub</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Analyze spending trends and category breakdown</p>
              </div>
              <TabsList className="h-8 p-1 bg-muted/50 rounded-lg">
                <TabsTrigger value="breakdown" className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Breakdown</TabsTrigger>
                <TabsTrigger value="trends" className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Trends</TabsTrigger>
              </TabsList>
            </div>

            {/* Breakdown Content */}
            <TabsContent value="breakdown" className="mt-0 focus-visible:outline-none">
              {expenseByCategoryData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
                  <div className="w-[160px] h-[160px] shrink-0 mx-auto sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expenseByCategoryData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value">
                          {expenseByCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", padding: "8px", fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2.5 w-full">
                    {expenseByCategoryData.slice(0, 5).map((item, index) => {
                      const total = expenseByCategoryData.reduce((a, c) => a + c.value, 0);
                      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                      return (
                        <div key={index} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{item.emoji}</span>
                            <span className="text-xs font-semibold text-muted-foreground truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-foreground">{formatCurrency(item.value)}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                    {expenseByCategoryData.length > 5 && (
                      <p className="text-[10px] text-muted-foreground/70 font-bold italic">+{expenseByCategoryData.length - 5} more categories</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingDown className="w-8 h-8 opacity-20 mb-2" />
                  <span className="text-sm font-semibold">No expense data in this period</span>
                </div>
              )}
            </TabsContent>

            {/* Trends Content */}
            <TabsContent value="trends" className="mt-0 focus-visible:outline-none">
              <div className="h-[180px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${v / 1000}k` : `$${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", padding: '8px', background: 'hsl(var(--card))' }}
                      itemStyle={{ fontWeight: 700, fontSize: '11px' }}
                      formatter={(v: number) => [formatCurrency(v), 'Expenses']}
                    />
                    <Bar dataKey="expenses" fill="hsl(var(--destructive))" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Project Pulse + Revenue Target stacked (1/3 width) */}
        <div className="space-y-6">
          {/* Ops Pulse */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-foreground">Ops Pulse</h4>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Project health</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[9px] uppercase font-black px-2">Live</Badge>
                <Button variant="outline" size="sm" asChild className="h-7 px-2.5 rounded-lg border-border text-xs font-bold">
                  <Link to="/dashboard/projects">Manage</Link>
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  <span>On Track</span>
                  <span className="text-primary">{projectHealth.onTrack}%</span>
                </div>
                <Progress value={projectHealth.onTrack} className="h-1.5 bg-muted" indicatorClassName="bg-primary" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  <span>At Risk</span>
                  <span className="text-secondary">{projectHealth.atRisk}%</span>
                </div>
                <Progress value={projectHealth.atRisk} className="h-1.5 bg-muted" indicatorClassName="bg-secondary" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-dashed border-border/60 flex items-center gap-2">
              <p className="text-2xl font-black text-foreground">{projectHealth.total}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">active projects</p>
            </div>
          </div>

          {/* Revenue Target */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-secondary" />
                <h4 className="text-sm font-bold text-foreground">Revenue Target</h4>
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase">{quarterlyTarget.label}</span>
            </div>
            <div className="flex justify-between items-end mb-2">
              <p className="text-2xl font-black text-foreground">{quarterlyTarget.progress}%</p>
              <p className="text-xs font-bold text-muted-foreground">Target: {formatCurrency(quarterlyTarget.target)}</p>
            </div>
            <Progress value={quarterlyTarget.progress} className="h-2.5 bg-muted" indicatorClassName="bg-secondary" />
            <p className="text-[10px] font-semibold text-muted-foreground mt-2 uppercase tracking-wide">{quarterlyTarget.trendText}</p>
          </div>
        </div>

      </div>

      {/* ── Row 4: Leads & Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Lead Pipeline */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-base font-bold text-foreground">Lead Pipeline</h4>
            <Button variant="ghost" size="sm" asChild className="text-xs font-bold text-primary uppercase tracking-wider h-auto p-0">
              <Link to="/dashboard/leads">View all →</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {recentLeads.length > 0 ? (
              recentLeads.map((lead) => (
                <Link key={lead.id} to="/dashboard/leads" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-all border border-transparent hover:border-border group">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{lead.email}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">Received {formatDate(lead.createdAt)}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider border-0 shrink-0 ml-2 ${lead.status.toLowerCase() === 'new' ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {lead.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Contact className="w-7 h-7 opacity-20 mx-auto mb-2" />
                <p className="text-sm font-semibold">No recent leads</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h4 className="text-base font-bold text-foreground mb-5">Recent Activity</h4>
          <div className="space-y-3">
            {activities.length > 0 ? activities.map((act, i) => (
              <Link key={i} to={act.link} className="flex items-center gap-3 group p-2 rounded-xl hover:bg-muted/30 transition-all">
                <div className={`w-9 h-9 rounded-xl ${act.colorType === 'primary' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'} flex items-center justify-center shrink-0`}>
                  <act.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{act.subject}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">{act.action} · {formatDistanceToNow(act.time)} ago</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
              </Link>
            )) : (
              <div className="text-center py-8 text-muted-foreground text-sm font-semibold">
                No recent activity yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <QuickAddExpenseModal
          accounts={accounts}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            setIsLoading(true);
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
              }).catch(err => console.error(err)),
              apiFetch<{ accounts: any[] }>("/accounts").then(res => setAccounts(res.accounts)).catch(err => console.error(err))
            ]);
            setIsLoading(false);
          }}
        />
      )}
    </div>
  );
}

