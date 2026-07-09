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
  Plus, Scan, Search, MoreHorizontal, Trash2, Edit2,
  Wallet, TrendingDown, Tag, Calendar, Receipt, ArrowUpDown,
  Building2, Smartphone, Banknote, ChevronDown, Filter,
} from "lucide-react";
import { QuickAddExpenseModal } from "@/components/QuickAddExpenseModal";
import { ScanReceiptModal } from "@/components/ScanReceiptModal";

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
  amount: number; // cents from server
  category: ExpenseCategory;
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
}

export type ExpenseCategory =
  | "FOOD" | "TRANSPORT" | "SOFTWARE" | "OFFICE" | "MARKETING"
  | "RENT" | "UTILITIES" | "PAYROLL" | "EQUIPMENT" | "TRAVEL"
  | "COMMUNICATION" | "ENTERTAINMENT" | "TAXES" | "OTHER";

// ─── Constants ─────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; emoji: string; color: string }[] = [
  { value: "FOOD", label: "Food & Drink", emoji: "🍔", color: "#f97316" },
  { value: "TRANSPORT", label: "Transport", emoji: "🚗", color: "#3b82f6" },
  { value: "SOFTWARE", label: "Software", emoji: "💻", color: "#8b5cf6" },
  { value: "OFFICE", label: "Office", emoji: "🖊️", color: "#06b6d4" },
  { value: "MARKETING", label: "Marketing", emoji: "📣", color: "#ec4899" },
  { value: "RENT", label: "Rent", emoji: "🏢", color: "#84cc16" },
  { value: "UTILITIES", label: "Utilities", emoji: "⚡", color: "#eab308" },
  { value: "PAYROLL", label: "Payroll", emoji: "👥", color: "#10b981" },
  { value: "EQUIPMENT", label: "Equipment", emoji: "🔧", color: "#6366f1" },
  { value: "TRAVEL", label: "Travel", emoji: "✈️", color: "#14b8a6" },
  { value: "COMMUNICATION", label: "Communication", emoji: "📞", color: "#f59e0b" },
  { value: "ENTERTAINMENT", label: "Entertainment", emoji: "🎬", color: "#ef4444" },
  { value: "TAXES", label: "Taxes", emoji: "📋", color: "#64748b" },
  { value: "OTHER", label: "Other", emoji: "📦", color: "#9ca3af" },
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

export function getCategoryMeta(cat: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find(c => c.value === cat) ?? EXPENSE_CATEGORIES[13];
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { settings } = useAgencyStore();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [scannedData, setScannedData] = useState<{
    amount?: number;
    description?: string;
    date?: string;
    category?: ExpenseCategory;
    receiptUrl?: string;
  } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterAccount !== "all") params.set("accountId", filterAccount);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const [expensesRes, accountsRes] = await Promise.all([
        apiFetch<{ expenses: Expense[]; total: number }>(`/expenses?${params}`),
        apiFetch<{ accounts: Account[] }>("/accounts"),
      ]);

      setExpenses(expensesRes.expenses);
      setTotalCount(expensesRes.total);
      setAccounts(accountsRes.accounts);

      const total = expensesRes.expenses.reduce((sum, e) => sum + e.amount, 0);
      setTotalExpenses(total);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load expenses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterAccount, filterCategory, filterFrom, filterTo, toast]);

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

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.account.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  // Stats by category
  const categoryStats = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage your business spending
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

        {/* Top Category */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Tag className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Top Category
            </p>
            {categoryStats[0] ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl">{getCategoryMeta(categoryStats[0][0]).emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground leading-tight">
                    {getCategoryMeta(categoryStats[0][0]).label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(centsToAmount(categoryStats[0][1]))}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
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
                    <span>{meta.emoji} {meta.label}</span>
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

      {/* Filters & Table */}
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

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 w-[150px]">
              <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.emoji} {cat.label}
                </SelectItem>
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

          {(filterAccount !== "all" || filterCategory !== "all" || filterFrom || filterTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterAccount("all");
                setFilterCategory("all");
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
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
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
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: catMeta.color + "20", color: catMeta.color }}
                        >
                          <span>{catMeta.emoji}</span>
                          {catMeta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <AccIcon className="h-3.5 w-3.5 shrink-0" />
                          {expense.account.name}
                        </div>
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
    </div>
  );
}
