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
  PiggyBank,
  Tag,
  FileText,
  Clock,
  Wallet
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your agency's financial & operational snapshot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider h-10 px-4 bg-background border-border hover:bg-muted text-foreground"
          >
            <Plus className="w-3.5 h-3.5 text-primary" /> Add Expense
          </Button>
          <Button variant="outline" className="flex items-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider h-10 px-4 bg-background border-border hover:bg-muted text-foreground" asChild>
            <Link to="/dashboard/clients/add">
              <UserPlus className="w-3.5 h-3.5 text-foreground" /> Add Client
            </Link>
          </Button>
          <Button className="flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider h-10 px-4 shadow-md shadow-primary/20 border-0" asChild>
            <Link to="/dashboard/invoices/add">
              <Plus className="w-3.5 h-3.5" /> New Invoice
            </Link>
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0 bg-background border-border hover:bg-muted text-foreground" asChild>
            <Link to="/dashboard/settings">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Summary Bar ── */}
      <div className="bg-white rounded-full border border-gray-100 px-6 py-3 flex flex-wrap items-center gap-4 sm:gap-6 shadow-sm w-full">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50"></div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Active MRR</span>
          <span className="text-sm font-black ml-1 text-foreground">{formatCurrency(activeMrr)}</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-gray-100"></div>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Active Clients</span>
          <span className="text-sm font-black ml-1 text-foreground">{activeClientsCount}</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-gray-100"></div>
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">New Leads This Month</span>
          <span className="text-sm font-black ml-1 text-foreground">{newLeadsThisMonth}</span>
        </div>
      </div>

      {/* ── Row 1: 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Monthly Revenue */}
        <Link to="/dashboard/invoices" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border-b-4 hover:border-primary">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Revenue</p>
            <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
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
        <Link to="/dashboard/expenses" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border-b-4 hover:border-primary">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Expenses</p>
            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-foreground mb-4 group-hover:text-primary transition-colors">{formatCurrency(monthlyExpenses)}</h3>
          <div className="flex items-center gap-2">
             <span className="text-[10px] text-muted-foreground font-semibold">Operating costs</span>
          </div>
        </Link>

        {/* Net Profit */}
        <Link to="/dashboard/invoices" className={`${netProfitValue >= 0 ? 'bg-[hsl(140_35%_40%)]/5 border-[hsl(140_35%_40%)]/20' : 'bg-destructive/5 border-destructive/20'} hover:border-primary rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border-b-4`}>
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
             <span className={`text-[10px] font-semibold ${netProfitValue >= 0 ? 'text-[hsl(140_35%_40%)]/70' : 'text-destructive/70'}`}>burn rate</span>
          </div>
        </Link>

        {/* Outstanding Balance */}
        <Link to="/dashboard/invoices" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border-b-4 hover:border-primary">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Outstanding</p>
            <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
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

      {/* ── Row 2: Main Content Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Revenue Trajectory (takes 2/3 width) */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <h3 className="text-base font-bold text-foreground">Revenue & Expenses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Financial performance over time</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                className="text-[10px] font-bold uppercase tracking-wider bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-foreground"
                value={trajectoryView}
                onChange={(e) => setTrajectoryView(e.target.value as any)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <h4 className="text-base font-bold text-foreground">Receivables</h4>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{receivables.length}</span>
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
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
            <Link to="/dashboard/invoices" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
              View All Invoices <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 3: 3 Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Col 1: Expense Hub */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
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

        {/* Col 2: Project Pulse + Revenue Target stacked */}
        <div className="space-y-6">
          {/* Ops Pulse */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <h4 className="text-base font-bold text-foreground">Ops Pulse</h4>
                 <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              </div>
              <Link to="/dashboard/projects" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary/80">
                 Manage Projects
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
            {/* decorative circle */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-4 border-white/10 opacity-50 pointer-events-none" />
            <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border-4 border-white/10 opacity-50 pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full border-4 border-white/10 opacity-50 pointer-events-none" />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <h4 className="text-base font-bold text-primary-foreground">Q3 Revenue Target</h4>
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

        {/* Col 3: Leads & Recent Activity Tabs */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
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
                             <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{lead.email || lead.name || 'Unknown'}</p>
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

