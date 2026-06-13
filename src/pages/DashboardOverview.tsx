import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Banknote,
  Users,
  Briefcase,
  TrendingUp,
  Activity,
  Clock,
  Plus,
  Building2,
  UserPlus,
  CreditCard,
  Layers,
  AlertCircle,
  Calendar,
  FileText,
  Package,
  Zap,
  CheckCircle2,
  Hourglass,
  ShieldCheck,
  Server,
  Database,
  RefreshCw,
  Bell,
  Mail,
  ChevronRight,
  PieChart as PieChartIcon,
  MoreVertical,
  Settings,
  ArrowUpRight,
  TrendingDown,
  Target,
  Rocket,
  Shield,
  Zap as ZapIcon,
  Crown,
  Sparkles,
  Loader2,
  BarChart2,
  HeartPulse,
  Layout
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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
  isSameYear
} from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardOverview() {
  const { clients, projects, invoices, subscriptions, team, proformas, fetchAllData } = useAgencyStore();
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
    const monthlyRevenue = invoices
      .filter(inv => inv.status === 'Paid' && new Date(inv.date).getMonth() === currentMonth && new Date(inv.date).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + parseCurrency(inv.amount), 0);
    const lastMonthRevenue = invoices
      .filter(inv => inv.status === 'Paid' && new Date(inv.date).getMonth() === (currentMonth - 1 + 12) % 12)
      .reduce((sum, inv) => sum + parseCurrency(inv.amount), 0);
    const revenueDiff = monthlyRevenue - lastMonthRevenue;
    const revUp = revenueDiff >= 0;

    const outstandingAmount = invoices
      .filter(i => i.status !== 'Paid')
      .reduce((sum, i) => sum + parseCurrency(i.amount), 0);

    const activeProjectsCount = projects.filter(p => p.status === 'In Progress').length;
    
    const mrr = subscriptions
      .filter(s => s.status === 'Active')
      .reduce((sum, s) => {
        const amt = parseCurrency(s.amount);
        if (s.billingCycle === 'Annual') return sum + amt / 12;
        if (s.billingCycle === 'Quarterly') return sum + amt / 3;
        return sum + amt;
      }, 0);

    const totalPossibleProjects = (team.length || 1) * 4;
    const utilization = Math.min(Math.round((projects.filter(p => p.status === 'In Progress').length / totalPossibleProjects) * 100), 100);

    return [
      { id: 'revenue', label: 'Revenue', value: formatCurrency(monthlyRevenue), growth: revUp ? '+14%' : '-2%', up: revUp, icon: Banknote, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/invoices' },
      { id: 'clients', label: 'Clients', value: activeClients.toString(), growth: '+3', up: true, icon: Users, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/clients' },
      { id: 'mrr', label: 'Active MRR', value: formatCurrency(mrr), icon: TrendingUp, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/subscriptions' },
      { id: 'outstanding', label: 'Unpaid', value: formatCurrency(outstandingAmount), icon: CreditCard, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/invoices' },
      { id: 'projects', label: 'Projects', value: activeProjectsCount.toString(), icon: Briefcase, gradient: colorMap.primary, hoverBorder: 'hover:border-primary', link: '/dashboard/projects' },
      { id: 'utilization', label: 'Team Load', value: `${utilization}%`, icon: Activity, gradient: colorMap.gold, hoverBorder: 'hover:border-secondary', link: '/dashboard/team' },
    ];
  }, [clients, invoices, projects, subscriptions, team]);

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
        .filter(inv => inv.status === 'Paid')
        .reduce((sum, inv) => sum + parseCurrency(inv.amount), 0);

      const recurring = subscriptions
        .filter(s => {
          if (s.status !== 'Active') return false;
          const start = new Date(s.started);
          // The subscription must have already started by the beginning of this period
          let periodStart: Date;
          if (trajectoryView === 'daily') periodStart = period;
          else if (trajectoryView === 'weekly') periodStart = startOfWeek(period);
          else if (trajectoryView === 'monthly') periodStart = startOfMonth(period);
          else periodStart = startOfYear(period);

          if (isAfter(start, periodStart)) return false; // not started yet in this period

          // If there's a renewal/end date, the subscription must not have expired before this period
          if (s.renewal && s.renewal !== 'N/A') {
            const renewal = new Date(s.renewal);
            if (isBefore(renewal, periodStart)) return false; // already ended
          }
          return true;
        })
        .reduce((sum, s) => {
          const amt = parseCurrency(s.amount);
          let periodAmt = 0;
          if (trajectoryView === 'daily') {
            periodAmt = (s.billingCycle === 'Annual' ? amt / 365 : s.billingCycle === 'Quarterly' ? amt / 91 : amt / 30);
          } else if (trajectoryView === 'weekly') {
            periodAmt = (s.billingCycle === 'Annual' ? amt / 52 : s.billingCycle === 'Quarterly' ? amt / 13 : amt / 4);
          } else if (trajectoryView === 'monthly') {
            periodAmt = (s.billingCycle === 'Annual' ? amt / 12 : s.billingCycle === 'Quarterly' ? amt / 3 : amt);
          } else { // yearly
            periodAmt = (s.billingCycle === 'Annual' ? amt : s.billingCycle === 'Quarterly' ? amt * 4 : amt * 12);
          }
          return sum + periodAmt;
        }, 0);

      return { label, paid, recurring };
    });
  }, [invoices, subscriptions, trajectoryView]);

  const projectHealth = useMemo(() => {
    const total = projects.filter(p => p.status === 'In Progress').length;
    if (total === 0) return { onTrack: 0, delayed: 0, atRisk: 0 };
    const onTrack = projects.filter(p => p.status === 'In Progress' && p.progress >= 50).length;
    const delayed = projects.filter(p => p.status === 'In Progress' && p.progress < 30).length;
    return { 
      onTrack: Math.round((onTrack / total) * 100),
      delayed: Math.round((delayed / total) * 100),
      atRisk: 100 - Math.round((onTrack / total) * 100) - Math.round((delayed / total) * 100)
    };
  }, [projects]);

  const activities = useMemo(() => {
    const items: any[] = [];
    invoices.slice(-5).forEach(i => {
      if (i.status === 'Paid') items.push({ icon: CheckCircle2, colorType: 'secondary', action: 'Payment', subject: `${i.client}`, time: new Date(i.createdAt), link: `/dashboard/invoices/view/${i.id}` });
    });
    clients.slice(-3).forEach(c => items.push({ icon: UserPlus, colorType: 'primary', action: 'New Client', subject: c.company || c.name, time: new Date(c.createdAt), link: `/dashboard/clients/view/${c.id}` }));
    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
  }, [clients, invoices]);

  const alerts = useMemo(() => {
    return invoices.filter(inv => inv.status === 'Overdue').slice(0, 5).map(inv => ({
      id: inv.id,
      title: 'Invoice Overdue',
      desc: `${inv.client} · ${inv.amount}`,
      link: `/dashboard/invoices/view/${inv.id}`
    }));
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 text-primary animate-spin opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header section with More Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Track and manage your agency pulse and performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/dashboard/projects/add" className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> New Project
          </Link>
          <Link to="/dashboard/invoices/add" className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
            <CreditCard className="w-4 h-4 text-secondary" /> New Invoice
          </Link>
          <Link to="/dashboard/clients/add" className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
            <UserPlus className="w-4 h-4 text-primary" /> Add Client
          </Link>
          <Link to="/dashboard/settings" className="p-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-xl transition-all">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {stats.map((stat) => (
          <Link key={stat.id} to={stat.link} className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group border-b-4 ${stat.hoverBorder}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.gradient} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.growth && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${stat.up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {stat.up ? "+" : "-"}{stat.growth}
                </span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{stat.label}</p>
              <h3 className="text-xl font-bold text-foreground mt-2 tracking-tight group-hover:text-primary transition-colors">{stat.value}</h3>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground">Revenue Trajectory</h3>
                <p className="text-xs text-muted-foreground mt-1">Detailed monthly analysis using agency primary brand colors</p>
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
                  <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${v/1000}k` : `$${v}`} />
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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-md font-bold text-foreground font-display">Recent Activity</h4>
                <Button variant="ghost" size="sm" asChild className="text-xs font-bold text-primary uppercase tracking-wider">
                  <Link to="/dashboard/invoices">View All</Link>
                </Button>
              </div>
              <div className="space-y-4">
                {activities.map((act, i) => (
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
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
              <h4 className="text-md font-bold text-foreground mb-6">Efficiency Matrix</h4>
              <div className="space-y-6">
                {[
                  { label: 'Collection Rate', value: '92%', progress: 92, color: 'bg-primary', icon: ArrowUpRight },
                  { label: 'Team Capacity', value: '78%', progress: 78, color: 'bg-secondary', icon: TrendingDown },
                  { label: 'Customer Retention', value: '95%', progress: 95, color: 'bg-primary', icon: ArrowUpRight },
                ].map((m, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        {m.label} <m.icon className="h-3 w-3 opacity-50" />
                      </span>
                      <span className={m.color === 'bg-primary' ? 'text-primary' : 'text-secondary'}>{m.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${m.color} transition-all duration-1000`} style={{ width: `${m.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* NEW FEATURE: Project Delivery Pulse */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12" />
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <HeartPulse className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-md font-bold text-foreground leading-none">Delivery Pulse</h4>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Real-time status</p>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[10px] uppercase font-black px-2 py-0.5 tracking-wider">Stable</Badge>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>On Track</span>
                    <span className="text-primary">{projectHealth.onTrack}%</span>
                  </div>
                  <Progress value={projectHealth.onTrack} className="h-1.5 bg-muted" indicatorClassName="bg-primary" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>At Risk</span>
                    <span className="text-secondary">{projectHealth.atRisk}%</span>
                  </div>
                  <Progress value={projectHealth.atRisk} className="h-1.5 bg-muted" indicatorClassName="bg-secondary" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-dashed border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-left">
                    <p className="text-2xl font-black text-foreground">{(projects.filter(p => p.status === 'In Progress').length)}</p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Deliveries</p>
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
              <span className="text-[10px] font-black text-muted-foreground uppercase">Q1 2026</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-1">
                <p className="text-3xl font-black text-foreground">84%</p>
                <p className="text-xs font-bold text-muted-foreground mb-1">Target: $1.2M</p>
              </div>
              <Progress value={84} className="h-3 bg-muted" indicatorClassName="bg-secondary" />
              <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed uppercase tracking-wider">You are on track to exceed last quarter's performance by 12%.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-destructive" />
              <h4 className="text-md font-bold text-foreground">Action Items</h4>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center italic">No urgent items found.</p>
            ) : (
              <div className="space-y-4">
                {alerts.map(alert => (
                  <Link key={alert.id} to={alert.link} className="block p-4 rounded-xl bg-muted/20 border border-border hover:border-primary/20 hover:bg-primary/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Priority</p>
                      <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alert.desc}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
