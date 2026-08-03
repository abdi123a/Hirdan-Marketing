import {
  Wallet,
  TrendingDown,
  Coins,
  Clock,
  ChevronRight,
  RefreshCw,
  Plus,
  Settings,
  FileText,
  CheckCircle2,
  CircleDollarSign,
  CalendarClock,
  FolderKanban,
  AlertTriangle,
  Users,
  Briefcase,
  UserPlus,
  FileSignature,
  CreditCard,
  Share2,
  UserCog,
  BarChart3,
  ClipboardList,
  TrendingUp,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { cardBase, SectionHeading, QuickAction, KpiCard, DashboardHero, StatPill, toneChip, type ToneKey } from "./shared";

export type AdminDashboardProps = {
  greeting: string;
  firstName: string;
  todayLabel: string;
  roleLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onAddExpense: () => void;
  growthRate: number;
  monthlyExpenses: number;
  last3MonthsExpenses: number;
  netProfitValue: number;
  profitMarginValue: number;
  revenueValue: string;
  outstandingValue: string;
  unpaidCount: number;
  expensesAvailable: boolean;
  activeMrr: number;
  activeClientsCount: number;
  activeProjectsCount: number;
  activeSubsCount: number;
  activeTeamCount: number;
  newLeadsThisMonth: number;
  showTeamStat: boolean;
  showLeadsStat: boolean;
  trajectoryView: "daily" | "weekly" | "monthly" | "yearly";
  setTrajectoryView: (v: "daily" | "weekly" | "monthly" | "yearly") => void;
  revenueTrend: { label: string; paid: number; recurring: number; expenses: number }[];
  receivables: {
    id: string;
    client: string;
    amount: string;
    status: string;
    dueDate: string;
    link: string;
  }[];
  parseCurrency: (val: string) => number;
  upcomingEvents: {
    id: string;
    title: string;
    subtitle: string;
    date: Date;
    type: string;
    tone: ToneKey;
    icon: React.ElementType;
    link: string;
  }[];
  activeProjects: {
    id: string;
    name: string;
    dueDate?: string;
    progress: number;
  }[];
  warnings: { id: string; client: string; progress: number; completed: number; total: number; plan: string; label: string }[];
  activities: { icon: React.ElementType; colorType: string; action: string; subject: string; time: Date; link: string }[];
  quarterlyTarget: { current: number; target: number; progress: number; label: string; trendText: string };
  dueLabel: (date: Date) => { text: string; overdue: boolean };
  canWriteExpense: boolean;
  canWriteInvoice: boolean;
  canWriteProforma: boolean;
  canWriteClient: boolean;
  canWriteProject: boolean;
  canReadReports: boolean;
  canWriteSocial: boolean;
  canReadSettings: boolean;
};

export function AdminFinanceDashboard(p: AdminDashboardProps) {
  const quickActions = [
    p.canWriteInvoice && { icon: FileText, label: "New Invoice", to: "/dashboard/invoices/add", tone: "gold" as const },
    p.canWriteProforma && { icon: FileSignature, label: "New Proforma", to: "/dashboard/proforma/add", tone: "orange" as const },
    p.canWriteClient && { icon: UserPlus, label: "Add Client", to: "/dashboard/clients/add", tone: "primary" as const },
    p.canWriteProject && { icon: FolderKanban, label: "New Project", to: "/dashboard/projects/add", tone: "purple" as const },
    p.canWriteExpense && { icon: Wallet, label: "Add Expense", onClick: p.onAddExpense, tone: "red" as const },
    p.canWriteSocial && { icon: Share2, label: "Schedule Post", to: "/dashboard/social-media/publish", tone: "cyan" as const },
    p.canReadReports && { icon: BarChart3, label: "Reports", to: "/dashboard/reports/financial", tone: "gold" as const },
  ].filter(Boolean) as { icon: React.ElementType; label: string; to?: string; onClick?: () => void; tone: ToneKey }[];

  return (
    <div className="w-full space-y-6 md:space-y-8 pb-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <DashboardHero
        eyebrow={p.todayLabel}
        title={
          <>
            {p.greeting}, {p.firstName}
          </>
        }
        subtitle={`${p.roleLabel} overview — money first, then what needs attention.`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={p.onRefresh}
              disabled={p.isRefreshing}
              className="rounded-xl text-xs font-bold h-10 px-4 bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${p.isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {p.canWriteInvoice && (
              <Button className="rounded-xl text-xs font-bold h-10 px-4 bg-white hover:bg-white/90 text-primary border-0 shadow-md" asChild>
                <Link to="/dashboard/invoices/add">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  New Invoice
                </Link>
              </Button>
            )}
            {p.canReadSettings && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl h-10 w-10 bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm"
                asChild
              >
                <Link to="/dashboard/settings">
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Money KPIs */}
      <section>
        <SectionHeading icon={CircleDollarSign} title="This month" subtitle="Live numbers from your invoices, subscriptions, and expenses" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Monthly revenue"
            value={p.revenueValue}
            to="/dashboard/invoices"
            icon={Wallet}
            tone="gold"
            hint={
              <span className="flex items-center gap-2">
                <span
                  className={`font-bold px-1.5 py-0.5 rounded ${
                    p.growthRate >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {p.growthRate >= 0 ? "+" : ""}
                  {p.growthRate}%
                </span>
                vs last month
              </span>
            }
          />
          {p.expensesAvailable ? (
            <KpiCard
              label="Monthly expenses"
              value={formatCurrency(p.monthlyExpenses)}
              to="/dashboard/expenses"
              icon={TrendingDown}
              tone="red"
              hint={`Burn rate ${formatCurrency(p.last3MonthsExpenses)}/mo`}
            />
          ) : (
            <KpiCard
              label="Active MRR"
              value={formatCurrency(p.activeMrr)}
              to="/dashboard/subscriptions"
              icon={TrendingUp}
              tone="primary"
              hint="Recurring revenue from active plans"
            />
          )}
          <KpiCard
            label={p.expensesAvailable ? "Net profit" : "Revenue + MRR"}
            value={`${p.netProfitValue < 0 ? "-" : ""}${formatCurrency(Math.abs(p.netProfitValue))}`}
            to="/dashboard/invoices"
            icon={Coins}
            tone={p.netProfitValue >= 0 ? "green" : "red"}
            accent={p.netProfitValue >= 0 ? "profit" : "loss"}
            hint={
              p.expensesAvailable
                ? `${Math.abs(p.profitMarginValue)}% margin this month`
                : "Expenses unavailable for your role"
            }
          />
          <KpiCard
            label="Outstanding"
            value={p.outstandingValue}
            to="/dashboard/invoices"
            icon={Clock}
            tone="gold"
            accent={p.unpaidCount > 0 ? "warn" : undefined}
            hint={
              p.unpaidCount > 0
                ? `${p.unpaidCount} unpaid invoice${p.unpaidCount > 1 ? "s" : ""}`
                : "All clear"
            }
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          {p.expensesAvailable && (
            <StatPill icon={TrendingUp} label="Active MRR" value={formatCurrency(p.activeMrr)} tone="primary" to="/dashboard/subscriptions" />
          )}
          <StatPill icon={Users} label="Active clients" value={p.activeClientsCount} tone="blue" to="/dashboard/clients" />
          <StatPill icon={Briefcase} label="Active projects" value={p.activeProjectsCount} tone="purple" to="/dashboard/projects" />
          <StatPill icon={CreditCard} label="Active subs" value={p.activeSubsCount} tone="green" to="/dashboard/subscriptions" />
          {p.showTeamStat && (
            <StatPill icon={UserCog} label="Team members" value={p.activeTeamCount} tone="orange" to="/dashboard/team" />
          )}
          {p.showLeadsStat && (
            <StatPill icon={Target} label="New leads (mo)" value={p.newLeadsThisMonth} tone="gold" to="/dashboard/leads" />
          )}
        </div>
      </section>

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <section>
          <SectionHeading icon={ClipboardList} title="Quick actions" subtitle="Common tasks for your role" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-3">
            {quickActions.map((qa) => (
              <QuickAction key={qa.label} {...qa} />
            ))}
          </div>
        </section>
      )}

      {/* Chart + receivables */}
      <section>
        <SectionHeading
          icon={CircleDollarSign}
          title="Financial performance"
          subtitle="Revenue, expenses & collections"
          action={
            p.canReadReports ? (
              <Link
                to="/dashboard/reports/financial"
                className="text-[12px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 group shrink-0"
              >
                Full report <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : undefined
          }
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          <div className={`xl:col-span-2 ${cardBase} p-5 md:p-6`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Revenue & expenses</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Trend over time</p>
              </div>
              <Select value={p.trajectoryView} onValueChange={(v) => p.setTrajectoryView(v as any)}>
                <SelectTrigger size="xs" className="w-auto min-w-[90px]">
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
            <div className="h-[260px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={p.revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
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
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      padding: "10px",
                      background: "hsl(var(--card))",
                    }}
                    itemStyle={{ fontWeight: 600, fontSize: "12px", color: "hsl(var(--foreground))" }}
                    formatter={(v: number) => [formatCurrency(v), ""]}
                  />
                  <Area type="monotone" dataKey="paid" name="Paid revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#mainGrad)" />
                  <Area type="monotone" dataKey="recurring" name="Recurring" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#secGrad)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#destGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="absolute -bottom-1 left-0 right-0 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Paid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Expenses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Recurring</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${cardBase} p-5 md:p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-bold text-foreground">Receivables</h4>
              <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {p.unpaidCount}
              </span>
            </div>
            {p.receivables.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-2" />
                <p className="text-sm font-semibold text-emerald-700/80">No outstanding invoices</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {p.receivables.map((inv) => {
                  const isOverdue = inv.status === "Overdue";
                  return (
                    <Link key={inv.id} to={inv.link} className="flex items-center justify-between group gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {inv.client}
                          </p>
                          <p className={`text-[11px] font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                            Due {formatDate(inv.dueDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black tabular-nums">{formatCurrency(p.parseCurrency(inv.amount))}</p>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-border/60 flex justify-center">
              <Link to="/dashboard/invoices" className="text-xs font-semibold text-primary flex items-center gap-1 group">
                View all invoices <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Needs attention + quarterly target */}
      <section>
        <SectionHeading
          icon={AlertTriangle}
          title="Needs attention"
          subtitle="Deadlines, delivery risks, and quarter progress"
          action={
            <Link to="/dashboard/calendar" className="text-[12px] font-semibold text-primary flex items-center gap-1 group">
              Calendar <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className={`${cardBase} p-5 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" /> Upcoming
              </h4>
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">14 days</span>
            </div>
            {p.upcomingEvents.length > 0 ? (
              <div className="space-y-3 flex-1">
                {p.upcomingEvents.slice(0, 5).map((ev) => {
                  const due = p.dueLabel(ev.date);
                  return (
                    <Link key={ev.id} to={ev.link} className="flex items-center gap-3 group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneChip[ev.tone]}`}>
                        <ev.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${
                          due.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {due.text}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-muted-foreground">
                <CalendarClock className="w-7 h-7 opacity-30 mb-2" />
                <p className="text-xs font-medium">Nothing due soon</p>
              </div>
            )}
          </div>

          <div className={`${cardBase} p-5 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-violet-600" /> Active projects
              </h4>
              <Link to="/dashboard/projects" className="text-[11px] font-semibold text-primary">
                All
              </Link>
            </div>
            {p.activeProjects.length > 0 ? (
              <div className="space-y-4 flex-1">
                {p.activeProjects.slice(0, 4).map((proj) => {
                  const due = proj.dueDate ? p.dueLabel(new Date(proj.dueDate)) : null;
                  return (
                    <Link key={proj.id} to={`/dashboard/projects/view/${proj.id}`} className="block group">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{proj.name}</p>
                        {due && (
                          <span
                            className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${
                              due.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {due.text}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={proj.progress}
                          className="h-1.5 bg-muted flex-1"
                          indicatorClassName={proj.progress >= 50 ? "bg-primary" : proj.progress < 30 ? "bg-destructive" : "bg-secondary"}
                        />
                        <span className="text-[10px] font-bold text-muted-foreground w-8 text-right tabular-nums">{proj.progress}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-muted-foreground">
                <Briefcase className="w-7 h-7 opacity-30 mb-2" />
                <p className="text-xs font-medium">No active projects</p>
              </div>
            )}
          </div>

          <div className={`${cardBase} p-5 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Delivery risks
              </h4>
            </div>
            {p.warnings.length > 0 ? (
              <div className="space-y-4 flex-1">
                {p.warnings.map((w) => (
                  <Link key={w.id} to="/dashboard/social-media" className="block group">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{w.client}</p>
                      <span className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        {w.progress}%
                      </span>
                    </div>
                    <Progress value={w.progress} className="h-1.5 bg-muted" indicatorClassName="bg-destructive" />
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {w.plan} · {w.label}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-8">
                <CheckCircle2 className="w-7 h-7 text-emerald-500/60 mb-2" />
                <p className="text-xs font-semibold text-emerald-700/80">Deliveries on track</p>
              </div>
            )}
          </div>

          <div className="bg-primary rounded-2xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full border-4 border-white/10 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-primary-foreground">Revenue target</h4>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{p.quarterlyTarget.label}</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl font-black text-primary-foreground tabular-nums">{p.quarterlyTarget.progress}%</p>
                <p className="text-[11px] font-semibold text-primary-foreground/70 mb-1">
                  of {formatCurrency(p.quarterlyTarget.target)}
                </p>
              </div>
              <Progress
                value={p.quarterlyTarget.progress}
                className="h-1.5 bg-black/20 mb-4"
                indicatorClassName="bg-white"
              />
              <p className="text-[11px] font-medium text-primary-foreground/80 leading-relaxed">{p.quarterlyTarget.trendText}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Activity */}
      <section>
        <SectionHeading icon={Users} title="Recent activity" subtitle="Latest payments and new clients" />
        <div className={`${cardBase} p-5`}>
          {p.activities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {p.activities.map((act, i) => (
                <Link key={i} to={act.link} className="flex items-center gap-3 group rounded-xl px-2 py-2 hover:bg-muted/40 transition-colors">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      act.colorType === "primary" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                    }`}
                  >
                    {act.colorType === "primary" ? <Users className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{act.subject}</p>
                    <p className="text-[11px] text-muted-foreground">{act.action}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(act.time)} ago</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
