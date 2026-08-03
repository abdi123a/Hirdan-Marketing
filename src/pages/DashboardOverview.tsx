import {
  Briefcase,
  CreditCard,
  CheckCircle2,
  UserPlus,
  FileText,
} from "lucide-react";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { usePermissions } from "@/hooks/usePermissions";
import { DashboardSkeleton } from "@/components/ui/PageSkeleton";
import { useMemo, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { QuickAddExpenseModal } from "@/components/QuickAddExpenseModal";
import { AdminFinanceDashboard } from "@/components/dashboard/AdminFinanceDashboard";
import { StaffWorkDashboard } from "@/components/dashboard/StaffWorkDashboard";
import type { ToneKey } from "@/components/dashboard/shared";
import {
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
  differenceInCalendarDays,
} from "date-fns";

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC off-by-one). */
function parseLocalDate(value?: string | null): Date | null {
  if (!value || value === "N/A") return null;
  const datePart = String(value).split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameLocalMonth(date: Date, ref: Date) {
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
}

export default function DashboardOverview() {
  const { clients, projects, invoices, subscriptions, leads, team, taskAnalytics, fetchAllData } = useAgencyStore();
  const { user } = useAuthStore();
  const { canWrite, canRead } = usePermissions();
  // Work-focused home when user is staff OR lacks finance modules
  const isStaffView =
    user?.role === "staff" ||
    (!canRead("invoices") && !canRead("financial_reports"));
  const canLoadExpenses = canRead("expenses");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trajectoryView, setTrajectoryView] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [expensesAvailable, setExpensesAvailable] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    const now = new Date();
    const fourYearsAgo = subYears(now, 4);
    const fromStr = format(startOfYear(fourYearsAgo), "yyyy-MM-dd");
    const toStr = format(endOfYear(now), "yyyy-MM-dd");

    const tasks: Promise<unknown>[] = [fetchAllData()];

    if (canLoadExpenses) {
      tasks.push(
        apiFetch<{ expenses: any[]; total: number }>(`/expenses?from=${fromStr}&to=${toStr}&limit=2000`)
          .then((res) => {
            setAllExpenses(res.expenses || []);
            setExpensesAvailable(true);
            const currentMonthStart = startOfMonth(now);
            const currentMonthEnd = endOfMonth(now);
            const currentMonthExpenses = (res.expenses || []).filter((e: any) => {
              const d = parseLocalDate(e.date);
              return d && d >= currentMonthStart && d <= currentMonthEnd;
            });
            const totalDollars = currentMonthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0) / 100;
            setMonthlyExpenses(totalDollars);
          })
          .catch((err) => {
            console.error("Failed to load expenses for dashboard overview:", err);
            setExpensesAvailable(false);
            setAllExpenses([]);
            setMonthlyExpenses(0);
          })
      );

      if (canWrite("expenses")) {
        tasks.push(
          apiFetch<{ accounts: any[] }>("/accounts")
            .then((res) => setAccounts(res.accounts || []))
            .catch((err) => console.error("Failed to load accounts for dashboard overview:", err))
        );
      }
    } else {
      setExpensesAvailable(false);
      setAllExpenses([]);
      setMonthlyExpenses(0);
    }

    await Promise.all(tasks);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAllData, canLoadExpenses]);

  const parseCurrency = (val: string | number) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === "number") return val;
    return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
  };

  const activeMrr = useMemo(() => {
    return subscriptions
      .filter((s) => s.status === "Active")
      .reduce((sum, s) => {
        const amt = parseCurrency(s.amount);
        if (s.billingCycle === "Annual") return sum + amt / 12;
        if (s.billingCycle === "Quarterly") return sum + amt / 3;
        return sum + amt;
      }, 0);
  }, [subscriptions]);

  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((inv) => {
        if (inv.status !== "Paid" && inv.status !== "Partially Paid") return false;
        const d = parseLocalDate(inv.date);
        return d ? isSameLocalMonth(d, now) : false;
      })
      .reduce((sum, inv) => sum + (inv.status === "Paid" ? parseCurrency(inv.amount) : inv.deposit || 0), 0);
  }, [invoices]);

  const lastMonthRevenue = useMemo(() => {
    const ref = subMonths(new Date(), 1);
    return invoices
      .filter((inv) => {
        if (inv.status !== "Paid" && inv.status !== "Partially Paid") return false;
        const d = parseLocalDate(inv.date);
        return d ? isSameLocalMonth(d, ref) : false;
      })
      .reduce((sum, inv) => sum + (inv.status === "Paid" ? parseCurrency(inv.amount) : inv.deposit || 0), 0);
  }, [invoices]);

  const netProfitValue = useMemo(() => {
    if (!expensesAvailable) return monthlyRevenue + activeMrr;
    return monthlyRevenue - monthlyExpenses + activeMrr;
  }, [monthlyRevenue, monthlyExpenses, activeMrr, expensesAvailable]);

  const profitMarginValue = useMemo(() => {
    const totalRev = monthlyRevenue + activeMrr;
    if (totalRev === 0) return 0;
    return Math.round((netProfitValue / totalRev) * 100);
  }, [monthlyRevenue, netProfitValue, activeMrr]);

  const last3MonthsExpenses = useMemo(() => {
    if (!expensesAvailable) return 0;
    const now = new Date();
    const start = startOfMonth(subMonths(now, 2));
    const end = endOfMonth(now);
    const exps = allExpenses.filter((e) => {
      const d = parseLocalDate(e.date);
      return d && d >= start && d <= end;
    });
    const total = exps.reduce((sum, e) => sum + e.amount, 0) / 100;
    return total / 3;
  }, [allExpenses, expensesAvailable]);

  const growthRate = useMemo(() => {
    if (lastMonthRevenue === 0) return monthlyRevenue > 0 ? 100 : 0;
    return Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
  }, [monthlyRevenue, lastMonthRevenue]);

  const activeClientsCount = useMemo(() => clients.filter((c) => c.status === "Active").length, [clients]);
  const newLeadsThisMonth = useMemo(() => {
    const now = new Date();
    return leads.filter((l) => {
      const d = parseLocalDate(l.createdAt);
      return d ? isSameLocalMonth(d, now) : false;
    }).length;
  }, [leads]);
  const activeProjectsCount = useMemo(() => projects.filter((p) => p.status === "In Progress").length, [projects]);
  const activeTeamCount = useMemo(() => team.filter((m) => m.status === "Active").length, [team]);
  const activeSubsCount = useMemo(() => subscriptions.filter((s) => s.status === "Active").length, [subscriptions]);

  const unpaidInvoices = useMemo(
    () => invoices.filter((i) => i.status === "Overdue" || i.status === "Pending" || i.status === "Partially Paid"),
    [invoices]
  );

  const outstandingAmount = useMemo(() => {
    return unpaidInvoices.reduce((sum, i) => {
      if (i.items?.length) {
        const subtotal = i.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
        const rate = i.taxRate ?? 0;
        const tax = (subtotal * rate) / 100;
        const discountAmt =
          i.discountType === "percentage" ? (subtotal * (i.discount || 0)) / 100 : i.discount || 0;
        const total = subtotal + tax - discountAmt;
        return sum + (total - (i.deposit || 0));
      }
      return sum + (parseCurrency(i.amount) - (i.deposit || 0));
    }, 0);
  }, [unpaidInvoices]);

  const revenueTrend = useMemo(() => {
    const now = new Date();
    let periods: Date[] = [];
    let formatStr = "";

    if (trajectoryView === "daily") {
      periods = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
      formatStr = "d";
    } else if (trajectoryView === "weekly") {
      periods = eachWeekOfInterval({ start: subWeeks(now, 11), end: now });
      formatStr = "MMM d";
    } else if (trajectoryView === "monthly") {
      periods = eachMonthOfInterval({ start: startOfYear(now), end: endOfYear(now) });
      formatStr = "MMM";
    } else {
      periods = eachYearOfInterval({ start: subYears(now, 4), end: now });
      formatStr = "yyyy";
    }

    return periods.map((period) => {
      const label = format(period, formatStr);

      const periodInvoices = invoices.filter((inv) => {
        const d = parseLocalDate(inv.date);
        if (!d) return false;
        if (trajectoryView === "daily") return isSameDay(d, period);
        if (trajectoryView === "weekly") return isSameWeek(d, period);
        if (trajectoryView === "monthly") return isSameMonth(d, period);
        return isSameYear(d, period);
      });

      const paid = periodInvoices
        .filter((inv) => inv.status === "Paid" || inv.status === "Partially Paid")
        .reduce((sum, inv) => sum + (inv.status === "Paid" ? parseCurrency(inv.amount) : inv.deposit || 0), 0);

      const recurring = subscriptions
        .filter((s) => {
          if (s.status !== "Active") return false;
          const start = parseLocalDate(s.startDate);
          const end = s.endDate && s.endDate !== "N/A" ? parseLocalDate(s.endDate) : null;
          if (!start) return false;

          let endOfPeriod: Date;
          let startOfPeriod: Date;
          if (trajectoryView === "daily") {
            startOfPeriod = period;
            endOfPeriod = addDays(period, 1);
          } else if (trajectoryView === "weekly") {
            startOfPeriod = startOfWeek(period);
            endOfPeriod = endOfWeek(period);
          } else if (trajectoryView === "monthly") {
            startOfPeriod = startOfMonth(period);
            endOfPeriod = endOfMonth(period);
          } else {
            startOfPeriod = startOfYear(period);
            endOfPeriod = endOfYear(period);
          }

          const hasStarted = !isAfter(start, endOfPeriod);
          const hasNotEnded = !end || !isBefore(end, startOfPeriod);
          return hasStarted && hasNotEnded;
        })
        .reduce((sum, s) => {
          const amt = parseCurrency(s.amount);
          let periodAmt = 0;
          if (trajectoryView === "daily") {
            periodAmt = s.billingCycle === "Annual" ? amt / 365 : amt / 30;
          } else if (trajectoryView === "weekly") {
            periodAmt = s.billingCycle === "Annual" ? amt / 52 : amt / 4;
          } else if (trajectoryView === "monthly") {
            periodAmt = s.billingCycle === "Annual" ? amt / 12 : amt;
          } else {
            periodAmt = s.billingCycle === "Annual" ? amt : amt * 12;
          }
          return sum + periodAmt;
        }, 0);

      const periodExpenses = expensesAvailable
        ? allExpenses.filter((e) => {
            const d = parseLocalDate(e.date);
            if (!d) return false;
            if (trajectoryView === "daily") return isSameDay(d, period);
            if (trajectoryView === "weekly") return isSameWeek(d, period);
            if (trajectoryView === "monthly") return isSameMonth(d, period);
            return isSameYear(d, period);
          })
        : [];

      const expenses = periodExpenses.reduce((sum, e) => sum + e.amount / 100, 0);

      return { label, paid, recurring, expenses };
    });
  }, [invoices, subscriptions, allExpenses, trajectoryView, expensesAvailable]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const horizon = addDays(now, 14);
    const items: {
      id: string;
      title: string;
      subtitle: string;
      date: Date;
      type: string;
      tone: ToneKey;
      icon: React.ElementType;
      link: string;
    }[] = [];

    if (canRead("projects")) {
      projects.forEach((p) => {
        if (p.dueDate && p.status === "In Progress") {
          const d = parseLocalDate(p.dueDate);
          if (d && d <= horizon) {
            items.push({
              id: `proj-${p.id}`,
              title: p.name,
              subtitle: p.client,
              date: d,
              type: "Deadline",
              tone: "purple",
              icon: Briefcase,
              link: `/dashboard/projects/view/${p.id}`,
            });
          }
        }
      });
    }

    if (canRead("invoices")) {
      invoices.forEach((i) => {
        if (i.dueDate && i.status !== "Paid") {
          const d = parseLocalDate(i.dueDate);
          if (d && d <= horizon) {
            items.push({
              id: `inv-${i.id}`,
              title: `Invoice · ${i.amount}`,
              subtitle: i.client,
              date: d,
              type: "Invoice",
              tone: "gold",
              icon: FileText,
              link: `/dashboard/invoices/view/${i.id}`,
            });
          }
        }
      });
    }

    if (canRead("subscriptions")) {
      subscriptions.forEach((s) => {
        if (s.endDate && s.endDate !== "N/A" && s.status === "Active") {
          const d = parseLocalDate(s.endDate);
          if (d && d <= horizon) {
            items.push({
              id: `sub-${s.id}`,
              title: `Renewal · ${s.plan}`,
              subtitle: s.client,
              date: d,
              type: "Renewal",
              tone: "blue",
              icon: CreditCard,
              link: `/dashboard/subscriptions/view/${s.id}`,
            });
          }
        }
      });
    }

    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [projects, invoices, subscriptions, canRead]);

  const activities = useMemo(() => {
    const items: any[] = [];
    if (canRead("invoices")) {
      invoices.slice(-10).forEach((i) => {
        if (i.status === "Paid") {
          items.push({
            icon: CheckCircle2,
            colorType: "secondary",
            action: "Payment Received",
            subject: `${i.client} - ${i.amount}`,
            time: new Date(i.createdAt),
            link: `/dashboard/invoices/view/${i.id}`,
          });
        }
      });
    }
    if (canRead("clients")) {
      clients.slice(-5).forEach((c) =>
        items.push({
          icon: UserPlus,
          colorType: "primary",
          action: "New Client Onboarded",
          subject: c.company || c.name,
          time: new Date(c.createdAt),
          link: `/dashboard/clients/view/${c.id}`,
        })
      );
    }
    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
  }, [clients, invoices, canRead]);

  const receivables = useMemo(() => {
    return unpaidInvoices
      .sort((a, b) => {
        const da = parseLocalDate(a.dueDate)?.getTime() || 0;
        const db = parseLocalDate(b.dueDate)?.getTime() || 0;
        return da - db;
      })
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        client: inv.client,
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
        link: `/dashboard/invoices/view/${inv.id}`,
      }));
  }, [unpaidInvoices]);

  const quarterlyTarget = useMemo(() => {
    const now = new Date();
    const currentQStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    let qRevenue = 0;
    let lastQRevenue = 0;
    const lastQStart = subMonths(currentQStart, 3);

    invoices.forEach((inv) => {
      if (inv.status !== "Paid" && inv.status !== "Partially Paid") return;
      const invDate = parseLocalDate(inv.date);
      if (!invDate) return;
      const amount = inv.status === "Paid" ? parseCurrency(inv.amount) : inv.deposit || 0;
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

    let trendText = "Based on invoices collected this quarter.";
    if (lastQRevenue > 0) {
      const growth = Math.round(((qRevenue - lastQRevenue) / lastQRevenue) * 100);
      if (growth > 0) trendText = `On track to exceed last quarter by ${growth}%.`;
      else if (growth < 0) trendText = `Currently ${Math.abs(growth)}% behind last quarter.`;
    }

    return {
      current: qRevenue,
      target,
      progress,
      label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
      trendText,
    };
  }, [invoices]);

  const activeProjects = useMemo(() => {
    return projects
      .filter((p) => p.status === "In Progress")
      .sort((a, b) => {
        const da = parseLocalDate(a.dueDate)?.getTime() || 0;
        const db = parseLocalDate(b.dueDate)?.getTime() || 0;
        return da - db;
      })
      .slice(0, 5);
  }, [projects]);

  const teamSnapshot = useMemo(() => {
    const active = team.filter((m) => m.status === "Active").length;
    const onLeave = team.filter((m) => m.status === "On Leave").length;
    const pending = team.filter((m) => m.status === "Pending Documents" || m.status === "Draft").length;
    const workload = (taskAnalytics?.workload || []).slice().sort((a, b) => b.count - a.count).slice(0, 5);
    const maxLoad = workload.reduce((m, w) => Math.max(m, w.count), 0);
    return { active, onLeave, pending, total: team.length, workload, maxLoad };
  }, [team, taskAnalytics]);

  const warnings = useMemo(() => (taskAnalytics?.warnings || []).slice(0, 4), [taskAnalytics]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  const firstName = (user?.name || "").trim().split(" ")[0] || "there";
  const todayLabel = format(new Date(), "EEEE, MMMM d, yyyy");
  const roleLabel = user?.role === "admin" ? "Admin" : user?.role === "manager" ? "Manager" : "Team";

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const dueLabel = (date: Date) => {
    const diff = differenceInCalendarDays(date, new Date());
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: "Today", overdue: false };
    if (diff === 1) return { text: "Tomorrow", overdue: false };
    return { text: `In ${diff}d`, overdue: false };
  };

  const sharedModal = showAddModal ? (
    <QuickAddExpenseModal
      accounts={accounts}
      onClose={() => setShowAddModal(false)}
      onSaved={async () => {
        setShowAddModal(false);
        await loadData(true);
      }}
    />
  ) : null;

  if (isStaffView) {
    return (
      <>
        <StaffWorkDashboard
          greeting={greeting}
          firstName={firstName}
          todayLabel={todayLabel}
          isRefreshing={isRefreshing}
          onRefresh={() => loadData(true)}
          onAddExpense={() => setShowAddModal(true)}
          activeProjectsCount={activeProjectsCount}
          activeClientsCount={activeClientsCount}
          activeTeamCount={activeTeamCount}
          upcomingEvents={upcomingEvents}
          activeProjects={activeProjects}
          activities={activities}
          teamSnapshot={teamSnapshot}
          dueLabel={dueLabel}
          canWriteExpense={canWrite("expenses")}
          canWriteProject={canWrite("projects")}
          canWriteSocial={canWrite("social_media")}
          canWriteEmail={canWrite("email")}
          canWriteTransfer={canWrite("transfers")}
          canReadTeam={canRead("team") && team.length > 0}
          canReadClients={canRead("clients")}
          canReadCalendar={canRead("calendar")}
          canReadProjects={canRead("projects")}
        />
        {sharedModal}
      </>
    );
  }

  return (
    <>
      <AdminFinanceDashboard
        greeting={greeting}
        firstName={firstName}
        todayLabel={todayLabel}
        roleLabel={roleLabel}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(true)}
        onAddExpense={() => setShowAddModal(true)}
        growthRate={growthRate}
        monthlyExpenses={monthlyExpenses}
        last3MonthsExpenses={last3MonthsExpenses}
        netProfitValue={netProfitValue}
        profitMarginValue={profitMarginValue}
        revenueValue={formatCurrency(monthlyRevenue)}
        outstandingValue={formatCurrency(outstandingAmount)}
        unpaidCount={unpaidInvoices.length}
        expensesAvailable={expensesAvailable}
        activeMrr={activeMrr}
        activeClientsCount={activeClientsCount}
        activeProjectsCount={activeProjectsCount}
        activeSubsCount={activeSubsCount}
        activeTeamCount={activeTeamCount}
        newLeadsThisMonth={newLeadsThisMonth}
        showTeamStat={team.length > 0}
        showLeadsStat={leads.length > 0 || newLeadsThisMonth > 0}
        trajectoryView={trajectoryView}
        setTrajectoryView={setTrajectoryView}
        revenueTrend={revenueTrend}
        receivables={receivables}
        parseCurrency={parseCurrency}
        upcomingEvents={upcomingEvents}
        activeProjects={activeProjects}
        warnings={warnings}
        activities={activities}
        quarterlyTarget={quarterlyTarget}
        dueLabel={dueLabel}
        canWriteExpense={canWrite("expenses")}
        canWriteInvoice={canWrite("invoices")}
        canWriteProforma={canWrite("proforma")}
        canWriteClient={canWrite("clients")}
        canWriteProject={canWrite("projects")}
        canReadReports={canRead("financial_reports")}
        canWriteSocial={canWrite("social_media")}
        canReadSettings={canRead("settings")}
      />
      {sharedModal}
    </>
  );
}
