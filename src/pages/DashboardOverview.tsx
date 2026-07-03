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
  Plus
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
  AreaChart
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { useAgencyStore } from "@/lib/store";
import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils";
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

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchAllData();
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
  };

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const activeClients = clients.filter(c => c.status === 'Active').length;
    const newLeads = leads.filter(l => new Date(l.createdAt).getMonth() === currentMonth && new Date(l.createdAt).getFullYear() === currentYear).length;

    const monthlyRevenue = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);

    const lastMonthRevenue = invoices
      .filter(inv => (inv.status === 'Paid' || inv.status === 'Partially Paid') && new Date(inv.date).getMonth() === (currentMonth - 1 + 12) % 12)
      .reduce((sum, inv) => sum + (inv.status === 'Paid' ? parseCurrency(inv.amount) : (inv.deposit || 0)), 0);
    const revenueDiff = monthlyRevenue - lastMonthRevenue;
    const revUp = revenueDiff >= 0;

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

    return [
      { id: 'revenue', label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), growth: revUp ? 'UP' : 'DOWN', up: revUp, icon: Banknote, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/invoices' },
      { id: 'mrr', label: 'Active MRR', value: formatCurrency(mrr), icon: TrendingUp, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/subscriptions' },
      { id: 'outstanding', label: 'Outstanding Balance', value: formatCurrency(outstandingAmount), icon: CreditCard, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/invoices' },
      { id: 'clients', label: 'Active Clients', value: activeClients.toString(), icon: Users, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/clients' },
      { id: 'leads', label: 'New Leads (This Month)', value: newLeads.toString(), icon: Contact, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/leads' },
    ];
  }, [clients, invoices, projects, subscriptions, leads]);

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

      return { label, paid, recurring };
    });
  }, [invoices, subscriptions, trajectoryView]);

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
    <div className="space-y-8 pb-10">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">High-level financial and operational insights driving your agency.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/dashboard/invoices/add" className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
          <Link to="/dashboard/clients/add" className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
            <UserPlus className="w-4 h-4 text-primary" /> Add Client
          </Link>
          <Link to="/dashboard/settings" className="p-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-xl transition-all">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((stat) => (
          <Link key={stat.id} to={stat.link} className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group border-b-4 ${stat.hoverBorder}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.gradient} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.growth && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${stat.up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {stat.up ? "↑ " : "↓ "}{stat.growth}
                </span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-2">{stat.label}</p>
              <h3 className="text-2xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{stat.value}</h3>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-8">

        {/* Left Column (Main Charts & Growth) */}
        <div className="col-span-12 lg:col-span-8 space-y-8">

          {/* Revenue Trajectory */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground">Revenue Trajectory</h3>
                <p className="text-xs text-muted-foreground mt-1">Detailed analysis of Paid vs Recurring revenue</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Tabs value={trajectoryView} onValueChange={(v: any) => setTrajectoryView(v)} className="w-full sm:w-[320px]">
                  <TabsList className="grid w-full grid-cols-4 h-8 p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger value="daily" className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Month</TabsTrigger>
                    <TabsTrigger value="weekly" className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">Yearly</TabsTrigger>
                    <TabsTrigger value="yearly" className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">All Time</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="hidden sm:flex items-center gap-4 border-l border-border pl-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recurring</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="secGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${v / 1000}k` : `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)", padding: '12px', background: 'hsl(var(--card))' }}
                    itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                    formatter={(v: number) => [formatCurrency(v), '']}
                  />
                  <Area type="monotone" dataKey="paid" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#mainGrad)" />
                  <Area type="monotone" dataKey="recurring" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#secGrad)" strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Leads & Growth Pipeline */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-md font-bold text-foreground font-display">New Lead Pipeline</h4>
                <Button variant="ghost" size="sm" asChild className="text-xs font-bold text-primary uppercase tracking-wider">
                  <Link to="/dashboard/leads">Manage Leads</Link>
                </Button>
              </div>
              <div className="space-y-4">
                {recentLeads.length > 0 ? (
                  recentLeads.map((lead) => (
                    <Link key={lead.id} to={`/dashboard/leads`} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-muted/30 transition-all border border-transparent hover:border-border text-left group">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-bold text-foreground truncate">{lead.email}</span>
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider border-0 ${lead.status.toLowerCase() === 'new' ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                          {lead.status}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center justify-between w-full font-semibold">
                        Received {formatDate(lead.createdAt)}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center">
                    <Contact className="w-8 h-8 opacity-20 mb-2" />
                    <span>No recent leads</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-md font-bold text-foreground font-display">Recent Activity</h4>
              </div>
              <div className="space-y-4">
                {activities.length > 0 ? activities.map((act, i) => (
                  <Link key={i} to={act.link} className="flex items-center gap-4 group p-2 rounded-xl hover:bg-muted/30 transition-all text-left">
                    <div className={`w-10 h-10 rounded-xl ${act.colorType === 'primary' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'} flex items-center justify-center shrink-0`}>
                      <act.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{act.subject}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">{act.action} · {formatDistanceToNow(act.time)} ago</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </Link>
                )) : (
                  <div className="text-center py-6 text-muted-foreground text-sm font-semibold">
                    No recent activity yet.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Right Column (Receivables & Pulse) */}
        <div className="col-span-12 lg:col-span-4 space-y-8">

          {/* Receivables & Cash Flow */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <h4 className="text-md font-bold text-foreground">Receivables & Cash Flow</h4>
            </div>

            <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-4 tracking-wider">Top Outstanding Invoices</p>
            {receivables.length === 0 ? (
              <p className="text-sm text-emerald-600/70 py-6 text-center italic font-bold">All invoices paid. Outstanding pipeline clear!</p>
            ) : (
              <div className="space-y-3">
                {receivables.map(inv => {
                  const isOverdue = inv.status === 'Overdue';
                  return (
                    <Link key={inv.id} to={inv.link} className={`block p-4 rounded-xl border transition-all ${isOverdue ? 'bg-destructive/5 border-destructive/20 hover:border-destructive/40 hover:bg-destructive/10' : 'bg-muted/20 border-border hover:border-primary/30 hover:bg-primary/5'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isOverdue ? 'text-destructive flex items-center gap-1.5' : 'text-primary'}`}>
                          {isOverdue && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}{inv.status}
                        </span>
                        <span className="text-sm font-black text-foreground">{inv.amount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-foreground truncate">{inv.client}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">Due {formatDate(inv.dueDate)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-dashed border-border/80">
              <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider gap-2 h-10 border-border group" asChild>
                <Link to="/dashboard/invoices">
                  View All Receivables <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Project Delivery Pulse (Simplified) */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12" />
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <h4 className="text-md font-bold text-foreground leading-none">Ops Delivery Pulse</h4>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Project Status Summary</p>
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[10px] uppercase font-black px-2 py-0.5 tracking-wider">Live</Badge>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>On Track</span>
                    <span className="text-primary">{projectHealth.onTrack}%</span>
                  </div>
                  <Progress value={projectHealth.onTrack} className="h-2 bg-muted" indicatorClassName="bg-primary" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>At Risk / Delayed</span>
                    <span className="text-secondary">{projectHealth.atRisk}%</span>
                  </div>
                  <Progress value={projectHealth.atRisk} className="h-2 bg-muted" indicatorClassName="bg-secondary" />
                </div>
              </div>

              <div className="pt-4 border-t border-dashed border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-left">
                    <p className="text-3xl font-black text-foreground">{projectHealth.total}</p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest cursor-default">Active Projects</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="h-9 px-3 rounded-xl border-border hover:bg-primary/5 group">
                    <Link to="/dashboard/projects" className="flex items-center gap-2 text-xs font-bold text-foreground">
                      Manage <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-secondary" />
                <h4 className="text-md font-bold text-foreground font-display">Revenue Target</h4>
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase">{quarterlyTarget.label}</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-1">
                <p className="text-3xl font-black text-foreground">{quarterlyTarget.progress}%</p>
                <p className="text-xs font-bold text-muted-foreground mb-1">Target: {formatCurrency(quarterlyTarget.target)}</p>
              </div>
              <Progress value={quarterlyTarget.progress} className="h-3 bg-muted" indicatorClassName="bg-secondary" />
              <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed uppercase tracking-wider">{quarterlyTarget.trendText}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
