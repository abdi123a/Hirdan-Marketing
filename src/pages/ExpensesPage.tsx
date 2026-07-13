import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAgencyStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus, Scan, Search, MoreHorizontal, Trash2, Edit2,
  Wallet, TrendingDown, Tag, Calendar, Receipt,
  Building2, Smartphone, Banknote, Filter,
  Users, Play, CheckCircle, RefreshCw, AlertCircle,
  Utensils, Car, Laptop, Briefcase, Megaphone, Zap,
  Wrench, Plane, Phone, Film, FileText, Package
} from "lucide-react";
import { QuickAddExpenseModal } from "@/components/QuickAddExpenseModal";
import { ScanReceiptModal } from "@/components/ScanReceiptModal";
import { RecurringExpenseModal } from "@/components/RecurringExpenseModal";

// ─── Types ─────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  type: "BANK" | "MOBILE_WALLET" | "CASH";
  currency: string;
  color: string | null;
  icon: string | null;
  notes: string | null;
  balance: number;
}

export interface Expense {
  id: string;
  accountId: string;
  employeeId: string | null;
  amount: number; // cents from server
  category: string;
  description: string;
  date: string;
  receiptUrl: string | null;
  notes: string | null;
  account: {
    id: string;
    name: string;
    type: string;
    color: string | null;
    currency: string;
  };
  employee: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number; // cents
  accountId: string | null;
  description: string | null;
  isActive: boolean;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  frequency?: string;
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
  } | null;
}

export type ExpenseCategory =
  | "FOOD" | "TRANSPORT" | "SOFTWARE" | "OFFICE" | "MARKETING"
  | "RENT" | "UTILITIES" | "PAYROLL" | "EQUIPMENT" | "TRAVEL"
  | "COMMUNICATION" | "ENTERTAINMENT" | "TAXES" | "OTHER";

// ─── Constants ─────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: "FOOD", label: "Food & Drink", icon: Utensils, color: "#f97316" },
  { value: "TRANSPORT", label: "Transport", icon: Car, color: "#3b82f6" },
  { value: "SOFTWARE", label: "Software", icon: Laptop, color: "#8b5cf6" },
  { value: "OFFICE", label: "Office", icon: Briefcase, color: "#06b6d4" },
  { value: "MARKETING", label: "Marketing", icon: Megaphone, color: "#ec4899" },
  { value: "RENT", label: "Rent", icon: Building2, color: "#84cc16" },
  { value: "UTILITIES", label: "Utilities", icon: Zap, color: "#eab308" },
  { value: "PAYROLL", label: "Payroll", icon: Users, color: "#10b981" },
  { value: "EQUIPMENT", label: "Equipment", icon: Wrench, color: "#6366f1" },
  { value: "TRAVEL", label: "Travel", icon: Plane, color: "#14b8a6" },
  { value: "COMMUNICATION", label: "Communication", icon: Phone, color: "#f59e0b" },
  { value: "ENTERTAINMENT", label: "Entertainment", icon: Film, color: "#ef4444" },
  { value: "TAXES", label: "Taxes", icon: FileText, color: "#64748b" },
  { value: "OTHER", label: "Other", icon: Package, color: "#9ca3af" },
];

export const ACCOUNT_TYPE_META: Record<Account["type"], { icon: React.ElementType; label: string; color: string }> = {
  BANK: { icon: Building2, label: "Bank", color: "#3b82f6" },
  MOBILE_WALLET: { icon: Smartphone, label: "Mobile Wallet", color: "#10b981" },
  CASH: { icon: Banknote, label: "Cash", color: "#f59e0b" },
};

// ─── Helpers ───────────────────────────────────────────────────────

export function centsToAmount(cents: number) {
  return cents / 100;
}

export function getCategoryMeta(cat: string) {
  const preset = EXPENSE_CATEGORIES.find(c => c.value === cat);
  if (preset) return preset;
  const formattedLabel = cat ? (cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()) : "Other";
  return {
    value: cat as any,
    label: formattedLabel,
    icon: Tag,
    color: "#6366f1",
  };
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [rawTeam, setRawTeam] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Commitments
  const [commitments, setCommitments] = useState({ recurringTotal: 0, payrollTotal: 0, combinedMonthlyBurden: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [scannedData, setScannedData] = useState<{
    amount?: number;
    description?: string;
    date?: string;
    category?: string;
    receiptUrl?: string;
    employeeId?: string;
    accountId?: string;
  } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterAccount !== "all") params.set("accountId", filterAccount);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterEmployee !== "all") params.set("employeeId", filterEmployee);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const [expensesRes, accountsRes, recurringRes, teamRes, commitmentsRes] = await Promise.all([
        apiFetch<{ expenses: Expense[]; total: number }>(`/expenses?${params}`),
        apiFetch<{ accounts: Account[] }>("/accounts"),
        apiFetch<{ recurring: RecurringExpense[] }>("/recurring-expenses"),
        apiFetch<{ team: any[] }>("/team"),
        apiFetch<{ recurringTotal: number; payrollTotal: number; combinedMonthlyBurden: number }>("/financial/monthly-commitments"),
      ]);

      setExpenses(expensesRes.expenses);
      setTotalCount(expensesRes.total);
      setAccounts(accountsRes.accounts);
      setRecurringExpenses(recurringRes.recurring);
      setRawTeam(teamRes.team.filter((m: any) => m.status === "ACTIVE" || m.status === "PENDING_DOCUMENTS" || m.status === "DRAFT" || m.status === "ON_LEAVE"));
      setCommitments(commitmentsRes);

      const total = expensesRes.expenses.reduce((sum, e) => sum + e.amount, 0);
      setTotalExpenses(total);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load expenses data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterAccount, filterCategory, filterEmployee, filterFrom, filterTo, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" });
      toast({ title: "Expense deleted" });
      fetchAll();
    } catch {
      toast({ title: "Failed to delete expense", variant: "destructive" });
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!window.confirm("Delete this recurring template?")) return;
    try {
      await apiFetch(`/recurring-expenses/${id}`, { method: "DELETE" });
      toast({ title: "Recurring expense template deleted" });
      fetchAll();
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.account.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.employee && e.employee.name.toLowerCase().includes(q))
    );
  }, [expenses, search]);

  const payrollHistory = useMemo(() => {
    return expenses.filter(e => e.category === "PAYROLL");
  }, [expenses]);

  // Helper to determine if payroll has been recorded for the employee for the current month
  const isEmployeePaidThisMonth = useCallback((empId: string) => {
    const now = new Date();
    return expenses.some(exp => 
      exp.category === "PAYROLL" && 
      exp.employeeId === empId && 
      new Date(exp.date).getMonth() === now.getMonth() &&
      new Date(exp.date).getFullYear() === now.getFullYear()
    );
  }, [expenses]);

  // Helper to determine if a recurring expense template was already posted in the current period
  const getRecurrencePeriodStatus = useCallback((rec: RecurringExpense) => {
    const now = new Date();
    if (rec.frequency === "ON_DEMAND") return { paid: false, label: "" };

    const isPaid = expenses.some(exp => {
      const matchesName = exp.description.toLowerCase().startsWith(rec.name.toLowerCase());
      if (!matchesName) return false;

      const expDate = new Date(exp.date);

      if (rec.frequency === "DAILY") {
        return expDate.toDateString() === now.toDateString();
      }
      if (rec.frequency === "WEEKLY") {
        const getWeekNumber = (d: Date) => {
          const onejan = new Date(d.getFullYear(), 0, 1);
          return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
        };
        return getWeekNumber(expDate) === getWeekNumber(now) && expDate.getFullYear() === now.getFullYear();
      }
      if (rec.frequency === "MONTHLY") {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      }
      if (rec.frequency === "YEARLY") {
        return expDate.getFullYear() === now.getFullYear();
      }
      return false;
    });

    let label = "";
    if (isPaid) {
      if (rec.frequency === "DAILY") label = "Paid Today";
      else if (rec.frequency === "WEEKLY") label = "Paid this Week";
      else if (rec.frequency === "MONTHLY") label = "Paid this Month";
      else if (rec.frequency === "YEARLY") label = "Paid this Year";
    }

    return { paid: isPaid, label };
  }, [expenses]);

  // Stats by category
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [expenses]);

  // Total balance across all accounts
  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts]
  );

  const handleScanComplete = (data: {
    receiptUrl: string;
    extracted: { amount?: number; description?: string; date?: string; category?: ExpenseCategory } | null;
  }) => {
    setScannedData({
      ...data.extracted,
      receiptUrl: data.receiptUrl,
    });
    setShowScanModal(false);
    setShowAddModal(true);
  };

  const handleExpenseSaved = () => {
    setShowAddModal(false);
    setEditingExpense(null);
    setScannedData(null);
    fetchAll();
  };

  const handleRecurringSaved = () => {
    setShowRecurringModal(false);
    setEditingRecurring(null);
    fetchAll();
  };

  // Label for current period (e.g., July 2026)
  const currentPeriodLabel = useMemo(() => {
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage your business spending and standing payroll commitments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowScanModal(true)}
            className="gap-2 border-dashed"
          >
            <Scan className="h-4 w-4" />
            Scan Receipt
          </Button>
          <Button
            onClick={() => { setEditingExpense(null); setScannedData(null); setShowAddModal(true); }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <Card className="border bg-gradient-to-br from-red-50 to-red-50/0 dark:from-red-950/20 dark:to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
              </div>
              <Badge variant="outline" className="text-xs border-red-200 text-red-600">
                {totalCount} entries
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Total Expenses
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(centsToAmount(totalExpenses))}
            </p>
          </CardContent>
        </Card>

        {/* Accounts Balance */}
        <Card className="border bg-gradient-to-br from-emerald-50 to-emerald-50/0 dark:from-emerald-950/20 dark:to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Wallet className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-600">
                {accounts.length} accounts
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Total Balance
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(centsToAmount(totalBalance))}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Burden */}
        <Card className="border bg-gradient-to-br from-blue-50 to-blue-50/0 dark:from-blue-950/20 dark:to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <RefreshCw className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Est. Monthly Burden
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(centsToAmount(commitments.combinedMonthlyBurden))}
            </p>
          </CardContent>
        </Card>

        {/* Accounts breakdown */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Building2 className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Accounts
            </p>
            <div className="flex flex-col gap-1 mt-1">
              {accounts.slice(0, 2).map(acc => {
                const meta = ACCOUNT_TYPE_META[acc.type];
                const Icon = meta.icon;
                return (
                  <div key={acc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">{acc.name}</span>
                    </div>
                    <span className={`text-xs font-semibold ${acc.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {formatCurrency(centsToAmount(acc.balance))}
                    </span>
                  </div>
                );
              })}
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground">No accounts yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Bar */}
      {categoryStats.length > 0 && (
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Spending Breakdown
            </p>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {categoryStats.map(([cat, amt]) => {
                const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                const meta = getCategoryMeta(cat);
                return (
                  <div
                    key={cat}
                    style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    title={`${meta.label}: ${formatCurrency(centsToAmount(amt))}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {categoryStats.map(([cat, amt]) => {
                const meta = getCategoryMeta(cat);
                return (
                  <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    {(() => {
                      const CatIcon = meta.icon || Tag;
                      return <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
                    })()}
                    <span>{meta.label}</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(centsToAmount(amt))}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Layout */}
      <Tabs defaultValue="recorded" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-[480px]">
          <TabsTrigger value="recorded">Recorded Expenses</TabsTrigger>
          <TabsTrigger value="recurring">Monthly Recurring</TabsTrigger>
          <TabsTrigger value="payroll">Employee Payroll</TabsTrigger>
        </TabsList>

        {/* Tab 1: Recorded Expenses */}
        <TabsContent value="recorded" className="space-y-4">
          <Card className="border">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-4 border-b">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* Account filter */}
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="h-9 w-[160px]">
                  <Wallet className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category filter */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 w-[150px]">
                  <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map(cat => {
                    const CatIcon = cat.icon;
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Employee filter */}
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="h-9 w-[170px]">
                  <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {rawTeam.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="h-9 w-[140px]"
                />
                <span>–</span>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>

              {(filterAccount !== "all" || filterCategory !== "all" || filterEmployee !== "all" || filterFrom || filterTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterAccount("all");
                    setFilterCategory("all");
                    setFilterEmployee("all");
                    setFilterFrom("");
                    setFilterTo("");
                  }}
                  className="h-9 text-muted-foreground"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Receipt className="h-10 w-10 opacity-30" />
                          <p className="text-sm">No expenses found</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAddModal(true)}
                            className="gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add your first expense
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => {
                      const catMeta = getCategoryMeta(expense.category);
                      const accMeta = ACCOUNT_TYPE_META[expense.account.type as Account["type"]];
                      const AccIcon = accMeta?.icon ?? Wallet;
                      return (
                        <TableRow key={expense.id} className="group hover:bg-muted/40 transition-colors">
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2">
                              {expense.receiptUrl && (
                                <a
                                  href={expense.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title="View receipt"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <span className="font-medium text-sm text-foreground truncate max-w-[220px]">
                                {expense.description}
                              </span>
                            </div>
                            {expense.notes && (
                              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{expense.notes}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const CatIcon = catMeta.icon || Tag;
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: catMeta.color + "20", color: catMeta.color }}
                                >
                                  <CatIcon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{catMeta.label}</span>
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <AccIcon className="h-3.5 w-3.5 shrink-0" />
                              {expense.account.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {expense.employee ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground">
                                <Users className="h-3 w-3 opacity-60 mr-0.5" />
                                {expense.employee.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(expense.date)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                            -{formatCurrency(centsToAmount(expense.amount))}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => { setEditingExpense(expense); setScannedData(null); setShowAddModal(true); }}
                                >
                                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(expense.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {!loading && filteredExpenses.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                <span>Showing {filteredExpenses.length} of {totalCount} expenses</span>
                <span className="font-semibold text-foreground">
                  Total: {formatCurrency(centsToAmount(filteredExpenses.reduce((s, e) => s + e.amount, 0)))}
                </span>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Monthly Recurring Expenses */}
        <TabsContent value="recurring" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold text-foreground">Monthly Standing Commitments</h2>
              <p className="text-xs text-muted-foreground">
                Manage standing business commitments that occur every month (rent, utilities, software...)
              </p>
            </div>
            <Button
              onClick={() => { setEditingRecurring(null); setShowRecurringModal(true); }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Standing Commitment
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border bg-muted/20">
              <CardContent className="p-4 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Est. Monthly Salaries</span>
                <span className="text-2xl font-bold text-foreground">{formatCurrency(centsToAmount(commitments.payrollTotal))}</span>
              </CardContent>
            </Card>
            <Card className="border bg-muted/20">
              <CardContent className="p-4 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Est. Standing Business Expenses</span>
                <span className="text-2xl font-bold text-foreground">{formatCurrency(centsToAmount(commitments.recurringTotal))}</span>
              </CardContent>
            </Card>
            <Card className="border bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex flex-col gap-1">
                <span className="text-xs text-primary font-medium uppercase tracking-wider">Total Est. Monthly Commitments</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(centsToAmount(commitments.combinedMonthlyBurden))}</span>
              </CardContent>
            </Card>
          </div>

          <Card className="border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Preferred Account</TableHead>
                    <TableHead>Expected Day</TableHead>
                    <TableHead className="text-right">Monthly Amount</TableHead>
                    <TableHead>Status / Recurrence</TableHead>
                    <TableHead className="w-24 text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : recurringExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="h-8 w-8 opacity-45" />
                          <p className="text-sm">No recurring expense templates found.</p>
                          <p className="text-xs text-muted-foreground">Add commitments like rent or transport allowances that occur every month.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recurringExpenses.map((rec) => {
                      const catMeta = getCategoryMeta(rec.category);
                      const isExpired = rec.endDate ? new Date() > new Date(rec.endDate) : false;
                      return (
                        <TableRow key={rec.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="pl-4 font-semibold text-sm">
                            {rec.name}
                            {rec.description && (
                              <p className="text-xs font-normal text-muted-foreground mt-0.5">{rec.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const CatIcon = catMeta.icon || Tag;
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: catMeta.color + "20", color: catMeta.color }}
                                >
                                  <CatIcon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{catMeta.label}</span>
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {rec.account ? rec.account.name : "None preferred"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {rec.frequency === "MONTHLY" && rec.dayOfMonth ? `Day ${rec.dayOfMonth}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatCurrency(centsToAmount(rec.amount))}
                          </TableCell>
                          <TableCell className="space-y-1">
                            <div>
                              <Badge variant={isExpired ? "destructive" : (rec.isActive ? "default" : "secondary")} className="text-[11px] px-1.5 py-0">
                                {isExpired ? "Expired" : (rec.isActive ? "Active" : "Inactive")}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-tight font-medium">
                              <span>Every {rec.frequency ? rec.frequency.toLowerCase().replace("_", " ") : "month"}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground/80 leading-none">
                              {rec.endDate ? (
                                <span>Until {formatDate(rec.endDate)}</span>
                              ) : (
                                <span>Ongoing</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-4 space-x-1.5 whitespace-nowrap">
                            {getRecurrencePeriodStatus(rec).paid ? (
                              <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10 gap-1 font-semibold py-1 h-7 inline-flex items-center">
                                <CheckCircle className="h-3 w-3 text-emerald-600" />
                                {getRecurrencePeriodStatus(rec).label}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="hero"
                                disabled={isExpired || !rec.isActive}
                                onClick={() => {
                                  setEditingExpense(null);
                                  setScannedData({
                                    amount: centsToAmount(rec.amount),
                                    description: `${rec.name} — ${currentPeriodLabel}`,
                                    category: rec.category,
                                    accountId: rec.accountId || undefined,
                                  });
                                  setShowAddModal(true);
                                }}
                                title={isExpired ? "Template is expired" : "Record payment with date picker"}
                                className="h-7 px-2.5 gap-1 text-[11px]"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                Record Payment
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingRecurring(rec); setShowRecurringModal(true); }}>
                                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                                  Edit Template
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteRecurring(rec.id)} className="text-red-600">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete Template
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Employee Payroll & Salaries */}
        <TabsContent value="payroll" className="space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold text-foreground">Employee Salaries & Payroll</h2>
            <p className="text-xs text-muted-foreground">
              Review active team member salary packages configured in their employment details and record payroll payments.
            </p>
          </div>

          <Card className="border bg-gradient-to-br from-emerald-50/20 to-emerald-50/0 dark:from-emerald-950/10 dark:to-transparent">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Monthly Payroll Total</p>
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(centsToAmount(commitments.payrollTotal))}
                </p>
              </div>
              <div className="text-xs text-muted-foreground text-right max-w-xs">
                Includes basic salary, housing allowance, and transport allowance for all active staff.
              </div>
            </CardContent>
          </Card>

          {/* Active Employees List */}
          <Card className="border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm text-foreground">Active Team Salaries</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Employee</TableHead>
                    <TableHead>Role / Department</TableHead>
                    <TableHead className="text-right">Basic Salary</TableHead>
                    <TableHead className="text-right">Housing Allowance</TableHead>
                    <TableHead className="text-right">Transport Allowance</TableHead>
                    <TableHead className="text-right">Total Package</TableHead>
                    <TableHead className="w-32 pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rawTeam.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No active employees found with salary details.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rawTeam.map((emp) => {
                      const basic = emp.basicSalary || 0;
                      const housing = emp.housingAllowance || 0;
                      const transport = emp.transportAllowance || 0;
                      const totalCents = basic + housing + transport;
                      const isPaid = isEmployeePaidThisMonth(emp.id);
                      return (
                        <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="pl-4 font-semibold">
                            {emp.name}
                            <p className="text-xs font-normal text-muted-foreground mt-0.5">{emp.email}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {emp.role}
                            <p className="text-xs font-normal opacity-75">{emp.department || "General"}</p>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(centsToAmount(basic))}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-muted-foreground">
                            {housing > 0 ? formatCurrency(centsToAmount(housing)) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-muted-foreground">
                            {transport > 0 ? formatCurrency(centsToAmount(transport)) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground">
                            {formatCurrency(centsToAmount(totalCents))}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            {isPaid ? (
                              <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10 gap-1 font-semibold py-1">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                Paid this Month
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEditingExpense(null);
                                  setScannedData({
                                    amount: centsToAmount(totalCents),
                                    description: `Salary — ${emp.name} — ${currentPeriodLabel}`,
                                    category: "PAYROLL",
                                    employeeId: emp.id,
                                  });
                                  setShowAddModal(true);
                                }}
                                className="gap-1 h-8 text-xs"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Record Payment
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Historical Payroll Expenses */}
          <Card className="border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm text-foreground">Historical Payroll Expenses</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Description</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right pr-4">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : payrollHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-xs">
                        No payroll expenses recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollHistory.slice(0, 6).map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="pl-4 text-sm font-medium">
                          {expense.description}
                          {expense.notes && <p className="text-xs text-muted-foreground mt-0.5">{expense.notes}</p>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {expense.employee ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground">
                              {expense.employee.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {expense.account.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(expense.date)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600 dark:text-red-400 pr-4">
                          -{formatCurrency(centsToAmount(expense.amount))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showAddModal && (
        <QuickAddExpenseModal
          accounts={accounts}
          expense={editingExpense}
          prefill={scannedData}
          onClose={() => { setShowAddModal(false); setEditingExpense(null); setScannedData(null); }}
          onSaved={handleExpenseSaved}
        />
      )}

      {showScanModal && (
        <ScanReceiptModal
          onClose={() => setShowScanModal(false)}
          onComplete={handleScanComplete}
        />
      )}

      {showRecurringModal && (
        <RecurringExpenseModal
          accounts={accounts}
          recurring={editingRecurring}
          onClose={() => { setShowRecurringModal(false); setEditingRecurring(null); }}
          onSaved={handleRecurringSaved}
        />
      )}
    </div>
  );
}
